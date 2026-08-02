import { describe, expect, it } from "vitest";
import { DEFAULT_SAVE, loadSave, unlockCar } from "../src/game/state";

describe("save data", () => {
  it("uses defaults when there is no saved game", () => {
    const result = loadSave({ getItem: () => null });
    expect(result).toEqual(DEFAULT_SAVE);
    expect(result).not.toBe(DEFAULT_SAVE);
  });

  it("recovers from invalid data", () => {
    expect(loadSave({ getItem: () => "not json" })).toEqual(DEFAULT_SAVE);
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
