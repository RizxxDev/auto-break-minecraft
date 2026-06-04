export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export type AuthMode = "offline" | "microsoft" | "mojang";

export interface BotConfig {
  host: string;
  port: number;
  username: string;
  auth: AuthMode;
  version?: string | null;
}

export interface QuarryDimensions {
  width: number;
  height: number;
  depth: number;
}

export interface DiscordConfig {
  webhookUrl?: string;
}

export interface ThresholdConfig {
  inventoryUsage: number;
  durabilityLow: number;
  durabilityRepaired: number;
  hungerLow: number;
  healthLow: number;
  stuckTimeoutMs: number;
  statusIntervalMs: number;
  chestScanRadius: number;
}

export interface PathConfig {
  dataDir: string;
  logDir: string;
}

export interface AppConfig {
  bot: BotConfig;
  quarry: QuarryDimensions;
  discord: DiscordConfig;
  thresholds: ThresholdConfig;
  paths: PathConfig;
}

export interface QuarryBounds {
  origin: Vector3;
  min: Vector3;
  max: Vector3;
  width: number;
  height: number;
  depth: number;
  totalBlocks: number;
}

export type TaskState =
  | "IDLE"
  | "QUARRY"
  | "STORE_ITEMS"
  | "REPAIR"
  | "EAT"
  | "SURVIVE"
  | "RECOVERY"
  | "WAIT_FOR_STORAGE"
  | "COMPLETE";

export type ChestKind = "SUPPLY_CHEST" | "STORAGE_CHEST" | "UNKNOWN";

export interface ChestRecord {
  id: string;
  kind: ChestKind;
  position: Vector3;
  lastSeenAt: string;
  reachable: boolean;
  itemNames: string[];
}

export interface ChestMemory {
  supplyChests: ChestRecord[];
  storageChests: ChestRecord[];
  unknownChests: ChestRecord[];
}

export type HazardKind = "LAVA" | "WATER";

export interface HazardRecord {
  id: string;
  kind: HazardKind;
  position: Vector3;
  discoveredAt: string;
  handled: boolean;
}

export interface RuntimeState {
  origin?: Vector3;
  quarryBounds?: QuarryBounds;
  currentLayer: number;
  blocksMined: number;
  progress: number;
  currentTask: TaskState;
  startedAt: string;
  updatedAt: string;
  runtimeMs: number;
  lastSafePosition?: Vector3;
  lastSafeLayer?: number;
  lastKnownPath: Vector3[];
  lastWorkPosition?: Vector3;
  completedBlockKeys: string[];
  repairsPerformed: number;
  deathCount: number;
  itemsCollected: Record<string, number>;
}

export interface BlockSnapshot {
  name: string;
  position: Vector3;
  diggable: boolean;
  boundingBox: "block" | "empty" | string;
  liquid: boolean;
}

export interface ItemSnapshot {
  name: string;
  count: number;
  type?: number;
  metadata?: number;
  slot?: number;
  maxDurability?: number;
  durabilityUsed?: number;
  enchantments?: Record<string, number>;
}

export interface BotVitals {
  health: number;
  hunger: number;
  position: Vector3;
}

export interface StatusReport {
  botName: string;
  currentTask: TaskState;
  progress: number;
  currentLayer: number;
  blocksMined: number;
  durability: number | null;
  inventoryUsage: number;
  health: number;
  hunger: number;
  position: Vector3;
  runtimeMs: number;
  etaMs: number | null;
}

export interface FinalReport {
  totalBlocksMined: number;
  runtimeMs: number;
  averageBlocksPerMinute: number;
  repairsPerformed: number;
  deathCount: number;
  itemsCollected: Record<string, number>;
  finalPosition: Vector3;
}
