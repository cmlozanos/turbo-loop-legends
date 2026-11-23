import { afterEach, expect, it, vi } from "vitest";
import { drivingFocus } from "../src/game/sceneView";
import { nativeAppearance } from "../src/game/appearance";
import { getTrack } from "../src/game/track";
import { createPhysicsWorld } from "../src/game/physics";
import { getCar } from "../src/game/cars";

afterEach(() => vi.unstubAllGlobals());
it("uses common getters, respects local/system reduction and tolerates the earlier kit", () => {
  vi.stubGlobal("window", { FamilyV2: { theme: () => "dark", motionAllowed: () => false } });
  expect(nativeAppearance(false)).toEqual({ theme: "dark", motion: false });
  vi.stubGlobal("window", { FamilyV2: { theme: () => "light", motionAllowed: () => true } });
  expect(nativeAppearance(true).motion).toBe(false);
  vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
  expect(nativeAppearance(false).motion).toBe(false);
  vi.stubGlobal("window", {});
  expect(nativeAppearance(false)).toEqual({ theme: "light", motion: true });
});
it("frames a loop from a stable center and shows the upcoming landing instead of chasing jump height", () => {
  const track = getTrack("factory");
  const snapshot = createPhysicsWorld({ track, car: getCar("mammoth") }).getSnapshot();
  const loop = track.loopGuides![0];
  for (const angle of [-Math.PI / 2, 0, Math.PI / 2, Math.PI]) {
    snapshot.chassis.position = { x: loop.center.x + Math.cos(angle) * loop.pathRadius, y: loop.center.y + Math.sin(angle) * loop.pathRadius };
    expect(drivingFocus(track, snapshot)).toEqual(loop.center);
  }
  snapshot.chassis.position = { x: 70, y: 19 };
  snapshot.velocity.x = 24;
  expect(drivingFocus(track, snapshot)).toEqual({ x: 77.68, y: 12 });
  snapshot.velocity.x = -24;
  expect(drivingFocus(track, snapshot).x).toBe(65);
});

it('keeps the car readable on flat short screens but widens for actual loops and flights', async () => {
  const { drivingSpan } = await import('../src/game/sceneView');
  const track=getTrack('factory');
  const snapshot=createPhysicsWorld({track,car:getCar('mammoth')}).getSnapshot();
  expect(drivingSpan(track,snapshot,342)).toBe(540);
  const loop=track.loopGuides![0];
  snapshot.chassis.position={x:loop.center.x,y:loop.center.y};
  expect(drivingSpan(track,snapshot,342)).toBeGreaterThanOrEqual(loop.pathRadius*90+170);
  snapshot.chassis.position={x:70,y:19};
  expect(drivingSpan(track,snapshot,342)).toBeGreaterThan(1000);
});
