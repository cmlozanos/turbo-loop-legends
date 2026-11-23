import type { TrackDefinition } from "./track";
import type { VehicleSnapshot } from "./physics";

// A stable world-space focus, not a chase of the car around the loop circumference.
export function drivingFocus(track: TrackDefinition, snapshot: VehicleSnapshot): { x: number; y: number } {
  const position = snapshot.chassis.position;
  const loop = track.loopGuides?.find(guide => Math.abs(position.x - guide.center.x) < guide.pathRadius + 10);
  if (loop) return { x: loop.center.x, y: loop.center.y };
  const ahead = Math.max(-5, Math.min(9, snapshot.velocity.x * 0.32));
  // Keep the ground/landing in view even at the apex of a springboard jump.
  return { x: position.x + ahead, y: Math.max(2.8, position.y * 0.5 + 2.5) };
}
