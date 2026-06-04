import { FOOD_PRIORITY, PICKAXE_PRIORITY, XP_BOTTLE_NAMES } from "../domain/constants";
import type { IInventoryService } from "../domain/interfaces";
import type { ItemSnapshot } from "../domain/types";

export class InventoryService implements IInventoryService {
  constructor(private readonly bot: any) {}

  getItems(): ItemSnapshot[] {
    return getCarriedItems(this.bot).map(normalizeItem);
  }

  getInventoryUsage(): number {
    const slots = this.bot.inventory?.slots as unknown[] | undefined;
    if (!slots || slots.length === 0) {
      return 0;
    }

    const inventorySlots = slots.slice(9, 45);
    const used = inventorySlots.filter(Boolean).length;
    return used / inventorySlots.length;
  }

  getBestPickaxe(): ItemSnapshot | null {
    const pickaxes = this.getItems().filter((item) => item.name.endsWith("_pickaxe"));
    if (pickaxes.length === 0) {
      return null;
    }
    return pickaxes.sort(comparePickaxes)[0] ?? null;
  }

  getPickaxeDurabilityPercent(): number | null {
    const pickaxe = this.getBestPickaxe();
    if (!pickaxe?.maxDurability) {
      return null;
    }
    const remaining = pickaxe.maxDurability - (pickaxe.durabilityUsed ?? 0);
    return Math.max(0, Math.min(1, remaining / pickaxe.maxDurability));
  }

  hasFood(): boolean {
    const names = new Set(this.getItems().map((item) => item.name));
    return FOOD_PRIORITY.some((food) => names.has(food));
  }

  hasXpBottle(): boolean {
    const names = new Set(this.getItems().map((item) => item.name));
    return XP_BOTTLE_NAMES.some((name) => names.has(name));
  }

  needsStorage(threshold: number): boolean {
    return this.getInventoryUsage() >= threshold;
  }

  needsRepair(threshold: number): boolean {
    const durability = this.getPickaxeDurabilityPercent();
    return durability !== null && durability < threshold;
  }

  needsFood(hunger: number, hungerLow: number): boolean {
    return hunger <= hungerLow && this.hasFood();
  }
}

export function getCarriedItems(bot: any): any[] {
  const items: any[] = [];
  const seen = new Set<string>();

  const add = (item: any): void => {
    if (!item?.name) {
      return;
    }
    const key = `${item.slot ?? "no-slot"}:${item.name}:${item.type ?? ""}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    items.push(item);
  };

  if (typeof bot.inventory?.items === "function") {
    for (const item of bot.inventory.items()) {
      add(item);
    }
  }

  for (const item of bot.inventory?.slots ?? []) {
    add(item);
  }

  add(bot.heldItem);
  return items;
}

export function normalizeItem(item: any): ItemSnapshot {
  const enchantments = extractEnchantments(item);
  return {
    name: item.name,
    count: item.count ?? 1,
    type: item.type,
    metadata: item.metadata,
    slot: item.slot,
    maxDurability: item.maxDurability,
    durabilityUsed: item.durabilityUsed,
    enchantments
  };
}

function comparePickaxes(a: ItemSnapshot, b: ItemSnapshot): number {
  const materialScore = scorePickaxe(b) - scorePickaxe(a);
  if (materialScore !== 0) {
    return materialScore;
  }

  const efficiencyScore = (b.enchantments?.efficiency ?? 0) - (a.enchantments?.efficiency ?? 0);
  if (efficiencyScore !== 0) {
    return efficiencyScore;
  }

  return durabilityScore(b) - durabilityScore(a);
}

function scorePickaxe(item: ItemSnapshot): number {
  const priority = PICKAXE_PRIORITY.indexOf(item.name);
  return priority === -1 ? -1 : PICKAXE_PRIORITY.length - priority;
}

function durabilityScore(item: ItemSnapshot): number {
  if (!item.maxDurability) {
    return 0;
  }
  return item.maxDurability - (item.durabilityUsed ?? 0);
}

function extractEnchantments(item: any): Record<string, number> {
  const enchantments: Record<string, number> = {};
  const enchants = item.enchants ?? item.enchantments ?? item.nbt?.value?.Enchantments?.value?.value;
  if (!Array.isArray(enchants)) {
    return enchantments;
  }

  for (const enchantment of enchants) {
    const rawName = enchantment.name ?? enchantment.id ?? enchantment.id?.value;
    const rawLevel = enchantment.lvl ?? enchantment.level ?? enchantment.lvl?.value;
    if (rawName) {
      enchantments[String(rawName).replace("minecraft:", "")] = Number(rawLevel ?? 1);
    }
  }
  return enchantments;
}
