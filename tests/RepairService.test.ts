import { describe, expect, it, vi } from "vitest";
import { RepairService } from "../src/services/RepairService";

describe("RepairService", () => {
  it("moves pickaxe to off-hand, throws XP bottles from main hand, then restores pickaxe to main hand", async () => {
    const actions: string[] = [];
    const bot = {
      entity: { yaw: 0 },
      equip: vi.fn(async (item: any, destination: string) => {
        actions.push(`equip:${item.name}:${destination}`);
      }),
      look: vi.fn(async () => {
        actions.push("look-down");
      }),
      activateItem: vi.fn(() => {
        actions.push("throw-xp");
      })
    };
    const inventory = {
      needsRepair: vi.fn(() => true),
      getPickaxeDurabilityPercent: vi.fn()
        .mockReturnValueOnce(0.05)
        .mockReturnValueOnce(0.05)
        .mockReturnValueOnce(0.95)
        .mockReturnValueOnce(0.95)
        .mockReturnValueOnce(0.95)
    };
    const toolService = {
      equipBestPickaxe: vi.fn(async (destination = "hand") => {
        actions.push(`pickaxe:${destination}`);
        return { name: "netherite_pickaxe", count: 1 };
      })
    };
    const repair = new RepairService(
      bot,
      inventory as any,
      toolService as any,
      { findSupplyChest: vi.fn() } as any,
      thresholds(),
      telemetry() as any,
      logger() as any
    );

    vi.spyOn(repair as any, "findXpBottle").mockReturnValue({ name: "experience_bottle", count: 1 });

    await expect(repair.repairIfNeeded()).resolves.toBe(true);

    expect(actions).toEqual([
      "pickaxe:off-hand",
      "equip:experience_bottle:hand",
      "look-down",
      "throw-xp",
      "pickaxe:hand"
    ]);
  });

  it("restores pickaxe to main hand when XP bottles are unavailable", async () => {
    const actions: string[] = [];
    const repair = new RepairService(
      { entity: { yaw: 0 }, equip: vi.fn(), look: vi.fn(), activateItem: vi.fn() },
      {
        needsRepair: vi.fn(() => true),
        getPickaxeDurabilityPercent: vi.fn(() => 0.05)
      } as any,
      {
        equipBestPickaxe: vi.fn(async (destination = "hand") => {
          actions.push(`pickaxe:${destination}`);
          return { name: "diamond_pickaxe", count: 1 };
        })
      } as any,
      { findSupplyChest: vi.fn(async () => null) } as any,
      thresholds(),
      telemetry() as any,
      logger() as any
    );

    await expect(repair.repairIfNeeded()).resolves.toBe(false);

    expect(actions).toEqual(["pickaxe:off-hand", "pickaxe:hand"]);
  });
});

function thresholds(): any {
  return {
    durabilityLow: 0.1,
    durabilityRepaired: 0.9
  };
}

function telemetry(): any {
  return {
    sendAlert: vi.fn()
  };
}

function logger(): any {
  return {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  };
}
