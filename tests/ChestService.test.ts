import { describe, expect, it, vi } from "vitest";
import { ChestService, classifyChest } from "../src/services/ChestService";

describe("classifyChest", () => {
  it("classifies supply chests from XP, food, and tools", () => {
    expect(classifyChest([{ name: "experience_bottle", count: 8 }])).toBe("SUPPLY_CHEST");
    expect(classifyChest([{ name: "golden_carrot", count: 16 }])).toBe("SUPPLY_CHEST");
    expect(classifyChest([{ name: "netherite_pickaxe", count: 1 }])).toBe("SUPPLY_CHEST");
  });

  it("classifies storage chests from quarry output", () => {
    expect(classifyChest([{ name: "cobbled_deepslate", count: 64 }])).toBe("STORAGE_CHEST");
    expect(classifyChest([{ name: "diamond_ore", count: 4 }])).toBe("STORAGE_CHEST");
  });

  it("leaves unrelated containers unknown", () => {
    expect(classifyChest([{ name: "oak_sapling", count: 3 }])).toBe("UNKNOWN");
  });

  it("uses a valid unknown chest as emergency storage fallback", async () => {
    const memory = {
      supplyChests: [],
      storageChests: [],
      unknownChests: [
        {
          id: "1,2,3",
          kind: "UNKNOWN" as const,
          position: { x: 1, y: 2, z: 3 },
          lastSeenAt: new Date().toISOString(),
          reachable: true,
          itemNames: []
        }
      ]
    };
    const savedMemories: unknown[] = [];
    const service = new ChestService(
      {
        blockAt: vi.fn(() => ({ name: "chest" })),
        findBlocks: vi.fn(() => [])
      },
      {
        canReach: vi.fn(async () => true),
        goNear: vi.fn()
      } as any,
      {
        loadChestMemory: vi.fn(async () => memory),
        saveChestMemory: vi.fn(async (nextMemory: unknown) => {
          savedMemories.push(nextMemory);
        })
      } as any,
      { chestScanRadius: 32 } as any,
      { sendAlert: vi.fn() } as any,
      logger()
    );

    const chest = await service.findStorageChest();

    expect(chest?.kind).toBe("STORAGE_CHEST");
    expect(chest?.id).toBe("1,2,3");
    expect((savedMemories.at(-1) as any).storageChests).toHaveLength(1);
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
