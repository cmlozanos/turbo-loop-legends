import { describe, expect, it } from "vitest";
import { DEFAULT_SAVE, loadSave, unlockCar } from "../src/game/state";

describe("save data", () => {
  it("uses defaults when there is no saved game", () => {
    const result = loadSave({ getItem: () => null });
    expect(result).toEqual(DEFAULT_SAVE);
    expect(result.settings.music).toBe(false);
    expect(result.settings.sound).toBe(false);
    expect(result).not.toBe(DEFAULT_SAVE);
  });

  it("preserves an existing audio preference", () => {
    const result = loadSave({
      getItem: () => JSON.stringify({ ...DEFAULT_SAVE, settings: { ...DEFAULT_SAVE.settings, music: true, sound: true } }),
    });
    expect(result.settings.music).toBe(true);
    expect(result.settings.sound).toBe(true);
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
    const data = structuredClone(DEFAULT_SAVE);
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
