import { describe, expect, it, vi } from "vitest";
vi.mock("phaser", () => ({ default: { Scene: class {} } }));
import { GameScene } from "../src/game/GameScene";
import { CARS, getCar } from "../src/game/cars";
import { createPhysicsWorld, type VehicleInput } from "../src/game/physics";
import { carCanCompleteTrack, line, TRACKS, type TrackDefinition } from "../src/game/track";

function road(height = 1.1, slope = 0): TrackDefinition {
  return {
    segments: [line("road", { x: -100, y: -100 * slope }, { x: 1000, y: 1000 * slope })],
    checkpoints: [{ id: "start", position: { x: 0, y: height }, angle: Math.atan(slope), radius: 2 }],
    springboards: [], hazards: [], killY: -20,
  };
}

function sceneInput(throttle: boolean, brake: boolean, assists: boolean, grounded: boolean, activeLoopId?: string): VehicleInput {
  const scene = new GameScene() as any;
  scene.init({ car: getCar("comet"), assists, reducedMotion: true,
    input: { state: { throttle, brake, turbo: false }, consumeReset: () => false },
    onSpeed() {}, audio: { updateEngine() {} } });
  scene.lastSnapshot = { chassis: { angle: 0.4 }, velocity: { x: 4 }, grounded, activeLoopId,
    respawnCount: 0, springboardActivations: 0 };
  let received: VehicleInput = {};
  scene.simulation = { setInput(input: VehicleInput) { received = input; }, step: () => scene.lastSnapshot };
  scene.scene = { isActive: () => true };
  scene.cameras = { main: { width: 900, zoom: 1, scrollX: 0, setLerp() {} } };
  scene.syncVehicle = () => {}; scene.emitDust = () => {}; scene.checkProgress = () => {}; scene.checkRecovery = () => {};
  scene.update(0, 1000 / 60);
  return received;
}

describe("car pedals are not motorbike lean controls", () => {
  it.each([true, false])("accelerator and brake request no manual rotation, grounded=%s", grounded => {
    expect(sceneInput(true, false, false, grounded)).toMatchObject({ throttle: 1, brake: false, lean: 0 });
    expect(sceneInput(false, true, false, grounded)).toMatchObject({ throttle: 0, brake: true, lean: 0 });
  });

  it("keeps child air recovery independent of pedals, without fighting the ground or a native loop", () => {
    for (const [throttle, brake] of [[false, false], [true, false], [false, true]]) {
      expect(sceneInput(throttle, brake, true, false).lean).toBeCloseTo(-0.28);
      expect(sceneInput(throttle, brake, true, true).lean).toBe(0);
      expect(sceneInput(throttle, brake, true, true, "full-loop").lean).toBe(0);
    }
  });

  it.each(CARS)("$id accelerates on flat ground without rearing up", car => {
    const simulation = createPhysicsWorld({ track: road(), car });
    simulation.setInput({ throttle: car.motor, turbo: true });
    let steepest = 0;
    let snapshot = simulation.getSnapshot();
    for (let frame = 0; frame < 240; frame++) {
      snapshot = simulation.step();
      steepest = Math.max(steepest, Math.abs(snapshot.chassis.angle));
    }
    expect(steepest).toBeLessThan(0.3);
    expect(snapshot.chassis.position.x).toBeGreaterThan(30);
    expect(snapshot.grounded).toBe(true);
  });

  it("does not apply explicit air-rotation torque while wheels touch the road", () => {
    const run = (lean: number) => {
      const simulation = createPhysicsWorld({ track: road() });
      for (let frame = 0; frame < 180; frame++) simulation.step();
      simulation.setInput({ brake: true, lean });
      for (let frame = 0; frame < 30; frame++) simulation.step();
      return simulation.getSnapshot();
    };
    expect(run(1)).toEqual(run(0));
    expect(run(-1)).toEqual(run(0));
  });

  it.each([{}, { throttle: 1 }, { brake: true }])("falls and lands wheels-down with pedals %j", input => {
    const simulation = createPhysicsWorld({ track: road(10), car: getCar("comet") });
    simulation.setInput(input);
    let landed = false;
    let snapshot = simulation.getSnapshot();
    for (let frame = 0; frame < 240; frame++) {
      snapshot = simulation.step();
      expect(Math.abs(snapshot.chassis.angle)).toBeLessThan(0.5);
      if (snapshot.grounded) landed = true;
    }
    expect(landed).toBe(true);
    expect(snapshot.grounded).toBe(true);
    expect(snapshot.respawnCount).toBe(0);
    expect(Math.abs(snapshot.chassis.angle)).toBeLessThan(0.1);
  });

  it("follows a road slope instead of locking the chassis level", () => {
    const simulation = createPhysicsWorld({ track: road(1.2, 0.3) });
    simulation.setInput({ throttle: 1 });
    let snapshot = simulation.getSnapshot();
    for (let frame = 0; frame < 240; frame++) snapshot = simulation.step();
    expect(snapshot.grounded).toBe(true);
    expect(snapshot.chassis.angle).toBeCloseTo(Math.atan(0.3), 1);
    expect(snapshot.frontWheel.position.y).toBeGreaterThan(snapshot.rearWheel.position.y + 0.4);
  });
});

const pairings = TRACKS.flatMap(track => CARS.filter(car => carCanCompleteTrack(car, track)).map(car => ({ track, car })));
describe("pedal-only compatible routes", () => {
  it.each(pairings)("$car.id completes $track.id from all eight starts with no fall and native loop rotation", ({ track, car }) => {
    const loops = new Set<string>();
    let invertedInLoop = false;
    for (let checkpoint = 0; checkpoint < track.checkpoints.length; checkpoint++) {
      const simulation = createPhysicsWorld({ track, car });
      if (checkpoint) { simulation.setCheckpoint(checkpoint); simulation.respawn(); }
      const initialRespawns = simulation.getSnapshot().respawnCount;
      simulation.setInput({ throttle: car.motor, turbo: true });
      let snapshot = simulation.getSnapshot();
      for (let frame = 0; frame < 60 * 65 && snapshot.chassis.position.x < 586; frame++) {
        snapshot = simulation.step();
        if (snapshot.activeLoopId) {
          loops.add(snapshot.activeLoopId);
          if (Math.cos(snapshot.chassis.angle) < 0) invertedInLoop = true;
        }
        expect([snapshot.chassis, snapshot.rearWheel, snapshot.frontWheel].every(pose =>
          [pose.position.x, pose.position.y, pose.angle].every(Number.isFinite))).toBe(true);
      }
      expect(snapshot.chassis.position.x, `checkpoint ${checkpoint}`).toBeGreaterThanOrEqual(586);
      expect(snapshot.respawnCount, `checkpoint ${checkpoint}`).toBe(initialRespawns);
      expect(snapshot.checkpointIndex).toBe(track.checkpoints.length - 1);
    }
    expect(loops.size).toBe(track.loopGuides!.length);
    expect(invertedInLoop).toBe(true);
  });
});
