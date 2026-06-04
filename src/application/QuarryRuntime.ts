import type {
  IFoodService,
  IHazardService,
  ILogger,
  IQuarryPlanner,
  IRecoveryService,
  ISafetyService,
  IStateStore,
  IStorageService,
  ITaskOrchestrator,
  IToolService,
  ITelemetryService
} from "../domain/interfaces";
import type { AppConfig, FinalReport, RuntimeState, StatusReport, Vector3 } from "../domain/types";
import { sleep } from "../utils/sleep";

interface RuntimeServices {
  planner: IQuarryPlanner;
  stateStore: IStateStore;
  movement: {
    getPosition(): Vector3;
    getLastKnownPath(): Vector3[];
    goNear(position: Vector3, range?: number): Promise<void>;
    dig(target: Vector3): Promise<boolean>;
  };
  safety: ISafetyService;
  inventory: {
    getInventoryUsage(): number;
    getPickaxeDurabilityPercent(): number | null;
  };
  tools: IToolService;
  food: IFoodService;
  storage: IStorageService;
  hazards: IHazardService;
  recovery: IRecoveryService;
  orchestrator: ITaskOrchestrator;
  telemetry: ITelemetryService;
  logger: ILogger;
}

export class QuarryRuntime {
  private state: RuntimeState;
  private active = false;
  private lastPosition: Vector3;
  private lastMovementAt = Date.now();
  private lastStatusAt = 0;
  private lastStatusProgress = 0;

  constructor(
    private readonly bot: any,
    private readonly config: AppConfig,
    private readonly services: RuntimeServices,
    initialState: RuntimeState
  ) {
    this.state = initialState;
    this.lastPosition = services.movement.getPosition();
  }

  async start(): Promise<void> {
    this.active = true;
    await this.services.telemetry.sendAlert("Quarry dimulai", {
      bot: this.bot.username,
      origin: this.state.origin ? `${this.state.origin.x} ${this.state.origin.y} ${this.state.origin.z}` : "unknown"
    });

    while (this.active) {
      try {
        await this.tick();
        await sleep(250);
      } catch (error) {
        await this.services.telemetry.sendError(error, this.state, this.services.movement.getPosition());
        this.state = await this.services.recovery.recover(this.state);
        await this.saveState();
      }
    }
  }

  stop(): void {
    this.active = false;
  }

  getState(): RuntimeState {
    return this.state;
  }

  async tick(): Promise<void> {
    this.updateRuntimeCounters();
    await this.detectStuck();

    const position = this.services.movement.getPosition();
    this.state = await this.services.safety.rememberSafePosition(this.state, position);

    const chosenTask = this.services.orchestrator.chooseTask({
      health: this.bot.health ?? 20,
      hunger: this.bot.food ?? 20,
      inventoryUsage: this.services.inventory.getInventoryUsage(),
      durability: this.services.inventory.getPickaxeDurabilityPercent(),
      currentTask: this.state.currentTask
    });

    if (chosenTask !== this.state.currentTask) {
      this.state = { ...this.state, currentTask: chosenTask, updatedAt: new Date().toISOString() };
      await this.saveState();
    }

    if (chosenTask === "SURVIVE" || chosenTask === "RECOVERY") {
      this.state = await this.services.recovery.recover(this.state);
      await this.saveState();
      return;
    }

    if (chosenTask === "EAT") {
      await this.services.food.eatIfNeeded();
      this.state = { ...this.state, currentTask: "QUARRY", updatedAt: new Date().toISOString() };
      return;
    }

    if (chosenTask === "REPAIR") {
      const repaired = await this.services.recovery.recover({ ...this.state, currentTask: "REPAIR" });
      this.state = { ...repaired, repairsPerformed: repaired.repairsPerformed + 1 };
      await this.saveState();
      return;
    }

    if (chosenTask === "STORE_ITEMS") {
      const result = await this.services.storage.storeIfNeeded(this.state.lastWorkPosition);
      this.state = {
        ...this.state,
        currentTask: result === "NO_STORAGE" ? "WAIT_FOR_STORAGE" : "QUARRY",
        updatedAt: new Date().toISOString()
      };
      await this.saveState();
      return;
    }

    if (chosenTask === "WAIT_FOR_STORAGE") {
      const result = await this.services.storage.storeIfNeeded(this.state.lastWorkPosition);
      if (result !== "NO_STORAGE") {
        this.state = {
          ...this.state,
          currentTask: "QUARRY",
          updatedAt: new Date().toISOString()
        };
        await this.saveState();
      }
      await this.sendStatusIfDue();
      await sleep(1_000);
      return;
    }

    if (chosenTask === "COMPLETE") {
      await this.sendStatusIfDue();
      await sleep(1_000);
      return;
    }

    await this.services.food.eatIfNeeded();
    await this.services.tools.equipBestPickaxe();
    const target = await this.services.planner.getNextTarget(this.state, position, async (candidate, candidateState) =>
      this.services.safety.canMineTarget(candidate, candidateState, position)
    );

    if (!target) {
      this.state = { ...this.state, currentTask: "COMPLETE", progress: 100, updatedAt: new Date().toISOString() };
      await this.saveState();
      await this.services.telemetry.sendFinalReport(this.createFinalReport());
      this.stop();
      return;
    }

    const hazardSafe = await this.services.hazards.inspectAndHandle(target);
    if (!hazardSafe) {
      this.services.logger.warn("Skipping hazardous target", { target });
      return;
    }

    await this.services.tools.equipBestPickaxe();
    const mined = await this.services.movement.dig(target);
    if (!mined) {
      this.services.logger.warn("Skipping target because it could not be mined", { target });
      return;
    }
    this.state = this.services.planner.recordMined(this.state, target);
    if (this.services.planner.getTargetRole(this.state, target) === "FEET") {
      await this.services.movement.goNear(target, 1);
      this.state = await this.services.safety.rememberSafePosition(this.state, this.services.movement.getPosition());
    }
    this.state.lastKnownPath = this.services.movement.getLastKnownPath();
    await this.saveState();
    await this.sendStatusIfDue();
  }

  private updateRuntimeCounters(): void {
    const startedAt = Date.parse(this.state.startedAt);
    this.state = {
      ...this.state,
      runtimeMs: Number.isFinite(startedAt) ? Date.now() - startedAt : this.state.runtimeMs,
      updatedAt: new Date().toISOString()
    };
  }

  private async detectStuck(): Promise<void> {
    const position = this.services.movement.getPosition();
    const moved = position.x !== this.lastPosition.x || position.y !== this.lastPosition.y || position.z !== this.lastPosition.z;
    if (moved) {
      this.lastPosition = position;
      this.lastMovementAt = Date.now();
      return;
    }

    if (Date.now() - this.lastMovementAt >= this.config.thresholds.stuckTimeoutMs) {
      this.lastMovementAt = Date.now();
      this.state = await this.services.recovery.recover(this.state);
      await this.saveState();
    }
  }

  private async sendStatusIfDue(): Promise<void> {
    const dueByTime = Date.now() - this.lastStatusAt >= this.config.thresholds.statusIntervalMs;
    const dueByProgress = this.state.progress - this.lastStatusProgress >= 1;
    if (!dueByTime && !dueByProgress) {
      return;
    }

    this.lastStatusAt = Date.now();
    this.lastStatusProgress = this.state.progress;
    await this.services.telemetry.sendStatus(this.createStatusReport());
  }

  private createStatusReport(): StatusReport {
    return {
      botName: this.bot.username,
      currentTask: this.state.currentTask,
      progress: this.state.progress,
      currentLayer: this.state.currentLayer,
      blocksMined: this.state.blocksMined,
      durability: this.services.inventory.getPickaxeDurabilityPercent(),
      inventoryUsage: this.services.inventory.getInventoryUsage(),
      health: this.bot.health ?? 20,
      hunger: this.bot.food ?? 20,
      position: this.services.movement.getPosition(),
      runtimeMs: this.state.runtimeMs,
      etaMs: estimateEta(this.state)
    };
  }

  private createFinalReport(): FinalReport {
    const averageBlocksPerMinute = this.state.runtimeMs > 0 ? this.state.blocksMined / (this.state.runtimeMs / 60_000) : 0;
    return {
      totalBlocksMined: this.state.blocksMined,
      runtimeMs: this.state.runtimeMs,
      averageBlocksPerMinute,
      repairsPerformed: this.state.repairsPerformed,
      deathCount: this.state.deathCount,
      itemsCollected: this.state.itemsCollected,
      finalPosition: this.services.movement.getPosition()
    };
  }

  private async saveState(): Promise<void> {
    await this.services.stateStore.saveRuntimeState(this.state);
    this.services.logger.info("Runtime status", {
      currentLayer: this.state.currentLayer,
      progress: this.state.progress.toFixed(2),
      blocksMined: this.state.blocksMined,
      health: this.bot.health,
      hunger: this.bot.food,
      durability: this.services.inventory.getPickaxeDurabilityPercent(),
      inventoryUsage: this.services.inventory.getInventoryUsage(),
      currentTask: this.state.currentTask
    });
  }
}

function estimateEta(state: RuntimeState): number | null {
  if (!state.quarryBounds || state.blocksMined <= 0 || state.runtimeMs <= 0) {
    return null;
  }
  const remaining = state.quarryBounds.totalBlocks - state.blocksMined;
  const msPerBlock = state.runtimeMs / state.blocksMined;
  return Math.max(0, remaining * msPerBlock);
}
