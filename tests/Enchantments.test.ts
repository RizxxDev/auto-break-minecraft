import { describe, expect, it } from "vitest";
import { getBotDigEnchantments, normalizeEnchantments, patchBotDigTime } from "../src/infrastructure/minecraft/enchantments";

describe("enchantment normalization", () => {
  it("keeps iterable enchant arrays compatible with prismarine-block", () => {
    expect(normalizeEnchantments([{ name: "minecraft:efficiency", lvl: 5 }])).toEqual([{ name: "efficiency", lvl: 5 }]);
  });

  it("converts object-shaped enchantments to iterable mineflayer enchantments", () => {
    expect(normalizeEnchantments({ efficiency: 5, unbreaking: 3 })).toEqual([
      { name: "efficiency", lvl: 5 },
      { name: "unbreaking", lvl: 3 }
    ]);
  });

  it("reads held and helmet item enchantments without assigning through prismarine-item setters", () => {
    const helmet = { name: "diamond_helmet" };
    const bot: any = {
      heldItem: { name: "netherite_pickaxe", enchants: { efficiency: 5 } },
      inventory: { slots: { 5: helmet } },
      getEquipmentDestSlot: () => 5
    };

    expect(getBotDigEnchantments(bot)).toEqual([{ name: "efficiency", lvl: 5 }]);
    expect(bot.heldItem.enchants).toEqual({ efficiency: 5 });
    expect(helmet.enchants).toBeUndefined();
  });

  it("patches bot.digTime to pass iterable enchantments to block.digTime", () => {
    const bot: any = {
      heldItem: { type: 1, enchants: { efficiency: 5 } },
      inventory: { slots: {} },
      entity: { onGround: true, effects: {} },
      game: { gameMode: "survival" },
      getEquipmentDestSlot: () => 5,
      _getBlockAtEyeLevel: () => ({ name: "air" })
    };
    const block = {
      digTime: (_type: number, _creative: boolean, _inWater: boolean, _notOnGround: boolean, enchantments: unknown) => {
        expect(enchantments).toEqual([{ name: "efficiency", lvl: 5 }]);
        return 123;
      }
    };

    patchBotDigTime(bot);

    expect(bot.digTime(block)).toBe(123);
  });
});
