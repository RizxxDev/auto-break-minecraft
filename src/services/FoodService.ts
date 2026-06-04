import { FOOD_PRIORITY } from "../domain/constants";
import type { IFoodService, ILogger } from "../domain/interfaces";

export class FoodService implements IFoodService {
  constructor(
    private readonly bot: any,
    private readonly logger: ILogger
  ) {}

  async eatIfNeeded(): Promise<boolean> {
    if ((this.bot.food ?? 20) > 14) {
      return false;
    }

    const food = this.findPreferredFood();
    if (!food) {
      this.logger.warn("Hunger is low but no preferred food is available", { hunger: this.bot.food });
      return false;
    }

    await this.bot.equip(food, "hand");
    await this.bot.consume();
    this.logger.info("Ate food", { food: food.name, hunger: this.bot.food });
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
