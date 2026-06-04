import { BUILDING_BLOCK_HINTS } from "../../domain/constants";

export function createSafeMovements(bot: any): any {
  const pathfinderModule = require("mineflayer-pathfinder");
  const movements = new pathfinderModule.Movements(bot);

  movements.allow1by1towers = true;
  movements.canDig = false;
  movements.scafoldingBlocks = getScaffoldingItemIds(bot);

  return movements;
}

export function findScaffoldingItem(bot: any): any | null {
  const items = typeof bot.inventory?.items === "function" ? bot.inventory.items() : [];
  return (
    items.find((item: any) => BUILDING_BLOCK_HINTS.some((hint) => item.name.includes(hint))) ??
    items.find((item: any) => isSolidPlaceableItem(bot, item.name)) ??
    null
  );
}

function getScaffoldingItemIds(bot: any): number[] {
  const registryItems = bot.registry?.itemsByName ?? {};
  const ids = BUILDING_BLOCK_HINTS.flatMap((hint) =>
    Object.values(registryItems)
      .filter((item: any) => item.name.includes(hint))
      .map((item: any) => item.id)
  );

  return [...new Set(ids.filter((id) => typeof id === "number"))];
}

function isSolidPlaceableItem(bot: any, itemName: string): boolean {
  const block = bot.registry?.blocksByName?.[itemName];
  return Boolean(block && block.boundingBox !== "empty" && block.name !== "sand" && block.name !== "gravel");
}
