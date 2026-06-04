import type { ILogger, ITelemetryService } from "../../domain/interfaces";
import type { FinalReport, RuntimeState, StatusReport, Vector3 } from "../../domain/types";
import { formatVector } from "../../utils/vector";

interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

interface DiscordPayload {
  embeds: Array<{
    title: string;
    description?: string;
    color: number;
    timestamp: string;
    fields: DiscordEmbedField[];
  }>;
}

export class DiscordWebhookTelemetry implements ITelemetryService {
  private readonly queue: DiscordPayload[] = [];
  private retryTimer?: ReturnType<typeof setInterval>;
  private rateLimitedUntil = 0;

  constructor(
    private readonly webhookUrl: string | undefined,
    private readonly logger: ILogger
  ) {}

  start(): void {
    if (!this.webhookUrl || this.retryTimer) {
      return;
    }
    this.retryTimer = setInterval(() => {
      void this.flushQueue();
    }, 15_000);
  }

  stop(): void {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = undefined;
    }
  }

  async sendAlert(title: string, fields: Record<string, unknown> = {}): Promise<void> {
    await this.sendPayload({
      embeds: [
        {
          title,
          color: 0xf59e0b,
          timestamp: new Date().toISOString(),
          fields: Object.entries(fields).map(([name, value]) => ({
            name,
            value: String(value),
            inline: true
          }))
        }
      ]
    });
  }

  async sendStatus(status: StatusReport): Promise<void> {
    await this.sendPayload({
      embeds: [
        {
          title: "Autonomous Quarry Bot",
          color: 0x22c55e,
          timestamp: new Date().toISOString(),
          fields: [
            field("Bot Name", status.botName),
            field("Current Task", status.currentTask),
            field("Progress %", `${status.progress.toFixed(2)}%`),
            field("Current Layer", status.currentLayer),
            field("Blocks Mined", status.blocksMined),
            field("Durability", status.durability === null ? "N/A" : `${Math.round(status.durability * 100)}%`),
            field("Inventory Usage", `${Math.round(status.inventoryUsage * 100)}%`),
            field("Health", status.health),
            field("Hunger", status.hunger),
            field("Position", formatVector(status.position)),
            field("Runtime", formatDuration(status.runtimeMs)),
            field("ETA", status.etaMs === null ? "N/A" : formatDuration(status.etaMs))
          ]
        }
      ]
    });
  }

  async sendError(error: unknown, state?: RuntimeState, position?: Vector3): Promise<void> {
    const normalized = normalizeError(error);
    this.logger.error("Runtime error", {
      message: normalized.message,
      stack: normalized.stack,
      task: state?.currentTask,
      position: position ? formatVector(position) : undefined
    });

    await this.sendPayload({
      embeds: [
        {
          title: "Error fatal",
          color: 0xef4444,
          timestamp: new Date().toISOString(),
          fields: [
            field("Error Message", normalized.message),
            field("Stack Trace", normalized.stack ?? "N/A", false),
            field("Current Task", state?.currentTask ?? "UNKNOWN"),
            field("Position", position ? formatVector(position) : "UNKNOWN"),
            field("Timestamp", new Date().toISOString())
          ]
        }
      ]
    });
  }

  async sendFinalReport(report: FinalReport): Promise<void> {
    await this.sendPayload({
      embeds: [
        {
          title: "QUARRY COMPLETE",
          color: 0x3b82f6,
          timestamp: new Date().toISOString(),
          fields: [
            field("Total Blocks Mined", report.totalBlocksMined),
            field("Runtime", formatDuration(report.runtimeMs)),
            field("Average Blocks Per Minute", report.averageBlocksPerMinute.toFixed(2)),
            field("Repairs Performed", report.repairsPerformed),
            field("Death Count", report.deathCount),
            field("Items Collected", JSON.stringify(report.itemsCollected)),
            field("Final Position", formatVector(report.finalPosition))
          ]
        }
      ]
    });
  }

  private async sendPayload(payload: DiscordPayload): Promise<void> {
    if (!this.webhookUrl) {
      this.logger.debug("Discord webhook skipped because webhookUrl is empty");
      return;
    }

    if (Date.now() < this.rateLimitedUntil) {
      this.queuePayload(payload);
      this.logger.warn("Discord webhook rate limited; queued for later", {
        retryInMs: this.rateLimitedUntil - Date.now(),
        queueLength: this.queue.length
      });
      return;
    }

    try {
      await postWebhook(this.webhookUrl, payload);
    } catch (error) {
      this.rememberRateLimit(error);
      this.logger.warn("Discord webhook failed; queued for retry", { error: normalizeError(error).message });
      this.queuePayload(payload);
    }
  }

  private async flushQueue(): Promise<void> {
    if (!this.webhookUrl || this.queue.length === 0) {
      return;
    }

    const pending = this.queue.splice(0, this.queue.length);
    for (const payload of pending) {
      if (Date.now() < this.rateLimitedUntil) {
        this.queuePayload(payload);
        return;
      }

      try {
        await postWebhook(this.webhookUrl, payload);
      } catch (error) {
        this.rememberRateLimit(error);
        this.logger.warn("Discord webhook retry failed", { error: normalizeError(error).message });
        this.queuePayload(payload);
      }
    }
  }

  private queuePayload(payload: DiscordPayload): void {
    this.queue.push(payload);
    if (this.queue.length > 50) {
      this.queue.splice(0, this.queue.length - 50);
    }
  }

  private rememberRateLimit(error: unknown): void {
    if (error instanceof WebhookHttpError && error.status === 429) {
      this.rateLimitedUntil = Date.now() + Math.max(error.retryAfterMs ?? 30_000, 15_000);
    }
  }
}

async function postWebhook(webhookUrl: string, payload: DiscordPayload): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const retryAfterHeader = response.headers?.get("retry-after");
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;
    throw new WebhookHttpError(response.status, retryAfterMs);
  }
}

class WebhookHttpError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterMs?: number
  ) {
    super(`Discord webhook HTTP ${status}`);
  }
}

function field(name: string, value: unknown, inline = true): DiscordEmbedField {
  return {
    name,
    value: String(value).slice(0, 1024),
    inline
  };
}

function normalizeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return `${hours}h ${minutes}m ${rest}s`;
}
