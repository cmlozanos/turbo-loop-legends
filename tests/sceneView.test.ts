import { afterEach, expect, it, vi } from "vitest";
import { drivingFocus, drivingSpan, smoothZoom } from "../src/game/sceneView";
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

it('blends loop approach and departure without discontinuous focus or zoom targets',()=>{
  const track=getTrack('factory');
  const snapshot=createPhysicsWorld({track,car:getCar('mammoth')}).getSnapshot();
  const loop=track.loopGuides![0];snapshot.velocity.x=16;
  let previous:ReturnType<typeof drivingFocus>|undefined,previousSpan=0;
  for(let x=loop.center.x-loop.pathRadius-30;x<loop.center.x+loop.pathRadius+30;x+=0.05){
    snapshot.chassis.position={x,y:2.8};
    const focus=drivingFocus(track,snapshot),span=drivingSpan(track,snapshot,342);
    if(previous){expect(Math.hypot(focus.x-previous.x,focus.y-previous.y)).toBeLessThan(.3);expect(Math.abs(span-previousSpan)).toBeLessThan(8);}
    previous=focus;previousSpan=span;
  }
});

it("bounds zoom changes in both directions without overshooting",()=>{
  for(const fps of [10,15,30,60,120]){
    let zoom=.6;
    for(let frame=0;frame<fps*2;frame++){
      const next=smoothZoom(zoom,.2,1000/fps);
      expect(Math.abs(next-zoom)).toBeLessThanOrEqual(.65/fps+1e-9);
      expect(next).toBeGreaterThanOrEqual(.2);zoom=next;
    }
    expect(zoom).toBeCloseTo(.2,3);
  }
  expect(smoothZoom(.2,.8,16)).toBeLessThanOrEqual(.2+.18*.016);
  expect(smoothZoom(.4,.1,0)).toBe(.4);
});
