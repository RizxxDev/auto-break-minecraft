import { XP_BOTTLE_NAMES } from "../domain/constants";
import type { IChestService, ILogger, IRepairService, ITelemetryService } from "../domain/interfaces";
import type { ThresholdConfig } from "../domain/types";
import { sleep } from "../utils/sleep";
import { InventoryService } from "./InventoryService";
import { ToolService } from "./ToolService";

export class RepairService implements IRepairService {
  constructor(
    private readonly bot: any,
    private readonly inventory: InventoryService,
    private readonly toolService: ToolService,
    private readonly chestService: IChestService,
    private readonly thresholds: ThresholdConfig,
    private readonly telemetry: ITelemetryService,
    private readonly logger: ILogger
  ) {}

  async repairIfNeeded(): Promise<boolean> {
    if (!this.inventory.needsRepair(this.thresholds.durabilityLow)) {
      return false;
    }

    await this.telemetry.sendAlert("Repair dimulai", {
      durability: this.inventory.getPickaxeDurabilityPercent()
    });
    await this.toolService.equipBestPickaxe();

    let attempts = 0;
    while ((this.inventory.getPickaxeDurabilityPercent() ?? 1) < this.thresholds.durabilityRepaired) {
      const bottle = this.findXpBottle();
      if (!bottle) {
        const supplyChest = await this.chestService.findSupplyChest();
        if (!supplyChest) {
          await this.telemetry.sendAlert("XP Bottle habis");
          this.logger.warn("Repair stopped because XP bottles are unavailable");
          return false;
        }
        await this.telemetry.sendAlert("XP Bottle habis", { supplyChest: supplyChest.id });
        return false;
      }

      await this.bot.equip(bottle, "hand");
      await this.bot.look(this.bot.entity.yaw, -Math.PI / 2, true);
      this.bot.activateItem();
      await sleep(900);

      attempts += 1;
      if (attempts > 128) {
        this.logger.warn("Repair attempt limit reached");
        break;
      }
    }

    await this.toolService.equipBestPickaxe();
    await this.telemetry.sendAlert("Repair selesai", {
      durability: this.inventory.getPickaxeDurabilityPercent()
    });
    return true;
  }

  private findXpBottle(): any | null {
    const items = typeof this.bot.inventory?.items === "function" ? this.bot.inventory.items() : [];
    return items.find((item: any) => XP_BOTTLE_NAMES.includes(item.name)) ?? null;
  }
}
