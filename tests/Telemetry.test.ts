import { afterEach, describe, expect, it, vi } from "vitest";
import { DiscordWebhookTelemetry } from "../src/infrastructure/telemetry/DiscordWebhookTelemetry";

describe("DiscordWebhookTelemetry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not throw when the webhook is empty", async () => {
    const telemetry = new DiscordWebhookTelemetry("", logger());

    await expect(telemetry.sendAlert("Bot online")).resolves.toBeUndefined();
  });

  it("queues failed webhook sends instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500 }))
    );
    const telemetry = new DiscordWebhookTelemetry("https://discord.invalid/webhook", logger());

    await expect(telemetry.sendAlert("Bot online")).resolves.toBeUndefined();
  });
});

function logger(): any {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  };
}
