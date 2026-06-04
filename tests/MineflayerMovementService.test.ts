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
      canDigBlock: vi.fn(() => true),
      equip: vi.fn(async (item: any) => {
        actions.push(`equip:${item.name}`);
        bot.heldItem = item;
      }),
      dig: vi.fn(async () => {
        actions.push(`dig:${bot.heldItem.name}`);
      })
    };

    const service = new MineflayerMovementService(bot, logger());

    await expect(service.dig({ x: 1, y: 10, z: 0 })).resolves.toBe(true);

    expect(actions).toEqual(["equip:diamond_pickaxe", "dig:diamond_pickaxe"]);
  });

  it("returns false instead of throwing when pathfinder cannot reach a target", async () => {
    const bot: any = {
      heldItem: { name: "stone", slot: 36 },
      entity: { position: { x: 0, y: 10, z: 0 } },
      inventory: { items: () => [] },
      pathfinder: {
        setMovements: vi.fn(),
        goto: vi.fn(async () => {
          throw new Error("Took to long to decide path to goal!");
        })
      },
      registry: { blocksByName: {}, blocksArray: [], itemsByName: {} },
      blockAt: vi.fn(() => ({ name: "stone", diggable: true })),
      canDigBlock: vi.fn(() => false),
      dig: vi.fn()
    };
    const service = new MineflayerMovementService(bot, logger());

    await expect(service.dig({ x: 30, y: 10, z: 30 })).resolves.toBe(false);
    expect(bot.dig).not.toHaveBeenCalled();
  });

  it("uses a torch trick after breaking gravel and restores the pickaxe", async () => {
    const actions: string[] = [];
    const pickaxe = { name: "diamond_pickaxe", slot: 37, maxDurability: 1561, durabilityUsed: 10 };
    const torch = { name: "torch", slot: 38 };
    const supportBlock = { name: "stone", boundingBox: "block" };
    const bot: any = {
      heldItem: pickaxe,
      entity: { position: { x: 0, y: 10, z: 0 } },
      inventory: {
        items: () => [pickaxe, torch]
      },
      pathfinder: {
        setMovements: vi.fn(),
        goto: vi.fn()
      },
      registry: { blocksByName: {}, blocksArray: [], itemsByName: {} },
      blockAt: vi.fn((position: any) => {
        if (position.y === 9) {
          return supportBlock;
        }
        return { name: "gravel", diggable: true };
      }),
      canDigBlock: vi.fn(() => true),
      equip: vi.fn(async (item: any) => {
        actions.push(`equip:${item.name}`);
        bot.heldItem = item;
      }),
      dig: vi.fn(async () => {
        actions.push("dig:gravel");
      }),
      placeBlock: vi.fn(async () => {
        actions.push(`place:${bot.heldItem.name}`);
      })
    };
    const service = new MineflayerMovementService(bot, logger());

    await expect(service.dig({ x: 0, y: 10, z: 0 })).resolves.toBe(true);

    expect(actions).toEqual(["dig:gravel", "equip:torch", "place:torch", "equip:diamond_pickaxe"]);
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
