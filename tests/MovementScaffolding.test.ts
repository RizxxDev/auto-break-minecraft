import { describe, expect, it } from "vitest";
import { findScaffoldingItem } from "../src/infrastructure/minecraft/movements";

describe("movement scaffolding", () => {
  it("selects a preferred building block for upward scaffolding", () => {
    const bot = fakeBot([
      { name: "golden_carrot", count: 8 },
      { name: "cobbled_deepslate", count: 64 },
      { name: "diamond_pickaxe", count: 1 }
    ]);

    expect(findScaffoldingItem(bot)?.name).toBe("cobbled_deepslate");
  });

  it("does not use tools or food as scaffolding blocks", () => {
    const bot = fakeBot([
      { name: "golden_carrot", count: 8 },
      { name: "netherite_pickaxe", count: 1 }
    ]);

    expect(findScaffoldingItem(bot)).toBeNull();
  });
});

function fakeBot(items: unknown[]): any {
  return {
    inventory: {
      items: () => items
    },
    registry: {
      blocksByName: {}
    }
  };
}
