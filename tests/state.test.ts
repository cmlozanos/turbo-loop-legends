import { describe, expect, it } from "vitest";
import { CARS } from "../src/game/cars";
import { DEFAULT_SAVE, loadSave, unlockCar } from "../src/game/state";

describe("save data", () => {
  it("uses defaults when there is no saved game", () => {
    const result = loadSave({ getItem: () => null });
    expect(result).toEqual(DEFAULT_SAVE);
    expect(result.settings.music).toBe(false);
    expect(result.settings.sound).toBe(false);
    expect(result.settings.lightMode).toBe(true);
    expect(result).not.toBe(DEFAULT_SAVE);
    expect(result.settings).not.toBe(DEFAULT_SAVE.settings);
    expect(result.unlockedCars).not.toBe(DEFAULT_SAVE.unlockedCars);
  });

  it("starts silent even with an existing audio preference", () => {
    const result = loadSave({
      getItem: () => JSON.stringify({ ...DEFAULT_SAVE, settings: { ...DEFAULT_SAVE.settings, music: true, sound: true } }),
    });
    expect(result.settings.music).toBe(false);
    expect(result.settings.sound).toBe(false);
  });

  it.each([true, false])("preserves an explicit light-mode preference (%s) and progress", (lightMode) => {
    const saved = { ...DEFAULT_SAVE, selectedCar: "lynx", selectedTrack: "moon", finished: true,
      unlockedCars: [...DEFAULT_SAVE.unlockedCars], settings: { ...DEFAULT_SAVE.settings, lightMode } };
    expect(loadSave({ getItem: () => JSON.stringify(saved) })).toEqual(saved);
  });

  it("defaults an older save without a quality choice to light without resetting progress", () => {
    const saved = { ...DEFAULT_SAVE, selectedTrack: "moon", finished: true,
      settings: { assists: false, music: true, sound: false, reducedMotion: true } };
    expect(loadSave({ getItem: () => JSON.stringify(saved) })).toEqual({
      ...saved, settings: { ...saved.settings, music: false, lightMode: true }
    });
  });

  it("adds all six cars to an existing save", () => {
    const result = loadSave({ getItem: () => JSON.stringify({ ...DEFAULT_SAVE, unlockedCars: ["comet"] }) });
    expect(result.unlockedCars).toEqual(expect.arrayContaining(CARS.map(car => car.id)));
  });

  it("recovers from invalid data", () => {
    expect(loadSave({ getItem: () => "not json" })).toEqual(DEFAULT_SAVE);
  });

  it("persists a valid selected track and rejects an unknown one", () => {
    const valid = loadSave({ getItem: () => JSON.stringify({ ...DEFAULT_SAVE, selectedTrack: "moon" }) });
    const invalid = loadSave({ getItem: () => JSON.stringify({ ...DEFAULT_SAVE, selectedTrack: "unknown" }) });
    expect(valid.selectedTrack).toBe("moon");
    expect(invalid.selectedTrack).toBe(DEFAULT_SAVE.selectedTrack);
  });

  it("unlocks a car only once", () => {
    const data = { ...structuredClone(DEFAULT_SAVE), unlockedCars: ["comet"] as (typeof CARS)[number]["id"][] };
    const storage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      value: { setItem: () => undefined },
      configurable: true
    });
    expect(unlockCar(data, "lynx")).toBe(true);
    expect(unlockCar(data, "lynx")).toBe(false);
    Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  });
});
