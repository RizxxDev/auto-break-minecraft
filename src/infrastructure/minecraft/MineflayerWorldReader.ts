import type { IMovementService, IWorldReader } from "../../domain/interfaces";
import type { BlockSnapshot, Vector3 } from "../../domain/types";

export class MineflayerWorldReader implements IWorldReader {
  constructor(
    private readonly bot: any,
    private readonly movement: IMovementService,
    private readonly storageReachability: () => Promise<boolean>
  ) {}

  getBlock(position: Vector3): BlockSnapshot | null {
    const block = this.bot.blockAt?.(toVec3(position));
    if (!block) {
      return null;
    }
    return {
      name: block.name,
      position,
      diggable: Boolean(block.diggable),
      boundingBox: block.boundingBox ?? "empty",
      liquid: Boolean(block.liquid)
    };
  }

  async canReach(position: Vector3, range = 1): Promise<boolean> {
    return this.movement.canReach(position, range);
  }

  async canReachStorageFrom(_position: Vector3): Promise<boolean> {
    return this.storageReachability();
  }
}

function toVec3(position: Vector3): any {
  const { Vec3 } = require("vec3");
  return new Vec3(position.x, position.y, position.z);
}
