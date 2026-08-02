import { createPhysicsWorld } from "../src/game/physics";

const simulation = createPhysicsWorld();
simulation.setInput({ throttle: 1, turbo: true });

const initial = simulation.getSnapshot();
const finishX = Math.max(...simulation.track.segments.flatMap((segment) => segment.points.map((point) => point.x))) - 2;
let maximumHeight = initial.chassis.position.y;
let finite = true;
let reachedFinish = false;
let finishSeconds = 0;
let maximumForwardSpeed = 0;

for (let frame = 0; frame < 60 * 150; frame += 1) {
  const snapshot = simulation.step();
  maximumForwardSpeed = Math.max(maximumForwardSpeed, snapshot.velocity.x);
  maximumHeight = Math.max(maximumHeight, snapshot.chassis.position.y);
  finite &&= [
    snapshot.chassis.position.x,
    snapshot.chassis.position.y,
    snapshot.chassis.angle,
    snapshot.rearWheel.position.x,
    snapshot.frontWheel.position.x,
  ].every(Number.isFinite);
  if (snapshot.chassis.position.x > finishX) {
    reachedFinish = true;
    finishSeconds = (frame + 1) / 60;
    break;
  }
}

const final = simulation.getSnapshot();
const advanced = final.chassis.position.x > initial.chassis.position.x + 4;
const leftGround = maximumHeight > initial.chassis.position.y + 0.5;

console.log(
  JSON.stringify(
    {
      advanced,
      leftGround,
      reachedFinish,
      finishSeconds,
      maximumForwardSpeed,
      finite,
      maximumHeight,
      checkpointIndex: final.checkpointIndex,
      respawnCount: final.respawnCount,
      finalPosition: final.chassis.position,
    },
    null,
    2,
  ),
);

if (!advanced || !leftGround || !reachedFinish || finishSeconds > 55 || maximumForwardSpeed < 14 || final.checkpointIndex !== simulation.track.checkpoints.length - 1 || !finite) {
  process.exitCode = 1;
}
