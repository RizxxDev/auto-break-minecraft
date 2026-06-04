import type {
  IFoodService,
  ILogger,
  IMovementService,
  IRecoveryService,
  IRepairService,
  IStorageService,
  ITelemetryService
} from "../domain/interfaces";
import type { RuntimeState } from "../domain/types";

export class RecoveryService implements IRecoveryService {
  constructor(
    private readonly movement: IMovementService,
    private readonly food: IFoodService,
    private readonly repair: IRepairService,
    private readonly storage: IStorageService,
    private readonly telemetry: ITelemetryService,
    private readonly logger: ILogger
  ) {}

  async recover(state: RuntimeState): Promise<RuntimeState> {
    await this.telemetry.sendAlert("Safe Recovery dijalankan", {
      task: state.currentTask,
      layer: state.currentLayer
    });
    this.logger.warn("Recovery started", { task: state.currentTask });

    let nextState: RuntimeState = { ...state, currentTask: "RECOVERY", updatedAt: new Date().toISOString() };

    await this.food.eatIfNeeded();

    if (nextState.lastSafePosition) {
      await this.movement.returnTo(nextState.lastSafePosition);
    }

    await this.repair.repairIfNeeded();
    const storageResult = await this.storage.storeIfNeeded(nextState.lastWorkPosition);
    if (storageResult === "NO_STORAGE") {
      return {
        ...nextState,
        currentTask: "WAIT_FOR_STORAGE",
        updatedAt: new Date().toISOString()
      };
    }

    nextState = {
      ...nextState,
      currentTask: "QUARRY",
      lastKnownPath: this.movement.getLastKnownPath(),
      updatedAt: new Date().toISOString()
    };
    this.logger.info("Recovery complete");
    return nextState;
  }
}
