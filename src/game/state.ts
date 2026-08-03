import type { CarId } from "./cars";
import { isTrackId, type TrackId } from "./track";

const STORAGE_KEY = "turbo-loop-legends:v1";

export interface GameSettings {
  assists: boolean;
  music: boolean;
  sound: boolean;
  reducedMotion: boolean;
}

export interface SaveData {
  schemaVersion: 1;
  selectedCar: CarId;
  selectedTrack: TrackId;
  unlockedCars: CarId[];
  finished: boolean;
  settings: GameSettings;
}

export const DEFAULT_SAVE: SaveData = {
  schemaVersion: 1,
  selectedCar: "comet",
  selectedTrack: "canyon",
  unlockedCars: ["comet"],
  finished: false,
  settings: {
    assists: true,
    music: true,
    sound: true,
    reducedMotion: false
  }
};

export function loadSave(storage: Pick<Storage, "getItem"> = localStorage): SaveData {
  try {
    const value = storage.getItem(STORAGE_KEY);
    if (!value) return structuredClone(DEFAULT_SAVE);
    const parsed = JSON.parse(value) as Partial<SaveData>;
    if (parsed.schemaVersion !== 1) return structuredClone(DEFAULT_SAVE);
    return {
      ...structuredClone(DEFAULT_SAVE),
      ...parsed,
      settings: { ...DEFAULT_SAVE.settings, ...parsed.settings },
      selectedTrack: parsed.selectedTrack && isTrackId(parsed.selectedTrack) ? parsed.selectedTrack : DEFAULT_SAVE.selectedTrack,
      unlockedCars: parsed.unlockedCars?.filter(isCarId) ?? ["comet"]
    };
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}

export function saveGame(data: SaveData, storage: Pick<Storage, "setItem"> = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function unlockCar(data: SaveData, id: CarId): boolean {
  if (data.unlockedCars.includes(id)) return false;
  data.unlockedCars.push(id);
  saveGame(data);
  return true;
}

function isCarId(value: string): value is CarId {
  return value === "comet" || value === "lynx" || value === "titan";
}
