import { describe, expect, it } from "vitest";
import { InventoryService } from "../src/services/InventoryService";

describe("InventoryService", () => {
  it("selects netherite pickaxe over lower materials", () => {
    const service = new InventoryService(fakeBot([
      { name: "iron_pickaxe", count: 1, maxDurability: 250, durabilityUsed: 1, slot: 10 },
      { name: "netherite_pickaxe", count: 1, maxDurability: 2031, durabilityUsed: 100, slot: 11 }
    ]));

    expect(service.getBestPickaxe()?.name).toBe("netherite_pickaxe");
  });

  it("detects low durability and inventory fullness", () => {
    const bot = fakeBot([{ name: "diamond_pickaxe", count: 1, maxDurability: 100, durabilityUsed: 95, slot: 10 }]);
    bot.inventory.slots = Array.from({ length: 45 }, (_, index) => (index >= 9 && index < 42 ? { name: "stone" } : null));
    const service = new InventoryService(bot);

    expect(service.getPickaxeDurabilityPercent()).toBe(0.05);
    expect(service.needsRepair(0.1)).toBe(true);
    expect(service.needsStorage(0.9)).toBe(true);
  });

  it("detects a pickaxe carried in the off-hand slot", () => {
    const bot = fakeBot([]);
    bot.inventory.slots[45] = {
      name: "diamond_pickaxe",
      count: 1,
      maxDurability: 100,
      durabilityUsed: 20,
      slot: 45
    };
    const service = new InventoryService(bot);

    expect(service.getBestPickaxe()?.name).toBe("diamond_pickaxe");
    expect(service.getPickaxeDurabilityPercent()).toBe(0.8);
  });
});

function fakeBot(items: unknown[]): any {
  return {
    inventory: {
      slots: Array.from({ length: 45 }, () => null),
      items: () => items
    }
  };
}
