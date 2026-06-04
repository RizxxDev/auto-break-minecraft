import { describe, expect, it } from "vitest";
import { createDefaultState } from "../src/application/createDefaultState";
import { QuarryPlanner } from "../src/services/QuarryPlanner";

describe("QuarryPlanner", () => {
  it("creates bounds downward from the login origin", () => {
    const planner = new QuarryPlanner();
    const bounds = planner.createBounds({ x: 10.8, y: 64.2, z: -4.1 }, { width: 30, height: 30, depth: 30 });

    expect(bounds.origin).toEqual({ x: 10, y: 64, z: -5 });
    expect(bounds.min).toEqual({ x: 10, y: 35, z: -5 });
    expect(bounds.max).toEqual({ x: 39, y: 64, z: 24 });
    expect(bounds.totalBlocks).toBe(27_000);
  });

  it("selects top layer before lower layers", async () => {
    const planner = new QuarryPlanner();
    const state = createDefaultState({ x: 0, y: 10, z: 0 }, { width: 2, height: 2, depth: 2 }, planner);
    const first = await planner.getNextTarget(state, { x: 0, y: 10, z: 0 }, async () => true);

    expect(first?.y).toBe(10);

    const nextState = {
      ...state,
      completedBlockKeys: ["0,10,0", "0,10,1", "1,10,0", "1,10,1"],
      currentLayer: 1
    };
    const second = await planner.getNextTarget(nextState, { x: 0, y: 10, z: 0 }, async () => true);

    expect(second?.y).toBe(9);
  });

  it("mines like a player by clearing head then feet before moving to the next cell", async () => {
    const planner = new QuarryPlanner();
    let state = createDefaultState({ x: 0, y: 10, z: 0 }, { width: 2, height: 2, depth: 2 }, planner);

    const first = await planner.getNextTarget(state, { x: 0, y: 10, z: 0 }, async () => true);
    expect(first).toEqual({ x: 0, y: 10, z: 0 });
    expect(planner.getTargetRole(state, first!)).toBe("HEAD");

    state = planner.recordMined(state, first!);
    const second = await planner.getNextTarget(state, { x: 0, y: 10, z: 0 }, async () => true);
    expect(second).toEqual({ x: 0, y: 9, z: 0 });
    expect(planner.getTargetRole(state, second!)).toBe("FEET");

    state = planner.recordMined(state, second!);
    const third = await planner.getNextTarget(state, { x: 0, y: 9, z: 0 }, async () => true);
    expect(third).toEqual({ x: 0, y: 10, z: 1 });
    expect(planner.getTargetRole(state, third!)).toBe("HEAD");
  });

  it("calculates progress for default quarry size", () => {
    const planner = new QuarryPlanner();
    const state = createDefaultState({ x: 0, y: 64, z: 0 }, { width: 30, height: 30, depth: 30 }, planner);
    const progressed = {
      ...state,
      completedBlockKeys: Array.from({ length: 270 }, (_, index) => `${index},64,0`)
    };

    expect(planner.calculateProgress(progressed)).toBe(1);
  });
});
