import { FOOD_PRIORITY, PICKAXE_PRIORITY, XP_BOTTLE_NAMES } from "../domain/constants";
import type { IChestService, ILogger, IMovementService, IStorageService, ITelemetryService } from "../domain/interfaces";
import type { ThresholdConfig, Vector3 } from "../domain/types";
import { InventoryService } from "./InventoryService";

export class StorageService implements IStorageService {
  constructor(
    private readonly bot: any,
    private readonly inventory: InventoryService,
    private readonly chestService: IChestService,
    private readonly movement: IMovementService,
    private readonly thresholds: ThresholdConfig,
    private readonly telemetry: ITelemetryService,
    private readonly logger: ILogger
  ) {}

  async storeIfNeeded(lastWorkPosition?: Vector3): Promise<"STORED" | "NOT_NEEDED" | "NO_STORAGE"> {
    if (!this.inventory.needsStorage(this.thresholds.inventoryUsage)) {
      return "NOT_NEEDED";
    }

    await this.telemetry.sendAlert("Inventory penuh", {
      inventoryUsage: this.inventory.getInventoryUsage()
    });

    const storageChest = await this.chestService.findStorageChest();
    if (!storageChest) {
      await this.telemetry.sendAlert("Storage penuh");
      return "NO_STORAGE";
    }

    await this.movement.goNear(storageChest.position, 2);
    const block = this.bot.blockAt?.(toVec3(storageChest.position));
    const chest = await this.bot.openContainer(block);
    const items = typeof this.bot.inventory?.items === "function" ? this.bot.inventory.items() : [];

    for (const item of items) {
      if (shouldKeepItem(item.name)) {
        continue;
      }
      try {
        await chest.deposit(item.type, item.metadata, item.count);
      } catch (error) {
        this.logger.warn("Failed to deposit item", {
          item: item.name,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    chest.close();

    if (lastWorkPosition) {
      await this.movement.goNear(lastWorkPosition, 2);
    }

    return "STORED";
  }
}

function shouldKeepItem(name: string): boolean {
  return PICKAXE_PRIORITY.includes(name) || FOOD_PRIORITY.includes(name) || XP_BOTTLE_NAMES.includes(name);
}

function toVec3(position: Vector3): any {
  const { Vec3 } = require("vec3");
  return new Vec3(position.x, position.y, position.z);
}
