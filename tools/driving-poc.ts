import { CARS } from "../src/game/cars";
import { createPhysicsWorld } from "../src/game/physics";
import { carCanCompleteTrack, TRACKS } from "../src/game/track";

let failures = 0;
for (const track of TRACKS) {
  for (const car of CARS.filter(candidate => carCanCompleteTrack(candidate, track))) {
    const simulation = createPhysicsWorld({ track, car });
    simulation.setInput({ throttle: car.motor, lean: car.airControl, turbo: true });
    const finish = Math.max(...track.segments.flatMap(segment => segment.points.map(point => point.x))) - 2;
    let snapshot = simulation.getSnapshot();
    let frames = 0;
    for (; frames < 60 * 100 && snapshot.chassis.position.x < finish; frames++) {
      snapshot = simulation.step();
    }
    const completed = snapshot.chassis.position.x >= finish;
    if (!completed) failures++;
    console.log(JSON.stringify({ track: track.id, car: car.id, completed, seconds: frames / 60,
      x: snapshot.chassis.position.x, checkpoint: snapshot.checkpointIndex, respawns: snapshot.respawnCount,
      blocked: snapshot.blockedObstacleId, loop: snapshot.activeLoopId }));
  }
}
if (failures) process.exitCode = 1;
