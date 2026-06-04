import dotenv from "dotenv";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../domain/types";

dotenv.config();

const DEFAULT_CONFIG: AppConfig = {
  bot: {
    host: "localhost",
    port: 25565,
    username: "QuarryBot",
    auth: "offline",
    version: null
  },
  quarry: {
    width: 30,
    height: 30,
    depth: 30
  },
  discord: {
    webhookUrl: ""
  },
  thresholds: {
    inventoryUsage: 0.9,
    durabilityLow: 0.1,
    durabilityRepaired: 0.9,
    hungerLow: 14,
    healthLow: 10,
    stuckTimeoutMs: 10000,
    statusIntervalMs: 60000,
    chestScanRadius: 32
  },
  paths: {
    dataDir: "./data",
    logDir: "./logs"
  }
};

export async function loadConfig(): Promise<AppConfig> {
  const configPath = path.resolve(process.cwd(), process.env.CONFIG_PATH ?? "config.json");

  try {
    await access(configPath);
  } catch {
    throw new Error(`Missing config file: ${configPath}. Copy config.example.json to config.json first.`);
  }

  const raw = await readFile(configPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<AppConfig>;
  const config = mergeConfig(DEFAULT_CONFIG, parsed);
  validateConfig(config);
  return config;
}

function mergeConfig(defaults: AppConfig, input: Partial<AppConfig>): AppConfig {
  return {
    bot: { ...defaults.bot, ...input.bot },
    quarry: { ...defaults.quarry, ...input.quarry },
    discord: { ...defaults.discord, ...input.discord },
    thresholds: { ...defaults.thresholds, ...input.thresholds },
    paths: { ...defaults.paths, ...input.paths }
  };
}

function validateConfig(config: AppConfig): void {
  if (!config.bot.host) {
    throw new Error("bot.host is required.");
  }
  if (!config.bot.username) {
    throw new Error("bot.username is required.");
  }
  if (!["offline", "microsoft", "mojang"].includes(config.bot.auth)) {
    throw new Error("bot.auth must be offline, microsoft, or mojang.");
  }
  if (!Number.isInteger(config.bot.port) || config.bot.port <= 0) {
    throw new Error("bot.port must be a positive integer.");
  }
  for (const [key, value] of Object.entries(config.quarry)) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`quarry.${key} must be a positive integer.`);
    }
  }
  if (config.thresholds.inventoryUsage <= 0 || config.thresholds.inventoryUsage > 1) {
    throw new Error("thresholds.inventoryUsage must be between 0 and 1.");
  }
  if (config.thresholds.durabilityLow <= 0 || config.thresholds.durabilityLow >= 1) {
    throw new Error("thresholds.durabilityLow must be between 0 and 1.");
  }
  if (config.thresholds.durabilityRepaired <= config.thresholds.durabilityLow || config.thresholds.durabilityRepaired > 1) {
    throw new Error("thresholds.durabilityRepaired must be greater than durabilityLow and at most 1.");
  }
}
