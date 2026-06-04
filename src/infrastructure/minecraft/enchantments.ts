export interface MineflayerEnchantment {
  name: string;
  lvl: number;
}

const DIG_TIME_PATCHED = Symbol.for("autonomous-quarry-bot.digTimePatched");

export function normalizeEnchantments(input: unknown): MineflayerEnchantment[] {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input.flatMap((entry) => normalizeEnchantmentEntry(entry));
  }

  if (input instanceof Map) {
    return Array.from(input.entries()).flatMap(([name, lvl]) => normalizeNamedLevel(name, lvl));
  }

  if (typeof input === "object") {
    const maybeList = readNestedList(input);
    if (maybeList) {
      return normalizeEnchantments(maybeList);
    }

    return Object.entries(input as Record<string, unknown>).flatMap(([name, lvl]) => normalizeNamedLevel(name, lvl));
  }

  return [];
}

export function getItemEnchantments(item: any): MineflayerEnchantment[] {
  if (!item) {
    return [];
  }

  return normalizeEnchantments(readItemEnchantments(item));
}

export function patchBotDigTime(bot: any): void {
  if (!bot || bot[DIG_TIME_PATCHED]) {
    return;
  }

  const originalDigTime = typeof bot.digTime === "function" ? bot.digTime.bind(bot) : null;
  bot.digTime = (block: any): number => {
    try {
      const heldItem = bot.heldItem;
      const heldType = heldItem?.type ?? null;
      const enchantments = getBotDigEnchantments(bot);
      const creative = bot.game?.gameMode === "creative";
      const eyeBlockName = bot._getBlockAtEyeLevel?.()?.name;
      const inWater = ["water", "flowing_water"].includes(eyeBlockName);
      const notOnGround = !bot.entity?.onGround;
      const effects = bot.entity?.effects ?? {};

      return block.digTime(heldType, creative, inWater, notOnGround, enchantments, effects);
    } catch (error) {
      if (originalDigTime) {
        return originalDigTime(block);
      }
      throw error;
    }
  };

  bot[DIG_TIME_PATCHED] = true;
}

export function getBotDigEnchantments(bot: any): MineflayerEnchantment[] {
  const enchantments = getItemEnchantments(bot?.heldItem);

  const headSlot = typeof bot.getEquipmentDestSlot === "function" ? bot.getEquipmentDestSlot("head") : undefined;
  const headItem = typeof headSlot === "number" ? bot.inventory?.slots?.[headSlot] : undefined;
  enchantments.push(...getItemEnchantments(headItem));

  return enchantments;
}

function normalizeEnchantmentEntry(entry: unknown): MineflayerEnchantment[] {
  if (!entry || typeof entry !== "object") {
    return [];
  }

  const record = entry as Record<string, unknown>;
  const name = scalar(record.name) ?? scalar(record.id);
  const lvl = scalar(record.lvl) ?? scalar(record.level);

  if (!name) {
    return [];
  }

  return [
    {
      name: String(name).replace("minecraft:", ""),
      lvl: Number(lvl ?? 1)
    }
  ];
}

function normalizeNamedLevel(name: unknown, lvl: unknown): MineflayerEnchantment[] {
  const normalizedName = scalar(name);
  const normalizedLevel = scalar(lvl);

  if (!normalizedName || typeof normalizedLevel === "object") {
    return [];
  }

  return [
    {
      name: String(normalizedName).replace("minecraft:", ""),
      lvl: Number(normalizedLevel ?? 1)
    }
  ];
}

function readNestedList(input: object): unknown[] | null {
  const record = input as Record<string, any>;
  const candidates = [
    record.value?.value,
    record.Enchantments?.value?.value,
    record.enchantments?.value?.value,
    record.Enchantments,
    record.enchantments
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return null;
}

function readItemEnchantments(item: any): unknown {
  const candidates = [
    safeRead(() => item.enchants),
    safeRead(() => item.enchantments),
    safeRead(() => item.nbt?.value?.Enchantments?.value?.value),
    safeRead(() => item.nbt?.value?.StoredEnchantments?.value?.value)
  ];

  return candidates.find((candidate) => candidate !== undefined && candidate !== null) ?? [];
}

function safeRead<T>(read: () => T): T | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
}

function scalar(input: unknown): unknown {
  if (input && typeof input === "object" && "value" in input) {
    return scalar((input as { value: unknown }).value);
  }
  return input;
}
