import { describe, expect, it } from "vitest";
import { CARS, getCar } from "../src/game/cars";
import { BASE_WHEEL_RADIUS, createPhysicsWorld, wheelRadiusOf } from "../src/game/physics";
import { loadSave, DEFAULT_SAVE } from "../src/game/state";
import { carCanCompleteTrack, line, surfaceAt, trackSurfaceYAt, TRACKS, type TrackDefinition } from "../src/game/track";

const pairings = TRACKS.flatMap(track => CARS.filter(car => carCanCompleteTrack(car, track)).map(car => ({ track, car })));

describe("accelerator-only driving", () => {
  // The marked mega jump is the only place that asks for turbo: a child who just holds
  // the accelerator must be able to finish everything after it.
  it.each(pairings)("$car.id finishes $track.id from every later checkpoint without turbo", ({ track, car }) => {
    for (let checkpoint = 1; checkpoint < track.checkpoints.length; checkpoint++) {
      const simulation = createPhysicsWorld({ track, car });
      simulation.setCheckpoint(checkpoint);
      simulation.respawn();
      simulation.setInput({ throttle: car.motor, lean: car.airControl, turbo: false });
      let snapshot = simulation.getSnapshot();
      for (let frame = 0; frame < 60 * 65 && snapshot.chassis.position.x < 586; frame++) snapshot = simulation.step();
      expect(snapshot.chassis.position.x, `checkpoint ${checkpoint}`).toBeGreaterThanOrEqual(586);
      expect(snapshot.respawnCount, `checkpoint ${checkpoint}`).toBe(1);
    }
  });

  it("gives every ordinary ramp dash arrows and leaves the mega jump to the turbo", () => {
    for (const track of TRACKS) {
      expect(track.boostPads).toHaveLength(track.hazards.length - 1);
      const megaJump = track.hazards.find(hazard => hazard.requiresTurbo)!;
      expect(track.boostPads!.some(pad => pad.endX > megaJump.startX - 30 && pad.startX < megaJump.startX)).toBe(false);
      for (const pad of track.boostPads!) {
        expect(pad.minSpeed).toBeGreaterThanOrEqual(9);
        expect(pad.minSpeed).toBeLessThanOrEqual(15.5);
      }
    }
  });
});

describe("springboards", () => {
  it("land every car on the same designed spot whatever its speed", () => {
    const track = TRACKS.find(candidate => candidate.id === "forest")!;
    const board = track.springboards[0];
    expect(board.range).toBeGreaterThan(10);
    const landings = [false, true].map(turbo => {
      const simulation = createPhysicsWorld({ track, car: getCar("comet") });
      simulation.setCheckpoint(2);
      simulation.respawn();
      simulation.setInput({ throttle: 1, turbo });
      let snapshot = simulation.getSnapshot();
      let launched = false;
      for (let frame = 0; frame < 60 * 30; frame++) {
        snapshot = simulation.step();
        if (snapshot.springboardActivations > 0 && !snapshot.grounded) launched = true;
        if (launched && snapshot.grounded) break;
      }
      expect(launched).toBe(true);
      return snapshot.chassis.position.x;
    });
    expect(Math.abs(landings[0] - landings[1])).toBeLessThan(4);
    expect(landings[0]).toBeGreaterThan(board.position.x + board.range! - 8);
  });

  it("keep the legacy additive boost when a board has no designed range", () => {
    const track: TrackDefinition = {
      segments: [line("flat", { x: -10, y: 0 }, { x: 60, y: 0 })],
      checkpoints: [{ id: "start", position: { x: 0, y: 1.1 }, angle: 0, radius: 2 }],
      springboards: [{ id: "legacy", position: { x: 8, y: 0 }, width: 4, verticalBoost: 10, forwardBoost: 2 }],
      hazards: [], killY: -8,
    };
    const simulation = createPhysicsWorld({ track });
    simulation.setInput({ throttle: 1 });
    let snapshot = simulation.getSnapshot();
    for (let frame = 0; frame < 300 && snapshot.springboardActivations === 0; frame++) snapshot = simulation.step();
    expect(snapshot.velocity.x).toBeGreaterThan(2);
    expect(snapshot.velocity.y).toBeGreaterThan(8);
  });
});

describe("relief and stars", () => {
  it("sculpts each circuit differently and keeps every run-up flat", () => {
    const silhouettes = TRACKS.map(track => JSON.stringify(track.relief));
    expect(new Set(silhouettes).size).toBe(TRACKS.length);
    for (const track of TRACKS) {
      expect(track.relief!.length).toBeGreaterThanOrEqual(6);
      for (const rampStart of [76, 242, 510]) {
        for (let x = rampStart - 5; x <= rampStart; x += 1) expect(trackSurfaceYAt(track.segments, x), `${track.id} x=${x}`).toBeCloseTo(0, 5);
      }
      for (const hazard of track.hazards) expect(surfaceAt(track.segments, (hazard.startX + hazard.endX) / 2)).toBeUndefined();
    }
  });

  it("places ordered stars in the air above the road and counts each one once", () => {
    for (const track of TRACKS) {
      const stars = track.stars!;
      expect(stars.length).toBeGreaterThan(15);
      expect(stars.map(star => star.id)).toEqual(stars.map((_, index) => index));
      for (let index = 1; index < stars.length; index++) expect(stars[index].position.x).toBeGreaterThanOrEqual(stars[index - 1].position.x);
      for (const star of stars) {
        const surface = surfaceAt(track.segments, star.position.x);
        if (surface !== undefined) expect(star.position.y, `${track.id} star ${star.id}`).toBeGreaterThan(surface + 0.6);
      }
      const simulation = createPhysicsWorld({ track });
      simulation.setInput({ throttle: 1, turbo: true });
      let snapshot = simulation.getSnapshot();
      for (let frame = 0; frame < 60 * 70 && snapshot.chassis.position.x < 586; frame++) snapshot = simulation.step();
      expect(snapshot.collectedStarIds.length, track.id).toBeGreaterThanOrEqual(Math.floor(stars.length / 2));
      expect(new Set(snapshot.collectedStarIds).size).toBe(snapshot.collectedStarIds.length);
      const before = snapshot.collectedStarIds.length;
      expect(simulation.respawn().collectedStarIds.length).toBe(before);
    }
  });

  it("keeps only valid best-star marks from a save", () => {
    expect(loadSave({ getItem: () => null }).bestStars).toEqual({});
    const saved = { ...DEFAULT_SAVE, bestStars: { moon: 12, unknown: 4, forest: "9", canyon: -1 } };
    expect(loadSave({ getItem: () => JSON.stringify(saved) }).bestStars).toEqual({ moon: 12 });
    const older = { ...DEFAULT_SAVE } as Record<string, unknown>;
    delete older.bestStars;
    expect(loadSave({ getItem: () => JSON.stringify(older) }).bestStars).toEqual({});
  });
});

describe("vehicle feel", () => {
  it("gives each car the wheels the player sees", () => {
    expect(wheelRadiusOf()).toBe(BASE_WHEEL_RADIUS);
    expect(wheelRadiusOf(getCar("mammoth"))).toBeGreaterThan(wheelRadiusOf(getCar("comet")));
    const rest = (id: "spark" | "mammoth"): number => {
      const simulation = createPhysicsWorld({ track: TRACKS[0], car: getCar(id) });
      let snapshot = simulation.getSnapshot();
      for (let frame = 0; frame < 180; frame++) snapshot = simulation.step();
      expect(snapshot.grounded).toBe(true);
      return snapshot.chassis.position.y;
    };
    expect(rest("mammoth")).toBeGreaterThan(rest("spark") + 0.1);
  });

  it("never teleports the car, even when a loop takes over the steering", () => {
    for (const { track, car } of pairings.filter(pairing => pairing.car.id === "spark" || pairing.car.id === "mammoth")) {
      const simulation = createPhysicsWorld({ track, car });
      simulation.setInput({ throttle: car.motor, lean: car.airControl, turbo: true });
      let previous = simulation.getSnapshot();
      for (let frame = 0; frame < 60 * 65 && previous.chassis.position.x < 586; frame++) {
        const snapshot = simulation.step();
        if (snapshot.respawnCount === previous.respawnCount) {
          const moved = Math.hypot(snapshot.chassis.position.x - previous.chassis.position.x, snapshot.chassis.position.y - previous.chassis.position.y);
          expect(moved, `${track.id}/${car.id} at x=${snapshot.chassis.position.x.toFixed(1)}`).toBeLessThan(0.8);
        }
        previous = snapshot;
      }
    }
  });

  it("limits the turbo launch to a playful wheelie", () => {
    const track: TrackDefinition = {
      segments: [line("flat", { x: -20, y: 0 }, { x: 200, y: 0 })],
      checkpoints: [{ id: "start", position: { x: 0, y: 1.1 }, angle: 0, radius: 2 }],
      springboards: [], hazards: [], killY: -8,
    };
    const simulation = createPhysicsWorld({ track, car: getCar("spark") });
    simulation.setInput({ throttle: 1, turbo: true });
    let steepest = 0;
    for (let frame = 0; frame < 240; frame++) steepest = Math.max(steepest, Math.abs(simulation.step().chassis.angle));
    expect(steepest).toBeGreaterThan(0.05);
    expect(steepest).toBeLessThan(0.6);
  });
});
