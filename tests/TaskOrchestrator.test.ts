import { describe, expect, it } from "vitest";
import { TaskOrchestrator } from "../src/application/TaskOrchestrator";
import type { ThresholdConfig } from "../src/domain/types";

describe("TaskOrchestrator", () => {
  const thresholds: ThresholdConfig = {
    inventoryUsage: 0.9,
    durabilityLow: 0.1,
    durabilityRepaired: 0.9,
    hungerLow: 14,
    healthLow: 10,
    stuckTimeoutMs: 10_000,
    statusIntervalMs: 60_000,
    chestScanRadius: 32
  };

  it("prioritizes survival before other tasks", () => {
    const orchestrator = new TaskOrchestrator(thresholds);

    expect(
      orchestrator.chooseTask({
        health: 4,
        hunger: 4,
        inventoryUsage: 1,
        durability: 0.01,
        currentTask: "QUARRY"
      })
    ).toBe("SURVIVE");
  });

  it("selects storage and repair thresholds", () => {
    const orchestrator = new TaskOrchestrator(thresholds);

    expect(
      orchestrator.chooseTask({
        health: 20,
        hunger: 20,
        inventoryUsage: 0.2,
        durability: 0.05,
        currentTask: "QUARRY"
      })
    ).toBe("REPAIR");

    expect(
      orchestrator.chooseTask({
        health: 20,
        hunger: 20,
        inventoryUsage: 0.95,
        durability: 0.5,
        currentTask: "QUARRY"
      })
    ).toBe("STORE_ITEMS");
  });

  it("preserves waiting and completed terminal states", () => {
    const orchestrator = new TaskOrchestrator(thresholds);

    expect(
      orchestrator.chooseTask({
        health: 20,
        hunger: 20,
        inventoryUsage: 0,
        durability: 1,
        currentTask: "WAIT_FOR_STORAGE"
      })
    ).toBe("WAIT_FOR_STORAGE");
  });
});
