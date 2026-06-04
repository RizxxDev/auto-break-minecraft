import { describe, expect, it } from "vitest";
import { classifyChest } from "../src/services/ChestService";

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
});
