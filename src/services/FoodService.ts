import { FOOD_PRIORITY } from "../domain/constants";
import type { IFoodService, ILogger } from "../domain/interfaces";

export class FoodService implements IFoodService {
  constructor(
    private readonly bot: any,
    private readonly logger: ILogger
  ) {}

  async eatIfNeeded(): Promise<boolean> {
    const hunger = this.bot.food ?? 20;
    const health = this.bot.health ?? 20;
    const shouldPanicEat = health < 20 && hunger < 20;
    const shouldEatFromHunger = hunger <= 14;

    if (!shouldPanicEat && !shouldEatFromHunger) {
      return false;
    }

    const food = this.findPreferredFood();
    if (!food) {
      this.logger.warn("Food needed but no preferred food is available", { hunger, health });
      return false;
    }

    await this.bot.equip(food, "hand");
    await this.bot.consume();
    this.logger.info(shouldPanicEat ? "Panic ate food for health regeneration" : "Ate food", {
      food: food.name,
      hunger: this.bot.food,
      health: this.bot.health
    });
    return true;
  }

  private findPreferredFood(): any | null {
    const items = typeof this.bot.inventory?.items === "function" ? this.bot.inventory.items() : [];
    for (const foodName of FOOD_PRIORITY) {
      const item = items.find((candidate: any) => candidate.name === foodName);
      if (item) {
        return item;
      }
    }
    return null;
  }
}
