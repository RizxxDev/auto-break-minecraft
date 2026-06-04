import type { ILogger, IToolService } from "../domain/interfaces";
import type { ItemSnapshot } from "../domain/types";
import { patchBotDigTime } from "../infrastructure/minecraft/enchantments";
import { InventoryService } from "./InventoryService";

export class ToolService implements IToolService {
  constructor(
    private readonly bot: any,
    private readonly inventory: InventoryService,
    private readonly logger: ILogger
  ) {}

  async equipBestPickaxe(destination: "hand" | "off-hand" = "hand"): Promise<ItemSnapshot | null> {
    const pickaxe = this.inventory.getBestPickaxe();
    if (!pickaxe) {
      this.logger.warn("No pickaxe found in inventory");
      return null;
    }

    const item = this.findRawItem(pickaxe);
    if (!item) {
      return pickaxe;
    }

    await this.bot.equip(item, destination);
    patchBotDigTime(this.bot);
    this.logger.info("Equipped best pickaxe", { pickaxe: pickaxe.name, destination });
    return pickaxe;
  }

  private findRawItem(snapshot: ItemSnapshot): any | null {
    const items = typeof this.bot.inventory?.items === "function" ? this.bot.inventory.items() : [];
    return items.find((item: any) => item.slot === snapshot.slot || item.name === snapshot.name) ?? null;
  }
}
