import { describe, expect, it } from "vitest";

import { createPhysicsWorld } from "../src/game/physics";
import { arc, createDefaultTrack, line, physicsToScreen, renderPolylines } from "../src/game/track";

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

  it("converts Planck coordinates to Phaser screen coordinates", () => {
    expect(physicsToScreen({ x: 2, y: 3 }, 10, { x: 100, y: 200 })).toEqual({ x: 120, y: 170 });
  });
});

describe("vehicle physics", () => {
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

  it("can complete the parametrized course at full throttle", () => {
    const simulation = createPhysicsWorld();
    simulation.setInput({ throttle: 1 });
    let snapshot = simulation.getSnapshot();
    let reachedFinish = false;
    for (let frame = 0; frame < 60 * 150; frame += 1) {
      snapshot = simulation.step();
      if (snapshot.chassis.position.x > 524) {
        reachedFinish = true;
        break;
      }
    }
    expect(reachedFinish).toBe(true);
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
