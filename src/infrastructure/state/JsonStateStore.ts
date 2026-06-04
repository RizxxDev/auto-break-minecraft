import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { IStateStore } from "../../domain/interfaces";
import type { ChestMemory, HazardRecord, RuntimeState } from "../../domain/types";

const EMPTY_CHEST_MEMORY: ChestMemory = {
  supplyChests: [],
  storageChests: [],
  unknownChests: []
};

export class JsonStateStore implements IStateStore {
  private readonly dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = path.resolve(process.cwd(), dataDir);
  }

  async loadRuntimeState(defaultState: RuntimeState): Promise<RuntimeState> {
    return this.readJson("state.json", defaultState);
  }

  async saveRuntimeState(state: RuntimeState): Promise<void> {
    await this.writeJson("state.json", state);
  }

  async loadChestMemory(): Promise<ChestMemory> {
    return this.readJson("chests.json", EMPTY_CHEST_MEMORY);
  }

  async saveChestMemory(memory: ChestMemory): Promise<void> {
    await this.writeJson("chests.json", memory);
  }

  async loadHazards(): Promise<HazardRecord[]> {
    return this.readJson("hazards.json", []);
  }

  async saveHazards(hazards: HazardRecord[]): Promise<void> {
    await this.writeJson("hazards.json", hazards);
  }

  private async readJson<T>(fileName: string, fallback: T): Promise<T> {
    await mkdir(this.dataDir, { recursive: true });
    const filePath = path.join(this.dataDir, fileName);

    try {
      const raw = await readFile(filePath, "utf8");
      return JSON.parse(raw) as T;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return fallback;
      }
      throw error;
    }
  }

  private async writeJson(fileName: string, data: unknown): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    const filePath = path.join(this.dataDir, fileName);
    const tempPath = `${filePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    await rename(tempPath, filePath);
  }
}
