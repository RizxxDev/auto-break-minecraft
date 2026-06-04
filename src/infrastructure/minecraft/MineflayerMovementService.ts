import { PICKAXE_PRIORITY } from "../../domain/constants";
import type { ILogger, IMovementService } from "../../domain/interfaces";
import type { Vector3 } from "../../domain/types";
import { floorVector } from "../../utils/vector";
import { sleep } from "../../utils/sleep";
import { patchBotDigTime } from "./enchantments";
import { createSafeMovements, findScaffoldingItem } from "./movements";

export class MineflayerMovementService implements IMovementService {
  constructor(
    private readonly bot: any,
    private readonly logger: ILogger
  ) {}

  getPosition(): Vector3 {
    return floorVector(this.bot.entity.position);
  }

  getLastKnownPath(): Vector3[] {
    const path = this.bot.pathfinder?.path ?? [];
    return path.map((position: any) => floorVector(position));
  }

  async canReach(position: Vector3, range = 1): Promise<boolean> {
    if (!this.bot.pathfinder) {
      return true;
    }

    try {
      const pathfinderModule = require("mineflayer-pathfinder");
      const goal = new pathfinderModule.goals.GoalNear(position.x, position.y, position.z, range);
      const result = this.bot.pathfinder.getPathTo(createSafeMovements(this.bot), goal, 2_000);
      return result.status === "success" || (Array.isArray(result.path) && result.path.length > 0);
    } catch (error) {
      this.logger.warn("Path reachability check failed", {
        position,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  async goNear(position: Vector3, range = 1): Promise<void> {
    const pathfinderModule = require("mineflayer-pathfinder");
    const goal = new pathfinderModule.goals.GoalNear(position.x, position.y, position.z, range);
    this.bot.pathfinder.setMovements(createSafeMovements(this.bot));
    const heldBeforePathing = this.bot.heldItem;

    try {
      await this.bot.pathfinder.goto(goal);
    } catch (error) {
      if (!(await this.tryScaffoldForUpwardMove(position))) {
        throw error;
      }
      await this.bot.pathfinder.goto(goal);
    } finally {
      await this.restoreHeldItem(heldBeforePathing);
    }
  }

  async dig(target: Vector3): Promise<void> {
    await this.goNear(target, 2);

    const block = this.bot.blockAt(toVec3(target));
    if (!block || !block.diggable) {
      return;
    }
    await this.equipBestPickaxeForDig();
    patchBotDigTime(this.bot);
    await this.bot.dig(block);
  }

  async returnTo(position: Vector3): Promise<void> {
    await this.goNear(position, 1);
  }

  async placeBlockUnderFeet(): Promise<boolean> {
    const scaffold = findScaffoldingItem(this.bot);
    if (!scaffold) {
      this.logger.warn("Cannot scaffold upward because no building block is available");
      return false;
    }

    const feet = this.getPosition();
    const feetBlock = this.bot.blockAt(toVec3(feet));
    const supportBlock = this.bot.blockAt(toVec3({ x: feet.x, y: feet.y - 1, z: feet.z }));

    if (!supportBlock || supportBlock.boundingBox !== "block") {
      this.logger.warn("Cannot scaffold upward because there is no solid support block", { position: feet });
      return false;
    }
    if (feetBlock && feetBlock.boundingBox === "block") {
      return false;
    }

    try {
      await this.bot.equip(scaffold, "hand");
      this.bot.setControlState?.("jump", true);
      await sleep(250);
      await this.bot.placeBlock(supportBlock, toVec3({ x: 0, y: 1, z: 0 }));
      await sleep(200);
      return true;
    } catch (error) {
      this.logger.warn("Failed to place scaffold block under feet", {
        position: feet,
        block: scaffold.name,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    } finally {
      this.bot.setControlState?.("jump", false);
    }
  }

  private async tryScaffoldForUpwardMove(target: Vector3): Promise<boolean> {
    const current = this.getPosition();
    if (Math.floor(target.y) <= current.y) {
      return false;
    }
    if (Math.abs(target.x - current.x) > 2 || Math.abs(target.z - current.z) > 2) {
      return false;
    }
    return this.placeBlockUnderFeet();
  }

  private async restoreHeldItem(item: any): Promise<void> {
    if (!item || this.bot.heldItem?.slot === item.slot) {
      return;
    }

    try {
      await this.bot.equip(item, "hand");
    } catch (error) {
      this.logger.warn("Failed to restore held item after scaffolding", {
        item: item.name,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async equipBestPickaxeForDig(): Promise<void> {
    if (this.bot.heldItem?.name?.endsWith("_pickaxe")) {
      return;
    }

    const pickaxe = this.findBestPickaxe();
    if (!pickaxe) {
      this.logger.warn("Cannot equip pickaxe before digging because no pickaxe is available", {
        heldItem: this.bot.heldItem?.name ?? "empty"
      });
      return;
    }

    await this.bot.equip(pickaxe, "hand");
  }

  private findBestPickaxe(): any | null {
    const items = typeof this.bot.inventory?.items === "function" ? this.bot.inventory.items() : [];
    const pickaxes = items.filter((item: any) => item.name?.endsWith("_pickaxe"));
    if (pickaxes.length === 0) {
      return null;
    }

    return pickaxes.sort((a: any, b: any) => {
      const materialScore = pickaxeScore(b.name) - pickaxeScore(a.name);
      if (materialScore !== 0) {
        return materialScore;
      }

      const aRemaining = (a.maxDurability ?? 0) - (a.durabilityUsed ?? 0);
      const bRemaining = (b.maxDurability ?? 0) - (b.durabilityUsed ?? 0);
      return bRemaining - aRemaining;
    })[0];
  }
}

function toVec3(position: Vector3): any {
  const { Vec3 } = require("vec3");
  return new Vec3(position.x, position.y, position.z);
}

function pickaxeScore(name: string): number {
  const priority = PICKAXE_PRIORITY.indexOf(name);
  return priority === -1 ? -1 : PICKAXE_PRIORITY.length - priority;
}
