import { describe, expect, it } from "vitest";
import { FrameClock, renderScale } from "../src/game/frameClock";
import { createPhysicsWorld } from "../src/game/physics";
import { getCar } from "../src/game/cars";
import { createDefaultTrack } from "../src/game/track";

describe("render-independent simulation", () => {
  for (const fps of [10, 15, 20, 30, 60, 120]) {
    it(`advances ten real seconds at ${fps} FPS`, () => {
      const clock = new FrameClock(); let steps = 0;
      for (let frame = 0; frame < fps * 10; frame++) clock.advance(1 / fps, () => { steps++; });
      expect(steps).toBe(600);
    });
  }
  it("keeps real Planck trajectory identical through low FPS and turbo", () => {
    const simulate = (fps: number) => {
      const world = createPhysicsWorld({ track: createDefaultTrack(), car: getCar("comet") });
      const clock = new FrameClock();
      world.setInput({ throttle: 1, turbo: true });
      for (let frame = 0; frame < fps * 12; frame++) clock.advance(1 / fps, dt => { world.step(dt); });
      return world.getSnapshot();
    };
    const expected = simulate(60);
    for (const fps of [10, 15, 20, 30, 120]) expect(simulate(fps)).toEqual(expected);
  });
  it("bounds catch-up, rejects invalid deltas and clears paused remainder", () => {
    const clock = new FrameClock(); let steps = 0;
    const tick = () => { steps++; };
    expect(clock.advance(3600, tick)).toBe(15);
    clock.advance(NaN, tick); clock.advance(-1, tick);
    expect(steps).toBe(15);
    clock.advance(1 / 120, tick); clock.reset(); clock.advance(1 / 120, tick);
    expect(steps).toBe(15);
    expect(clock.advance(0.25, () => false)).toBe(1);
  });
  it("reduces raster work without changing the CSS viewport", () => {
    expect(renderScale(1024, 768, true)).toBe(0.7);
    expect(renderScale(2000, 1000, true)).toBe(0.45);
    expect(renderScale(1024, 768, false)).toBe(1);
  });
});
