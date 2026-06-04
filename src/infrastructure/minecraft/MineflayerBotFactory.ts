import type { AppConfig } from "../../domain/types";
import { createSafeMovements } from "./movements";

export class MineflayerBotFactory {
  create(config: AppConfig): any {
    const mineflayer = require("mineflayer");
    const pathfinderModule = require("mineflayer-pathfinder");
    const collectBlockModule = require("mineflayer-collectblock");

    const options: Record<string, unknown> = {
      host: config.bot.host,
      port: config.bot.port,
      username: config.bot.username,
      auth: config.bot.auth
    };

    if (config.bot.version) {
      options.version = config.bot.version;
    }

    const bot = mineflayer.createBot(options);
    bot.loadPlugin(pathfinderModule.pathfinder);
    bot.loadPlugin(collectBlockModule.plugin ?? collectBlockModule);

    bot.once("spawn", () => {
      bot.pathfinder.setMovements(createSafeMovements(bot));
    });

    return bot;
  }
}
