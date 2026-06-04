import type { IQuarryPlanner } from "../domain/interfaces";
import type { QuarryDimensions, RuntimeState, Vector3 } from "../domain/types";
import { floorVector } from "../utils/vector";

export function createDefaultState(origin: Vector3, dimensions: QuarryDimensions, planner: IQuarryPlanner): RuntimeState {
  const now = new Date().toISOString();
  const flooredOrigin = floorVector(origin);
  return {
    origin: flooredOrigin,
    quarryBounds: planner.createBounds(flooredOrigin, dimensions),
    currentLayer: 0,
    blocksMined: 0,
    progress: 0,
    currentTask: "QUARRY",
    startedAt: now,
    updatedAt: now,
    runtimeMs: 0,
    lastSafePosition: flooredOrigin,
    lastSafeLayer: 0,
    lastKnownPath: [],
    lastWorkPosition: flooredOrigin,
    completedBlockKeys: [],
    repairsPerformed: 0,
    deathCount: 0,
    itemsCollected: {}
  };
}
