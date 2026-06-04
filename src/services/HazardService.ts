import { BUILDING_BLOCK_HINTS, LAVA_NAMES, WATER_NAMES } from "../domain/constants";
import type { IHazardService, ILogger, IStateStore, ITelemetryService } from "../domain/interfaces";
import type { HazardKind, HazardRecord, Vector3 } from "../domain/types";
import { above, formatVector, vectorKey } from "../utils/vector";

export class HazardService implements IHazardService {
  private hazards?: HazardRecord[];

  constructor(
    private readonly bot: any,
    private readonly stateStore: IStateStore,
    private readonly telemetry: ITelemetryService,
    private readonly logger: ILogger
  ) {}

  async inspectAndHandle(target: Vector3): Promise<boolean> {
    const block = this.bot.blockAt?.(toVec3(target));
    if (!block) {
      return true;
    }

    const kind = hazardKind(block.name);
    if (!kind) {
      return true;
    }

    const record: HazardRecord = {
      id: vectorKey(target),
      kind,
      position: target,
      discoveredAt: new Date().toISOString(),
      handled: false
    };

    await this.rememberHazard(record);
    await this.telemetry.sendAlert(kind === "LAVA" ? "Lava ditemukan" : "Water ditemukan", {
      position: formatVector(target)
    });

    const handled = await this.tryCoverSource(target);
    record.handled = handled;
    await this.rememberHazard(record);
    return handled;
  }

  async getHazards(): Promise<HazardRecord[]> {
    if (!this.hazards) {
      this.hazards = await this.stateStore.loadHazards();
    }
    return this.hazards;
  }

  private async rememberHazard(record: HazardRecord): Promise<void> {
    const hazards = await this.getHazards();
    const index = hazards.findIndex((hazard) => hazard.id === record.id);
    if (index === -1) {
      hazards.push(record);
    } else {
      hazards[index] = record;
    }
    await this.stateStore.saveHazards(hazards);
  }

  private async tryCoverSource(target: Vector3): Promise<boolean> {
    const buildingBlock = this.findBuildingBlock();
    if (!buildingBlock) {
      this.logger.warn("No building block available for hazard cover", { target: formatVector(target) });
      return false;
    }

    try {
      await this.bot.equip(buildingBlock, "hand");
      const reference = this.bot.blockAt?.(toVec3(above(target)));
      if (!reference) {
        return false;
      }
      await this.bot.placeBlock(reference, toVec3({ x: 0, y: -1, z: 0 }));
      return true;
    } catch (error) {
      this.logger.warn("Failed to cover hazard", {
        target: formatVector(target),
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  private findBuildingBlock(): any | null {
    const items = typeof this.bot.inventory?.items === "function" ? this.bot.inventory.items() : [];
    return items.find((item: any) => BUILDING_BLOCK_HINTS.some((hint) => item.name.includes(hint))) ?? null;
  }
}

function hazardKind(name: string): HazardKind | null {
  if (LAVA_NAMES.includes(name)) {
    return "LAVA";
  }
  if (WATER_NAMES.includes(name)) {
    return "WATER";
  }
  return null;
}

function toVec3(position: Vector3): any {
  const { Vec3 } = require("vec3");
  return new Vec3(position.x, position.y, position.z);
}
