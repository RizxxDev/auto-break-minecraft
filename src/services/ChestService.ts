import { CHEST_BLOCK_NAMES, STORAGE_ITEM_HINTS, SUPPLY_ITEM_HINTS } from "../domain/constants";
import type { IChestService, ILogger, IMovementService, IStateStore, ITelemetryService } from "../domain/interfaces";
import type { ChestKind, ChestMemory, ChestRecord, ItemSnapshot, ThresholdConfig, Vector3 } from "../domain/types";
import { normalizeItem } from "./InventoryService";
import { formatVector, vectorKey } from "../utils/vector";

export class ChestService implements IChestService {
  private memory?: ChestMemory;

  constructor(
    private readonly bot: any,
    private readonly movement: IMovementService,
    private readonly stateStore: IStateStore,
    private readonly thresholds: ThresholdConfig,
    private readonly telemetry: ITelemetryService,
    private readonly logger: ILogger
  ) {}

  async discoverChests(): Promise<ChestMemory> {
    const memory = await this.getMemory();
    const positions = this.findChestPositions();

    for (const position of positions) {
      const id = vectorKey(position);
      if (findChestById(memory, id)) {
        continue;
      }

      const reachable = await this.movement.canReach(position, 2);
      const itemNames = reachable ? await this.inspectChestItems(position) : [];
      const kind = classifyChest(itemNames.map((name) => ({ name, count: 1 })));
      const record: ChestRecord = {
        id,
        kind,
        position,
        lastSeenAt: new Date().toISOString(),
        reachable,
        itemNames
      };
      addChest(memory, record);
      await this.telemetry.sendAlert("Chest baru ditemukan", {
        kind,
        position: formatVector(position)
      });
    }

    await this.stateStore.saveChestMemory(memory);
    this.memory = memory;
    return memory;
  }

  async getMemory(): Promise<ChestMemory> {
    if (!this.memory) {
      this.memory = await this.stateStore.loadChestMemory();
    }
    return this.memory;
  }

  async validateChest(chest: ChestRecord): Promise<boolean> {
    const block = this.bot.blockAt?.(toVec3(chest.position));
    const exists = block && CHEST_BLOCK_NAMES.includes(block.name);
    const reachable = exists ? await this.movement.canReach(chest.position, 2) : false;
    if (!exists || !reachable) {
      await this.markChestInvalid(chest);
      return false;
    }
    return true;
  }

  async findSupplyChest(): Promise<ChestRecord | null> {
    const memory = await this.getMemory();
    return this.findValid(memory.supplyChests);
  }

  async findStorageChest(): Promise<ChestRecord | null> {
    const memory = await this.getMemory();
    const knownStorage = await this.findValid(memory.storageChests);
    if (knownStorage) {
      return knownStorage;
    }

    await this.discoverChests();
    const refreshedMemory = await this.getMemory();
    const refreshedStorage = await this.findValid(refreshedMemory.storageChests);
    if (refreshedStorage) {
      return refreshedStorage;
    }

    const fallback = await this.findValid(refreshedMemory.unknownChests);
    if (!fallback) {
      return null;
    }

    await this.promoteToStorage(fallback);
    return { ...fallback, kind: "STORAGE_CHEST" };
  }

  async markChestInvalid(chest: ChestRecord): Promise<void> {
    const memory = await this.getMemory();
    memory.supplyChests = memory.supplyChests.filter((candidate) => candidate.id !== chest.id);
    memory.storageChests = memory.storageChests.filter((candidate) => candidate.id !== chest.id);
    memory.unknownChests = memory.unknownChests.filter((candidate) => candidate.id !== chest.id);
    await this.stateStore.saveChestMemory(memory);
    this.logger.warn("Removed invalid chest from memory", { chest: chest.id });
  }

  private async findValid(chests: ChestRecord[]): Promise<ChestRecord | null> {
    for (const chest of chests) {
      if (await this.validateChest(chest)) {
        return chest;
      }
    }
    return null;
  }

  private async promoteToStorage(chest: ChestRecord): Promise<void> {
    const memory = await this.getMemory();
    memory.unknownChests = memory.unknownChests.filter((candidate) => candidate.id !== chest.id);
    if (!memory.storageChests.some((candidate) => candidate.id === chest.id)) {
      memory.storageChests.push({
        ...chest,
        kind: "STORAGE_CHEST",
        lastSeenAt: new Date().toISOString()
      });
    }
    await this.stateStore.saveChestMemory(memory);
    await this.telemetry.sendAlert("Unknown chest dipakai sebagai storage", {
      position: formatVector(chest.position)
    });
  }

  private findChestPositions(): Vector3[] {
    if (typeof this.bot.findBlocks !== "function") {
      return [];
    }
    const positions = this.bot.findBlocks({
      matching: (block: any) => CHEST_BLOCK_NAMES.includes(block.name),
      maxDistance: this.thresholds.chestScanRadius,
      count: 256
    });
    return positions.map((position: any) => ({ x: position.x, y: position.y, z: position.z }));
  }

  private async inspectChestItems(position: Vector3): Promise<string[]> {
    try {
      await this.movement.goNear(position, 2);
      const block = this.bot.blockAt?.(toVec3(position));
      const chest = await this.bot.openContainer(block);
      const names = chest.containerItems().map((item: any) => normalizeItem(item).name);
      chest.close();
      return names;
    } catch (error) {
      this.logger.warn("Unable to inspect chest", {
        position: formatVector(position),
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }
}

export function classifyChest(items: ItemSnapshot[]): ChestKind {
  const names = items.map((item) => item.name);
  if (names.some((name) => SUPPLY_ITEM_HINTS.some((hint) => name.includes(hint)))) {
    return "SUPPLY_CHEST";
  }
  if (names.some((name) => STORAGE_ITEM_HINTS.some((hint) => name.includes(hint)))) {
    return "STORAGE_CHEST";
  }
  return "UNKNOWN";
}

function addChest(memory: ChestMemory, chest: ChestRecord): void {
  if (chest.kind === "SUPPLY_CHEST") {
    memory.supplyChests.push(chest);
    return;
  }
  if (chest.kind === "STORAGE_CHEST") {
    memory.storageChests.push(chest);
    return;
  }
  memory.unknownChests.push(chest);
}

function findChestById(memory: ChestMemory, id: string): ChestRecord | null {
  return (
    memory.supplyChests.find((chest) => chest.id === id) ??
    memory.storageChests.find((chest) => chest.id === id) ??
    memory.unknownChests.find((chest) => chest.id === id) ??
    null
  );
}

function toVec3(position: Vector3): any {
  const { Vec3 } = require("vec3");
  return new Vec3(position.x, position.y, position.z);
}
