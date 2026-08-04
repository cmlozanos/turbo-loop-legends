import { isCarId, type CarId } from "./cars";
import { isTrackId, type TrackId } from "./track";

const STORAGE_KEY = "turbo-loop-legends:v1";
const ALWAYS_AVAILABLE_CARS: readonly CarId[] = ["comet", "spark", "gecko", "mammoth"];

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
  unlockedCars: ["comet", "spark", "gecko", "mammoth"],
  finished: false,
  settings: {
    assists: true,
    music: false,
    sound: false,
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
      unlockedCars: [...new Set<CarId>([...(parsed.unlockedCars?.filter(isCarId) ?? []), ...ALWAYS_AVAILABLE_CARS])]
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
