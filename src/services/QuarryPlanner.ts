import type { IQuarryPlanner, SafeTargetPredicate } from "../domain/interfaces";
import type { QuarryBounds, QuarryDimensions, RuntimeState, Vector3 } from "../domain/types";
import { floorVector, parseVectorKey, vectorKey } from "../utils/vector";

export class QuarryPlanner implements IQuarryPlanner {
  createBounds(origin: Vector3, dimensions: QuarryDimensions): QuarryBounds {
    const start = floorVector(origin);
    const max = {
      x: start.x + dimensions.width - 1,
      y: start.y,
      z: start.z + dimensions.depth - 1
    };
    const min = {
      x: start.x,
      y: start.y - dimensions.height + 1,
      z: start.z
    };

    return {
      origin: start,
      min,
      max,
      width: dimensions.width,
      height: dimensions.height,
      depth: dimensions.depth,
      totalBlocks: dimensions.width * dimensions.height * dimensions.depth
    };
  }

  getLayerY(bounds: QuarryBounds, layer: number): number {
    return bounds.max.y - layer;
  }

  isInsideBounds(bounds: QuarryBounds, position: Vector3): boolean {
    const p = floorVector(position);
    return (
      p.x >= bounds.min.x &&
      p.x <= bounds.max.x &&
      p.y >= bounds.min.y &&
      p.y <= bounds.max.y &&
      p.z >= bounds.min.z &&
      p.z <= bounds.max.z
    );
  }

  getTargetRole(state: RuntimeState, target: Vector3): "HEAD" | "FEET" | "OTHER" {
    if (!state.quarryBounds || !this.isInsideBounds(state.quarryBounds, target)) {
      return "OTHER";
    }

    const layerIndex = this.getLayerIndex(state.quarryBounds, target);
    if (layerIndex < 0) {
      return "OTHER";
    }
    return layerIndex % 2 === 0 ? "HEAD" : "FEET";
  }

  async getNextTarget(
    state: RuntimeState,
    botPosition: Vector3,
    isSafeTarget: SafeTargetPredicate
  ): Promise<Vector3 | null> {
    if (!state.quarryBounds) {
      return null;
    }

    const completed = new Set(state.completedBlockKeys);
    const startBandLayer = Math.floor(state.currentLayer / 2) * 2;

    for (const candidate of this.getHumanMiningSequence(state.quarryBounds, startBandLayer, botPosition)) {
      const key = vectorKey(candidate);
      if (completed.has(key)) {
        continue;
      }

      if (this.getTargetRole(state, candidate) === "FEET" && !completed.has(vectorKey({ ...candidate, y: candidate.y + 1 }))) {
        continue;
      }

      const layer = this.getLayerIndex(state.quarryBounds, candidate);
      if (await isSafeTarget(candidate, { ...state, currentLayer: layer })) {
        return candidate;
      }
    }

    return null;
  }

  recordMined(state: RuntimeState, target: Vector3): RuntimeState {
    const key = vectorKey(target);
    const completed = new Set(state.completedBlockKeys);
    completed.add(key);
    const completedBlockKeys = [...completed];
    const bounds = state.quarryBounds;
    const currentLayer = bounds ? this.findFirstIncompleteLayer(bounds, completed) : state.currentLayer;
    const nextState: RuntimeState = {
      ...state,
      currentLayer,
      blocksMined: completedBlockKeys.length,
      completedBlockKeys,
      progress: 0,
      lastWorkPosition: floorVector(target),
      updatedAt: new Date().toISOString()
    };
    return {
      ...nextState,
      progress: this.calculateProgress(nextState)
    };
  }

  calculateProgress(state: RuntimeState): number {
    const total = state.quarryBounds?.totalBlocks ?? 0;
    if (total === 0) {
      return 0;
    }
    return Math.min(100, (state.completedBlockKeys.length / total) * 100);
  }

  isComplete(state: RuntimeState): boolean {
    return Boolean(state.quarryBounds && state.completedBlockKeys.length >= state.quarryBounds.totalBlocks);
  }

  private getHumanMiningSequence(bounds: QuarryBounds, startBandLayer: number, botPosition: Vector3): Vector3[] {
    const positions: Vector3[] = [];

    for (let bandLayer = startBandLayer; bandLayer < bounds.height; bandLayer += 2) {
      const headY = this.getLayerY(bounds, bandLayer);
      const feetY = bandLayer + 1 < bounds.height ? this.getLayerY(bounds, bandLayer + 1) : null;

      for (const cell of this.getSerpentineCells(bounds, botPosition)) {
        positions.push({ x: cell.x, y: headY, z: cell.z });
        if (feetY !== null) {
          positions.push({ x: cell.x, y: feetY, z: cell.z });
        }
      }
    }

    return positions;
  }

  private getSerpentineCells(bounds: QuarryBounds, botPosition: Vector3): Array<{ x: number; z: number }> {
    const cells: Array<{ x: number; z: number }> = [];
    const xAscending = botPosition.x <= bounds.origin.x + Math.floor(bounds.width / 2);

    const xStart = xAscending ? bounds.min.x : bounds.max.x;
    const xEnd = xAscending ? bounds.max.x : bounds.min.x;
    const xStep = xAscending ? 1 : -1;

    for (let x = xStart; xAscending ? x <= xEnd : x >= xEnd; x += xStep) {
      const offset = Math.abs(x - xStart);
      const zAscending = offset % 2 === 0;
      const zStart = zAscending ? bounds.min.z : bounds.max.z;
      const zEnd = zAscending ? bounds.max.z : bounds.min.z;
      const zStep = zAscending ? 1 : -1;

      for (let z = zStart; zAscending ? z <= zEnd : z >= zEnd; z += zStep) {
        cells.push({ x, z });
      }
    }

    return cells;
  }

  private getLayerIndex(bounds: QuarryBounds, position: Vector3): number {
    return bounds.max.y - floorVector(position).y;
  }

  private findFirstIncompleteLayer(bounds: QuarryBounds, completed: Set<string>): number {
    for (let layer = 0; layer < bounds.height; layer += 1) {
      const layerY = this.getLayerY(bounds, layer);
      const hasIncompleteBlock = [...completed].filter((key) => parseVectorKey(key).y === layerY).length < bounds.width * bounds.depth;
      if (hasIncompleteBlock) {
        return layer;
      }
    }
    return bounds.height;
  }
}
