import { QuarryRuntime } from "./application/QuarryRuntime";
import { TaskOrchestrator } from "./application/TaskOrchestrator";
import { createDefaultState } from "./application/createDefaultState";
import { loadConfig } from "./config/loadConfig";
import { MineflayerBotFactory } from "./infrastructure/minecraft/MineflayerBotFactory";
import { MineflayerMovementService } from "./infrastructure/minecraft/MineflayerMovementService";
import { MineflayerWorldReader } from "./infrastructure/minecraft/MineflayerWorldReader";
import { WinstonLogger } from "./infrastructure/logger/WinstonLogger";
import { JsonStateStore } from "./infrastructure/state/JsonStateStore";
import { DiscordWebhookTelemetry } from "./infrastructure/telemetry/DiscordWebhookTelemetry";
import { ChestService } from "./services/ChestService";
import { FoodService } from "./services/FoodService";
import { HazardService } from "./services/HazardService";
import { InventoryService } from "./services/InventoryService";
import { QuarryPlanner } from "./services/QuarryPlanner";
import { RecoveryService } from "./services/RecoveryService";
import { RepairService } from "./services/RepairService";
import { SafetyService } from "./services/SafetyService";
import { StorageService } from "./services/StorageService";
import { ToolService } from "./services/ToolService";
import type { AppConfig, RuntimeState } from "./domain/types";
import { floorVector } from "./utils/vector";

async function main(): Promise<void> {
  const config = await loadConfig();
  const logger = new WinstonLogger(config.paths.logDir);
  const stateStore = new JsonStateStore(config.paths.dataDir);
  const planner = new QuarryPlanner();
  const telemetry = new DiscordWebhookTelemetry(config.discord.webhookUrl, logger);
  const factory = new MineflayerBotFactory();

  telemetry.start();

  let runtime: QuarryRuntime | null = null;
  let reconnecting = false;

  const connect = (): void => {
    const bot = factory.create(config);

    bot.once("spawn", async () => {
      logger.info("Bot spawned", { username: bot.username });
      await telemetry.sendAlert("Bot online", { bot: bot.username });

      const origin = floorVector(bot.entity.position);
      const defaultState = createDefaultState(origin, config.quarry, planner);
      const persistedState = await loadOrInitializeState(stateStore, defaultState, planner, config);

      const movement = new MineflayerMovementService(bot, logger);
      const inventory = new InventoryService(bot);
      const chestService = new ChestService(bot, movement, stateStore, config.thresholds, telemetry, logger);
      const worldReader = new MineflayerWorldReader(bot, movement, async () => {
        const chest = await chestService.findStorageChest();
        return chest !== null;
      });
      const safety = new SafetyService(worldReader, logger);
      const toolService = new ToolService(bot, inventory, logger);
      const foodService = new FoodService(bot, logger);
      const hazardService = new HazardService(bot, stateStore, telemetry, logger);
      const storageService = new StorageService(bot, inventory, chestService, movement, config.thresholds, telemetry, logger);
      const repairService = new RepairService(bot, inventory, toolService, chestService, config.thresholds, telemetry, logger);
      const recoveryService = new RecoveryService(movement, foodService, repairService, storageService, telemetry, logger);
      const orchestrator = new TaskOrchestrator(config.thresholds);

      await chestService.discoverChests();

      runtime = new QuarryRuntime(
        bot,
        config,
        {
          planner,
          stateStore,
          movement,
          safety,
          inventory,
          tools: toolService,
          food: foodService,
          storage: storageService,
          hazards: hazardService,
          recovery: recoveryService,
          orchestrator,
          telemetry,
          logger
        },
        persistedState
      );

      void runtime.start();
    });

    bot.on("death", async () => {
      logger.warn("Bot died");
      await telemetry.sendAlert("Bot mati");
      if (runtime) {
        const state = runtime.getState();
        await stateStore.saveRuntimeState({
          ...state,
          deathCount: state.deathCount + 1,
          currentTask: "RECOVERY",
          updatedAt: new Date().toISOString()
        });
      }
    });

    bot.on("error", async (error: unknown) => {
      logger.error("Bot error", { error: error instanceof Error ? error.message : String(error) });
      await telemetry.sendError(error, runtime?.getState());
    });

    bot.on("kicked", async (reason: unknown) => {
      logger.warn("Bot kicked", { reason });
      await telemetry.sendAlert("Bot offline", { reason: String(reason) });
    });

    bot.on("end", async () => {
      runtime?.stop();
      await telemetry.sendAlert("Bot offline");

      if (reconnecting) {
        return;
      }

      reconnecting = true;
      setTimeout(() => {
        reconnecting = false;
        logger.info("Attempting reconnect");
        void telemetry.sendAlert("Reconnect berhasil");
        connect();
      }, 5_000);
    });
  };

  connect();
}

async function loadOrInitializeState(
  stateStore: JsonStateStore,
  defaultState: RuntimeState,
  planner: QuarryPlanner,
  config: AppConfig
): Promise<RuntimeState> {
  const persisted = await stateStore.loadRuntimeState(defaultState);
  if (!persisted.origin || !persisted.quarryBounds) {
    await stateStore.saveRuntimeState(defaultState);
    return defaultState;
  }

  const expectedTotal = config.quarry.width * config.quarry.height * config.quarry.depth;
  if (persisted.quarryBounds.totalBlocks !== expectedTotal) {
    const migrated: RuntimeState = {
      ...persisted,
      quarryBounds: planner.createBounds(persisted.origin, config.quarry),
      updatedAt: new Date().toISOString()
    };
    await stateStore.saveRuntimeState(migrated);
    return migrated;
  }

  return persisted;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
