import { CARS, isCarId, type CarId } from "./cars";
import { isTrackId, type TrackId } from "./track";

const STORAGE_KEY = "turbo-loop-legends:v1";
const ALWAYS_AVAILABLE_CARS: readonly CarId[] = CARS.map(car => car.id);

export interface GameSettings {
  assists: boolean;
  music: boolean;
  sound: boolean;
  reducedMotion: boolean;
  lightMode: boolean;
}

export interface SaveData {
  schemaVersion: 1;
  selectedCar: CarId;
  selectedTrack: TrackId;
  unlockedCars: CarId[];
  finished: boolean;
  /** Most bonus stars collected in one run of each circuit. */
  bestStars: Partial<Record<TrackId, number>>;
  settings: GameSettings;
}

export const DEFAULT_SAVE: SaveData = {
  schemaVersion: 1,
  selectedCar: "comet",
  selectedTrack: "canyon",
  unlockedCars: CARS.map(car => car.id),
  finished: false,
  bestStars: {},
  settings: {
    assists: true,
    music: false,
    sound: false,
    reducedMotion: false,
    lightMode: true
  }
};

function createDefaultSave(): SaveData {
  return {
    ...DEFAULT_SAVE,
    unlockedCars: [...DEFAULT_SAVE.unlockedCars],
    bestStars: {},
    settings: { ...DEFAULT_SAVE.settings },
  };
}

export function loadSave(storage: Pick<Storage, "getItem"> = localStorage): SaveData {
  try {
    const value = storage.getItem(STORAGE_KEY);
    if (!value) return createDefaultSave();
    const parsed = JSON.parse(value) as Partial<SaveData>;
    if (parsed.schemaVersion !== 1) return createDefaultSave();
    return {
      ...createDefaultSave(),
      ...parsed,
      settings: { ...DEFAULT_SAVE.settings, ...parsed.settings, music: false, sound: false,
        lightMode: typeof parsed.settings?.lightMode === "boolean" ? parsed.settings.lightMode : DEFAULT_SAVE.settings.lightMode },
      bestStars: Object.fromEntries(Object.entries(parsed.bestStars ?? {}).filter(([id, stars]) => isTrackId(id) && typeof stars === "number" && Number.isFinite(stars) && stars >= 0)),
      selectedTrack: parsed.selectedTrack && isTrackId(parsed.selectedTrack) ? parsed.selectedTrack : DEFAULT_SAVE.selectedTrack,
      unlockedCars: [...new Set<CarId>([...(parsed.unlockedCars?.filter(isCarId) ?? []), ...ALWAYS_AVAILABLE_CARS])]
    };
  } catch {
    return createDefaultSave();
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
