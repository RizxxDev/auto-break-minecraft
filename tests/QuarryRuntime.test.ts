import { describe, expect, it, vi } from "vitest";
import { QuarryRuntime } from "../src/application/QuarryRuntime";
import { createDefaultState } from "../src/application/createDefaultState";
import { QuarryPlanner } from "../src/services/QuarryPlanner";
import type { AppConfig } from "../src/domain/types";

describe("QuarryRuntime", () => {
  it("re-equips the best pickaxe after hazard handling before digging", async () => {
    const planner = new QuarryPlanner();
    const state = createDefaultState({ x: 0, y: 10, z: 0 }, { width: 2, height: 2, depth: 2 }, planner);
    const target = { x: 0, y: 10, z: 0 };
    const actions: string[] = [];

    const runtime = new QuarryRuntime(
      { username: "QuarryBot", health: 20, food: 20 },
      config(),
      {
        planner: {
          createBounds: planner.createBounds.bind(planner),
          getLayerY: planner.getLayerY.bind(planner),
          isInsideBounds: planner.isInsideBounds.bind(planner),
          getTargetRole: planner.getTargetRole.bind(planner),
          getNextTarget: vi.fn(async () => target),
          recordMined: planner.recordMined.bind(planner),
          calculateProgress: planner.calculateProgress.bind(planner),
          isComplete: planner.isComplete.bind(planner)
        },
        stateStore: {
          loadRuntimeState: vi.fn(),
          saveRuntimeState: vi.fn(),
          loadChestMemory: vi.fn(),
          saveChestMemory: vi.fn(),
          loadHazards: vi.fn(),
          saveHazards: vi.fn()
        },
        movement: {
          getPosition: vi.fn(() => ({ x: 0, y: 10, z: 0 })),
          getLastKnownPath: vi.fn(() => []),
          goNear: vi.fn(),
          dig: vi.fn(async () => {
            actions.push("dig");
            return true;
          })
        },
        safety: {
          isSafePosition: vi.fn(async () => true),
          canMineTarget: vi.fn(async () => true),
          rememberSafePosition: vi.fn(async (nextState) => nextState)
        },
        inventory: {
          getInventoryUsage: vi.fn(() => 0),
          getPickaxeDurabilityPercent: vi.fn(() => 1)
        },
        tools: {
          equipBestPickaxe: vi.fn(async () => {
            actions.push("equip");
            return { name: "netherite_pickaxe", count: 1 };
          })
        },
        food: { eatIfNeeded: vi.fn() },
        storage: { storeIfNeeded: vi.fn() },
        hazards: {
          inspectAndHandle: vi.fn(async () => {
            actions.push("hazard");
            return true;
          }),
          getHazards: vi.fn()
        },
        recovery: { recover: vi.fn() },
        orchestrator: {
          chooseTask: vi.fn(() => "QUARRY")
        },
        telemetry: {
          start: vi.fn(),
          stop: vi.fn(),
          sendAlert: vi.fn(),
          sendStatus: vi.fn(),
          sendError: vi.fn(),
          sendFinalReport: vi.fn()
        },
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn()
        }
      },
      state
    );

    await runtime.tick();

    expect(actions).toEqual(["equip", "hazard", "equip", "dig"]);
  });
});

function config(): AppConfig {
  return {
    bot: {
      host: "localhost",
      port: 25565,
      username: "QuarryBot",
      auth: "offline",
      version: null
    },
    quarry: { width: 2, height: 2, depth: 2 },
    discord: { webhookUrl: "" },
    thresholds: {
      inventoryUsage: 0.9,
      durabilityLow: 0.1,
      durabilityRepaired: 0.9,
      hungerLow: 14,
      healthLow: 10,
      stuckTimeoutMs: 10_000,
      statusIntervalMs: 60_000,
      chestScanRadius: 32
    },
    paths: {
      dataDir: "./data",
      logDir: "./logs"
    }
  };
}
