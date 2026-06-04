import type {
  BlockSnapshot,
  BotVitals,
  ChestMemory,
  ChestRecord,
  FinalReport,
  HazardRecord,
  ItemSnapshot,
  QuarryBounds,
  QuarryDimensions,
  RuntimeState,
  StatusReport,
  TaskState,
  Vector3
} from "./types";

export interface ILogger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  debug(message: string, fields?: Record<string, unknown>): void;
}

export interface IStateStore {
  loadRuntimeState(defaultState: RuntimeState): Promise<RuntimeState>;
  saveRuntimeState(state: RuntimeState): Promise<void>;
  loadChestMemory(): Promise<ChestMemory>;
  saveChestMemory(memory: ChestMemory): Promise<void>;
  loadHazards(): Promise<HazardRecord[]>;
  saveHazards(hazards: HazardRecord[]): Promise<void>;
}

export type SafeTargetPredicate = (target: Vector3, state: RuntimeState) => Promise<boolean>;

export interface IQuarryPlanner {
  createBounds(origin: Vector3, dimensions: QuarryDimensions): QuarryBounds;
  getLayerY(bounds: QuarryBounds, layer: number): number;
  isInsideBounds(bounds: QuarryBounds, position: Vector3): boolean;
  getTargetRole(state: RuntimeState, target: Vector3): "HEAD" | "FEET" | "OTHER";
  getNextTarget(
    state: RuntimeState,
    botPosition: Vector3,
    isSafeTarget: SafeTargetPredicate
  ): Promise<Vector3 | null>;
  recordMined(state: RuntimeState, target: Vector3): RuntimeState;
  calculateProgress(state: RuntimeState): number;
  isComplete(state: RuntimeState): boolean;
}

export interface IMovementService {
  getPosition(): Vector3;
  getLastKnownPath(): Vector3[];
  canReach(position: Vector3, range?: number): Promise<boolean>;
  goNear(position: Vector3, range?: number): Promise<void>;
  dig(target: Vector3): Promise<void>;
  returnTo(position: Vector3): Promise<void>;
}

export interface IWorldReader {
  getBlock(position: Vector3): BlockSnapshot | null;
  canReach(position: Vector3, range?: number): Promise<boolean>;
  canReachStorageFrom(position: Vector3): Promise<boolean>;
}

export interface ISafetyService {
  isSafePosition(position: Vector3): Promise<boolean>;
  canMineTarget(target: Vector3, state: RuntimeState, botPosition: Vector3): Promise<boolean>;
  rememberSafePosition(state: RuntimeState, position: Vector3): Promise<RuntimeState>;
}

export interface IInventoryService {
  getItems(): ItemSnapshot[];
  getInventoryUsage(): number;
  getBestPickaxe(): ItemSnapshot | null;
  getPickaxeDurabilityPercent(): number | null;
  hasFood(): boolean;
  hasXpBottle(): boolean;
  needsStorage(threshold: number): boolean;
  needsRepair(threshold: number): boolean;
  needsFood(hunger: number, hungerLow: number): boolean;
}

export interface IChestService {
  discoverChests(): Promise<ChestMemory>;
  getMemory(): Promise<ChestMemory>;
  validateChest(chest: ChestRecord): Promise<boolean>;
  findSupplyChest(): Promise<ChestRecord | null>;
  findStorageChest(): Promise<ChestRecord | null>;
  markChestInvalid(chest: ChestRecord): Promise<void>;
}

export interface IToolService {
  equipBestPickaxe(): Promise<ItemSnapshot | null>;
}

export interface IRepairService {
  repairIfNeeded(): Promise<boolean>;
}

export interface IFoodService {
  eatIfNeeded(): Promise<boolean>;
}

export interface IStorageService {
  storeIfNeeded(lastWorkPosition?: Vector3): Promise<"STORED" | "NOT_NEEDED" | "NO_STORAGE">;
}

export interface IHazardService {
  inspectAndHandle(target: Vector3): Promise<boolean>;
  getHazards(): Promise<HazardRecord[]>;
}

export interface IRecoveryService {
  recover(state: RuntimeState): Promise<RuntimeState>;
}

export interface ITaskOrchestrator {
  chooseTask(input: {
    health: number;
    hunger: number;
    inventoryUsage: number;
    durability: number | null;
    currentTask: TaskState;
  }): TaskState;
}

export interface ITelemetryService {
  start(): void;
  stop(): void;
  sendAlert(title: string, fields?: Record<string, unknown>): Promise<void>;
  sendStatus(status: StatusReport): Promise<void>;
  sendError(error: unknown, state?: RuntimeState, position?: Vector3): Promise<void>;
  sendFinalReport(report: FinalReport): Promise<void>;
}

export interface IBotFacade {
  username: string;
  vitals(): BotVitals;
}
