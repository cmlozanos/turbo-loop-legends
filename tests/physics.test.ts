import { describe, expect, it } from "vitest";

import { createPhysicsWorld } from "../src/game/physics";
import { arc, createDefaultTrack, getNextTrackId, line, physicsToScreen, renderPolylines, trackSurfaceYAt, TRACKS } from "../src/game/track";

describe("track geometry", () => {
  it("samples closed and incomplete loops without degenerate closing edges", () => {
    const full = arc({
      id: "full",
      center: { x: 2, y: 3 },
      radius: 4,
      startAngle: 0,
      endAngle: Math.PI * 2,
      samples: 16,
      closed: true,
    });
    const partial = arc({
      id: "partial",
      center: { x: 0, y: 0 },
      radius: 2,
      startAngle: 0,
      endAngle: Math.PI,
      samples: 8,
    });

    expect(full.points).toHaveLength(16);
    expect(full.points.at(-1)).not.toEqual(full.points[0]);
    expect(partial.points).toHaveLength(9);
    expect(partial.points.at(-1)?.x).toBeCloseTo(-2);
    expect(partial.points.at(-1)?.y).toBeCloseTo(0);
  });

  it("contains straight sections plus complete and incomplete loops", () => {
    const track = createDefaultTrack();
    expect(track.segments.some((segment) => segment.kind === "line")).toBe(true);
    expect(track.segments.find((segment) => segment.id === "full-loop")?.closed).toBe(true);
    expect(track.segments.find((segment) => segment.id === "incomplete-loop")?.closed).toBe(false);
    expect(renderPolylines(track).find((_, index) => track.segments[index].closed)).toHaveLength(65);
  });

  it("defines ramps, dangerous gaps and springboards as level data", () => {
    const track = createDefaultTrack();
    expect(track.segments.filter((segment) => segment.id.includes("ramp"))).toHaveLength(4);
    expect(track.hazards).toHaveLength(4);
    expect(track.springboards).toHaveLength(3);
    expect(track.obstacles?.some((obstacle) => obstacle.behavior === "avoid")).toBe(true);
    expect(track.obstacles?.some((obstacle) => obstacle.behavior === "breakable")).toBe(true);
    expect(track.hazards.every((hazard) => hazard.endX > hazard.startX)).toBe(true);
  });

  it("places every springboard exactly on its track surface", () => {
    const heights: number[] = [];
    for (const track of TRACKS) {
      for (const board of track.springboards) {
        heights.push(board.position.y);
        expect(board.position.y).toBeCloseTo(trackSurfaceYAt(track.segments, board.position.x), 5);
      }
    }
    expect(heights.some((height) => height > 0)).toBe(true);
  });

  it("places every obstacle on its track surface", () => {
    for (const track of TRACKS) {
      for (const obstacle of track.obstacles ?? []) {
        expect(obstacle.position.y).toBeCloseTo(trackSurfaceYAt(track.segments, obstacle.position.x), 5);
      }
    }
  });

  it("converts Planck coordinates to Phaser screen coordinates", () => {
    expect(physicsToScreen({ x: 2, y: 3 }, 10, { x: 100, y: 200 })).toEqual({ x: 120, y: 170 });
  });

  it("advances through every circuit and wraps after the moon", () => {
    expect(getNextTrackId("forest")).toBe("canyon");
    expect(getNextTrackId("canyon")).toBe("neon");
    expect(getNextTrackId("moon")).toBe("forest");
  });

  it("gives every circuit a distinct loop, gap and ramp silhouette", () => {
    const loopSignatures = TRACKS.map((track) => track.loopGuides?.map((guide) => [guide.center.x, guide.pathRadius, guide.endAngle.toFixed(2)]));
    const rampSignatures = TRACKS.map((track) => track.segments.filter((segment) => segment.id.includes("ramp")).map((segment) => segment.points.length).join("-"));
    const brokenGaps = TRACKS.map((track) => {
      const brokenLoop = track.segments.find((segment) => segment.id === "incomplete-loop");
      const landing = track.segments.find((segment) => segment.id === "broken-loop-landing");
      return ((landing?.points[0].x ?? 0) - (brokenLoop?.points.at(-1)?.x ?? 0)).toFixed(1);
    });

    expect(new Set(loopSignatures.map((signature) => JSON.stringify(signature))).size).toBe(TRACKS.length);
    expect(new Set(rampSignatures).size).toBe(TRACKS.length);
    expect(new Set(brokenGaps).size).toBe(TRACKS.length);
  });
});

describe("vehicle physics", () => {
  it("smashes breakable barriers at speed but keeps avoidable objects solid", () => {
    const track = {
      segments: [line("flat", { x: -100, y: 0 }, { x: 100, y: 0 })],
      checkpoints: [{ id: "start", position: { x: 0, y: 1.1 }, angle: 0, radius: 2 }],
      springboards: [],
      obstacles: [
        { id: "wall", behavior: "breakable" as const, style: "roadblock" as const, position: { x: 25, y: 0 }, width: 1.2, height: 1.1, breakSpeed: 7 },
        { id: "tires", behavior: "avoid" as const, style: "tires" as const, position: { x: 40, y: 0 }, width: 1.2, height: 0.8 },
      ],
      hazards: [],
      killY: -8,
    };
    const simulation = createPhysicsWorld({ track });
    simulation.setInput({ throttle: 1, turbo: true });
    let snapshot = simulation.getSnapshot();
    for (let frame = 0; frame < 420; frame += 1) snapshot = simulation.step();

    expect(snapshot.brokenObstacleIds).toContain("wall");
    expect(snapshot.brokenObstacleIds).not.toContain("tires");
  });

  it("uses motorized wheels to move while keeping all poses finite", () => {
    const simulation = createPhysicsWorld();
    const start = simulation.getSnapshot().chassis.position.x;
    simulation.setInput({ throttle: 1 });

    let snapshot = simulation.getSnapshot();
    for (let frame = 0; frame < 180; frame += 1) {
      snapshot = simulation.step();
    }

    expect(snapshot.chassis.position.x).toBeGreaterThan(start + 2);
    expect(Object.values(snapshot.chassis.position).every(Number.isFinite)).toBe(true);
    expect(Number.isFinite(snapshot.rearWheel.angle)).toBe(true);
    expect(Number.isFinite(snapshot.frontWheel.angle)).toBe(true);
  });

  it("reaches a lively forward speed and a useful reverse speed", () => {
    const flatTrack = {
      segments: [line("flat", { x: -100, y: 0 }, { x: 100, y: 0 })],
      checkpoints: [{ id: "start", position: { x: 0, y: 1.1 }, angle: 0, radius: 2 }],
      springboards: [],
      hazards: [],
      killY: -8,
    };
    const forward = createPhysicsWorld({ track: flatTrack });
    forward.setInput({ throttle: 1 });
    let forwardSnapshot = forward.getSnapshot();
    for (let frame = 0; frame < 180; frame += 1) forwardSnapshot = forward.step();

    const reverse = createPhysicsWorld({ track: flatTrack });
    reverse.setInput({ throttle: -1 });
    let reverseSnapshot = reverse.getSnapshot();
    for (let frame = 0; frame < 180; frame += 1) reverseSnapshot = reverse.step();

    expect(forwardSnapshot.velocity.x).toBeGreaterThan(7.5);
    expect(reverseSnapshot.velocity.x).toBeLessThan(-4.5);
  });

  it("uses turbo in both directions without a lower reverse speed cap", () => {
    const flatTrack = {
      segments: [line("flat", { x: -500, y: 0 }, { x: 500, y: 0 })],
      checkpoints: [{ id: "start", position: { x: 0, y: 1.1 }, angle: 0, radius: 2 }],
      springboards: [],
      hazards: [],
      killY: -8,
    };
    const forward = createPhysicsWorld({ track: flatTrack });
    const reverse = createPhysicsWorld({ track: flatTrack });
    forward.setInput({ throttle: 1, turbo: true });
    reverse.setInput({ throttle: -1, turbo: true });

    let forwardSnapshot = forward.getSnapshot();
    let reverseSnapshot = reverse.getSnapshot();
    for (let frame = 0; frame < 300; frame += 1) {
      forwardSnapshot = forward.step();
      reverseSnapshot = reverse.step();
    }

    expect(forwardSnapshot.velocity.x).toBeGreaterThan(14);
    expect(reverseSnapshot.velocity.x).toBeLessThan(-14);
    expect(Math.abs(reverseSnapshot.velocity.x)).toBeCloseTo(forwardSnapshot.velocity.x, 1);
  });

  it("reaches unrestricted reverse speed on the real track", () => {
    const simulation = createPhysicsWorld({ track: TRACKS[0] });
    simulation.setInput({ throttle: -1, turbo: true });
    let snapshot = simulation.getSnapshot();
    for (let frame = 0; frame < 300; frame += 1) snapshot = simulation.step();

    expect(snapshot.velocity.x).toBeLessThan(-14);
    expect(snapshot.chassis.position.x).toBeLessThan(-45);
  });

  it("can complete every track with turbo", () => {
    for (const track of TRACKS) {
      const simulation = createPhysicsWorld({ track });
      simulation.setInput({ throttle: 1, turbo: true });
      let snapshot = simulation.getSnapshot();
      let reachedFinish = false;
      for (let frame = 0; frame < 60 * 100; frame += 1) {
        snapshot = simulation.step();
        if (snapshot.chassis.position.x > 586) {
          reachedFinish = true;
          break;
        }
      }
      expect(reachedFinish, `${track.name} should be completable`).toBe(true);
      expect(snapshot.checkpointIndex).toBe(track.checkpoints.length - 1);
    }
  });

  it("launches the complete vehicle when it lands on a springboard", () => {
    const track = {
      segments: [line("flat", { x: -10, y: 0 }, { x: 30, y: 0 })],
      checkpoints: [{ id: "start", position: { x: 0, y: 1.1 }, angle: 0, radius: 2 }],
      springboards: [{ id: "test-launcher", position: { x: 8, y: 0 }, width: 4, verticalBoost: 10, forwardBoost: 2 }],
      hazards: [],
      killY: -8,
    };
    const simulation = createPhysicsWorld({ track });
    simulation.setInput({ throttle: 1 });
    let snapshot = simulation.getSnapshot();
    for (let frame = 0; frame < 300 && snapshot.springboardActivations === 0; frame += 1) {
      snapshot = simulation.step();
    }

    expect(snapshot.springboardActivations).toBe(1);
    expect(snapshot.velocity.y).toBeGreaterThan(8);
    expect(snapshot.velocity.x).toBeGreaterThan(2);
  });

  it("respawns at the checkpoint after falling into a precipice", () => {
    const track = {
      segments: [line("ledge", { x: -5, y: 0 }, { x: 3, y: 0 }), line("far-side", { x: 18, y: 0 }, { x: 30, y: 0 })],
      checkpoints: [{ id: "start", position: { x: 0, y: 1.1 }, angle: 0, radius: 2 }],
      springboards: [],
      hazards: [{ id: "test-pit", startX: 3, endX: 18, depth: 8 }],
      killY: -5,
    };
    const simulation = createPhysicsWorld({ track });
    simulation.setInput({ throttle: 1 });
    let snapshot = simulation.getSnapshot();
    for (let frame = 0; frame < 360 && snapshot.respawnCount === 0; frame += 1) {
      snapshot = simulation.step();
    }

    expect(snapshot.respawnCount).toBe(1);
    expect(snapshot.chassis.position.x).toBeCloseTo(track.checkpoints[0].position.x);
  });

  it("can complete the parametrized course at full throttle", () => {
    const simulation = createPhysicsWorld();
    simulation.setInput({ throttle: 1 });
    let snapshot = simulation.getSnapshot();
    let reachedFinish = false;
    for (let frame = 0; frame < 60 * 150; frame += 1) {
      snapshot = simulation.step();
      if (snapshot.chassis.position.x > 586) {
        reachedFinish = true;
        break;
      }
    }
    expect(reachedFinish).toBe(true);
    expect(snapshot.checkpointIndex).toBe(simulation.track.checkpoints.length - 1);
  });

  it("respawns the complete articulated vehicle at the active checkpoint", () => {
    const simulation = createPhysicsWorld();
    simulation.setCheckpoint(2);
    const snapshot = simulation.respawn();
    const checkpoint = simulation.track.checkpoints[2];

    expect(snapshot.chassis.position.x).toBeCloseTo(checkpoint.position.x);
    expect(snapshot.chassis.position.y).toBeCloseTo(checkpoint.position.y);
    expect(snapshot.rearWheel.position.x).toBeLessThan(snapshot.chassis.position.x);
    expect(snapshot.frontWheel.position.x).toBeGreaterThan(snapshot.chassis.position.x);
    expect(snapshot.velocity).toEqual({ x: 0, y: 0 });
    expect(snapshot.respawnCount).toBe(1);
  });
});
