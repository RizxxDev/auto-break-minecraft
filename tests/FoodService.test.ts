import { describe, expect, it, vi } from "vitest";
import { FoodService } from "../src/services/FoodService";

describe("FoodService", () => {
  it("panic eats for health regeneration when health is not full and hunger allows eating", async () => {
    const actions: string[] = [];
    const food = { name: "golden_carrot", count: 1 };
    const bot: any = {
      health: 19,
      food: 18,
      inventory: {
        items: () => [food]
      },
      equip: vi.fn(async (item: any, destination: string) => {
        actions.push(`equip:${item.name}:${destination}`);
      }),
      consume: vi.fn(async () => {
        actions.push("consume");
      })
    };
    const service = new FoodService(bot, logger());

    await expect(service.eatIfNeeded()).resolves.toBe(true);
    expect(actions).toEqual(["equip:golden_carrot:hand", "consume"]);
  });

  it("does not try to eat for minor damage when hunger is already full", async () => {
    const bot: any = {
      health: 19,
      food: 20,
      inventory: {
        items: () => [{ name: "golden_carrot", count: 1 }]
      },
      equip: vi.fn(),
      consume: vi.fn()
    };
    const service = new FoodService(bot, logger());

    await expect(service.eatIfNeeded()).resolves.toBe(false);
    expect(bot.consume).not.toHaveBeenCalled();
  });
});

function logger(): any {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  };
}
