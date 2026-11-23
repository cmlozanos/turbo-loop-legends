import { expect, it } from "vitest";
import { CARS } from "../src/game/cars";
import { createPhysicsWorld } from "../src/game/physics";
import { carCanCompleteTrack, TRACKS } from "../src/game/track";

const pairings = TRACKS.flatMap(track => CARS.filter(car => carCanCompleteTrack(car, track)).map(car => ({ track, car })));
it.each(pairings)("$car.id completes $track.id with actual driving input and recovers from every checkpoint", ({ track, car }) => {
  const finish = Math.max(...track.segments.flatMap(segment => segment.points.map(point => point.x))) - 2;
  for (let checkpoint = 0; checkpoint < track.checkpoints.length; checkpoint++) {
    const simulation = createPhysicsWorld({ track, car });
    if (checkpoint) { simulation.setCheckpoint(checkpoint); simulation.respawn(); }
    simulation.setInput({ throttle: car.motor, lean: car.airControl, turbo: true });
    let snapshot = simulation.getSnapshot();
    for (let frame = 0; frame < 60 * 65 && snapshot.chassis.position.x < finish; frame++) snapshot = simulation.step();
    expect(snapshot.chassis.position.x, `checkpoint ${checkpoint}`).toBeGreaterThanOrEqual(finish);
    expect(snapshot.checkpointIndex).toBe(track.checkpoints.length - 1);
    for (const pose of [snapshot.chassis, snapshot.rearWheel, snapshot.frontWheel]) {
      expect([pose.position.x, pose.position.y, pose.angle].every(Number.isFinite)).toBe(true);
    }
  }
});
