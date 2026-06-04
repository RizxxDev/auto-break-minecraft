import { describe, expect, it, vi } from "vitest";
import type { IWorldReader } from "../src/domain/interfaces";
import type { BlockSnapshot, RuntimeState, Vector3 } from "../src/domain/types";
import { createDefaultState } from "../src/application/createDefaultState";
import { QuarryPlanner } from "../src/services/QuarryPlanner";
import { SafetyService } from "../src/services/SafetyService";

describe("SafetyService", () => {
  it("accepts positions with solid floor, no liquid, and storage reachability", async () => {
    const service = new SafetyService(world({}), logger());

    await expect(service.isSafePosition({ x: 0, y: 10, z: 0 })).resolves.toBe(true);
  });

  it("rejects mining the block under the bot", async () => {
    const planner = new QuarryPlanner();
    const state = createDefaultState({ x: 0, y: 10, z: 0 }, { width: 3, height: 3, depth: 3 }, planner);
    const service = new SafetyService(world({}), logger());

    await expect(service.canMineTarget({ x: 0, y: 9, z: 0 }, state, { x: 0, y: 10, z: 0 })).resolves.toBe(false);
  });

  it("rejects targets that would open a fall deeper than two blocks", async () => {
    const planner = new QuarryPlanner();
    const state = createDefaultState({ x: 0, y: 10, z: 0 }, { width: 3, height: 3, depth: 3 }, planner);
    const service = new SafetyService(
      world({
        "1,10,0": block("stone", { x: 1, y: 10, z: 0 }),
        "1,9,0": air({ x: 1, y: 9, z: 0 }),
        "1,8,0": air({ x: 1, y: 8, z: 0 }),
        "1,7,0": air({ x: 1, y: 7, z: 0 }),
        "1,6,0": air({ x: 1, y: 6, z: 0 })
      }),
      logger()
    );

    await expect(service.canMineTarget({ x: 1, y: 10, z: 0 }, state, { x: 0, y: 10, z: 0 })).resolves.toBe(false);
  });
});

function world(overrides: Record<string, BlockSnapshot>): IWorldReader {
  return {
    getBlock(position: Vector3) {
      const key = `${position.x},${position.y},${position.z}`;
      if (overrides[key]) {
        return overrides[key];
      }
      if (position.y === 9) {
        return block("stone", position);
      }
      return air(position);
    },
    canReach: vi.fn(async () => true),
    canReachStorageFrom: vi.fn(async () => true)
  };
}

function block(name: string, position: Vector3): BlockSnapshot {
  return { name, position, diggable: true, boundingBox: "block", liquid: false };
}

function air(position: Vector3): BlockSnapshot {
  return { name: "air", position, diggable: false, boundingBox: "empty", liquid: false };
}

function logger(): any {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  };
}
