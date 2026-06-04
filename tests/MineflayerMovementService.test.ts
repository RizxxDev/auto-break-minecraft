import { describe, expect, it, vi } from "vitest";
import { MineflayerMovementService } from "../src/infrastructure/minecraft/MineflayerMovementService";

vi.mock("../src/infrastructure/minecraft/movements", () => ({
  createSafeMovements: vi.fn(() => ({})),
  findScaffoldingItem: vi.fn(() => null)
}));

describe("MineflayerMovementService", () => {
  it("equips a pickaxe immediately before digging when another item is held", async () => {
    const actions: string[] = [];
    const stone = { name: "stone", slot: 36 };
    const pickaxe = { name: "diamond_pickaxe", slot: 37, maxDurability: 1561, durabilityUsed: 10 };
    const bot: any = {
      heldItem: stone,
      entity: {
        position: { x: 0, y: 10, z: 0 }
      },
      inventory: {
        items: () => [stone, pickaxe]
      },
      pathfinder: {
        setMovements: vi.fn(),
        goto: vi.fn()
      },
      registry: {
        blocksByName: {
          air: { id: 0 },
          cave_air: { id: 1 },
          void_air: { id: 2 },
          water: { id: 3 },
          lava: { id: 4 },
          fire: { id: 5 },
          chest: { id: 6 },
          sand: { id: 7 },
          gravel: { id: 8 },
          dirt: { id: 9 },
          cobblestone: { id: 10 },
          ladder: { id: 11 }
        },
        blocksArray: [],
        itemsByName: {
          dirt: { id: 9, name: "dirt" },
          cobblestone: { id: 10, name: "cobblestone" }
        }
      },
      blockAt: vi.fn(() => ({ name: "stone", diggable: true })),
      equip: vi.fn(async (item: any) => {
        actions.push(`equip:${item.name}`);
        bot.heldItem = item;
      }),
      dig: vi.fn(async () => {
        actions.push(`dig:${bot.heldItem.name}`);
      })
    };

    const service = new MineflayerMovementService(bot, logger());

    await service.dig({ x: 1, y: 10, z: 0 });

    expect(actions).toEqual(["equip:diamond_pickaxe", "dig:diamond_pickaxe"]);
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
