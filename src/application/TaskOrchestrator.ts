import type { ITaskOrchestrator } from "../domain/interfaces";
import type { TaskState, ThresholdConfig } from "../domain/types";

export class TaskOrchestrator implements ITaskOrchestrator {
  constructor(private readonly thresholds: ThresholdConfig) {}

  chooseTask(input: {
    health: number;
    hunger: number;
    inventoryUsage: number;
    durability: number | null;
    currentTask: TaskState;
  }): TaskState {
    if (input.currentTask === "WAIT_FOR_STORAGE" || input.currentTask === "COMPLETE") {
      return input.currentTask;
    }
    if (input.health <= this.thresholds.healthLow) {
      return "SURVIVE";
    }
    if (input.hunger <= this.thresholds.hungerLow) {
      return "EAT";
    }
    if (input.durability !== null && input.durability < this.thresholds.durabilityLow) {
      return "REPAIR";
    }
    if (input.inventoryUsage >= this.thresholds.inventoryUsage) {
      return "STORE_ITEMS";
    }
    return "QUARRY";
  }
}
