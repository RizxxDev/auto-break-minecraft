# Autonomous Quarry Bot

TypeScript Mineflayer bot for autonomous underground quarrying. The bot starts from the provided underground room, stores that login location as the quarry origin, mines a configurable quarry layer by layer, persists progress to JSON, and sends Discord webhook telemetry for monitoring only.

## Features

- Mineflayer bot with pathfinder movement, normal player-like travel, and no teleporting.
- Layer-by-layer underground quarry from the initial origin.
- JSON persistence for quarry state, chest memory, and hazards.
- Chest discovery and classification for supply, storage, and unknown containers.
- Tool, repair, food, storage, health, stuck, disconnect, and death recovery flows.
- Discord webhook status embeds and alerts with local logging fallback.
- Service-oriented architecture designed for future multi-bot expansion.

## Setup

```bash
npm install
Copy-Item config.example.json config.json
npm run build
npm start
```

RTK users should run:

```bash
rtk npm install
rtk npm run build
rtk npm start
```

## Configuration

Create `config.json` from `config.example.json`.

- `bot.host`, `bot.port`, `bot.username`, `bot.auth`, and optional `bot.version` control the Minecraft connection.
- `quarry.width`, `quarry.height`, and `quarry.depth` default to `30 x 30 x 30`.
- `discord.webhookUrl` is optional. If it fails or is empty, the quarry continues.
- Thresholds control inventory fullness, durability, repair target, hunger, health, stuck detection, status interval, and chest scan radius.

## Runtime Files

The bot writes runtime state under `data/`:

- `state.json`: quarry progress, current task, runtime counters, and last safe position.
- `chests.json`: discovered and classified chest memory.
- `hazards.json`: lava and water hazards.

Logs are written under `logs/`.

## Operational Notes

- Place the bot in the prepared underground 2x2 start room before login.
- The bot uses the login position as quarry origin.
- It does not dig down from the surface and does not create a shaft.
- It validates safety before mining blocks and skips unsafe targets.
- Discord is monitoring-only. No Discord bot or command channel is required.

## Development

```bash
npm run test
npm run build
npm run dev
```

The Mineflayer-dependent services are isolated from quarry planning, safety rules, inventory decisions, and telemetry handling so those pieces can be tested without a live Minecraft server.
