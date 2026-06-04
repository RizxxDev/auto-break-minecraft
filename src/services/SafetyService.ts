import { LAVA_NAMES, WATER_NAMES } from "../domain/constants";
import type { ILogger, ISafetyService, IWorldReader } from "../domain/interfaces";
import type { BlockSnapshot, RuntimeState, Vector3 } from "../domain/types";
import { below, equalsVector, floorVector, vectorKey } from "../utils/vector";

export class SafetyService implements ISafetyService {
  constructor(
    private readonly world: IWorldReader,
    private readonly logger: ILogger
  ) {}

  async isSafePosition(position: Vector3): Promise<boolean> {
    const p = floorVector(position);
    const body = this.world.getBlock(p);
    const floor = this.world.getBlock(below(p));

    if (!floor || !isSolid(floor)) {
      return false;
    }
    if (isDangerous(body) || isDangerous(floor)) {
      return false;
    }
    if (body && body.boundingBox === "block") {
      return false;
    }
    if (!(await this.world.canReach(p, 1))) {
      return false;
    }
    return this.world.canReachStorageFrom(p);
  }

  async canMineTarget(target: Vector3, state: RuntimeState, botPosition: Vector3): Promise<boolean> {
    const targetPosition = floorVector(target);
    const currentPosition = floorVector(botPosition);

    if (!state.quarryBounds) {
      return false;
    }
    if (state.completedBlockKeys.includes(vectorKey(targetPosition))) {
      return false;
    }
    if (!insideBounds(state, targetPosition)) {
      return false;
    }
    if (equalsVector(targetPosition, currentPosition) || equalsVector(targetPosition, below(currentPosition))) {
      return false;
    }

    const block = this.world.getBlock(targetPosition);
    if (!block || !block.diggable || isDangerous(block)) {
      return false;
    }
    if (wouldOpenDangerousFall(this.world, targetPosition)) {
      return false;
    }
    if (state.lastSafePosition && !(await this.world.canReach(state.lastSafePosition, 1))) {
      this.logger.warn("Skipping target because last safe position is unreachable", { target: targetPosition });
      return false;
    }
    if (!(await this.world.canReach(targetPosition, 2))) {
      return false;
    }

    return true;
  }

  async rememberSafePosition(state: RuntimeState, position: Vector3): Promise<RuntimeState> {
    if (!(await this.isSafePosition(position))) {
      return state;
    }
    return {
      ...state,
      lastSafePosition: floorVector(position),
      lastSafeLayer: state.currentLayer,
      updatedAt: new Date().toISOString()
    };
  }
}

function insideBounds(state: RuntimeState, position: Vector3): boolean {
  const bounds = state.quarryBounds;
  if (!bounds) {
    return false;
  }
  return (
    position.x >= bounds.min.x &&
    position.x <= bounds.max.x &&
    position.y >= bounds.min.y &&
    position.y <= bounds.max.y &&
    position.z >= bounds.min.z &&
    position.z <= bounds.max.z
  );
}

function wouldOpenDangerousFall(world: IWorldReader, target: Vector3): boolean {
  let openDepth = 0;
  for (let y = target.y - 1; y >= target.y - 4; y -= 1) {
    const block = world.getBlock({ x: target.x, y, z: target.z });
    if (block && isSolid(block)) {
      return openDepth > 2;
    }
    openDepth += 1;
  }
  return true;
}

function isSolid(block: BlockSnapshot): boolean {
  return block.boundingBox === "block" && !block.liquid && !isDangerous(block);
}

function isDangerous(block: BlockSnapshot | null): boolean {
  if (!block) {
    return false;
  }
  return block.liquid || LAVA_NAMES.includes(block.name) || WATER_NAMES.includes(block.name);
}
