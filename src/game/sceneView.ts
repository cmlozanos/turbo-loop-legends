import type { TrackDefinition } from "./track";
import type { VehicleSnapshot } from "./physics";

// Smoothstep has zero slope at both ends, so entering/leaving a loop's
// framing zone never swaps the camera target in one frame.
function influence(distance: number, inner: number, outer: number): number {
  const t = Math.max(0, Math.min(1, (outer - distance) / (outer - inner)));
  return t * t * (3 - 2 * t);
}

export function drivingFocus(track: TrackDefinition, snapshot: VehicleSnapshot): { x: number; y: number } {
  const position = snapshot.chassis.position;
  const ahead = Math.max(-5, Math.min(9, snapshot.velocity.x * 0.32));
  let focus = { x: position.x + ahead, y: Math.max(2.8, position.y * 0.5 + 2.5) };
  for (const loop of track.loopGuides ?? []) {
    const weight = influence(Math.abs(position.x - loop.center.x), loop.pathRadius + 2, loop.pathRadius + 26);
    focus = { x: focus.x + (loop.center.x - focus.x) * weight, y: focus.y + (loop.center.y - focus.y) * weight };
  }
  return focus;
}

export function drivingSpan(track: TrackDefinition, snapshot: VehicleSnapshot, screenHeight: number): number {
  const position = snapshot.chassis.position;
  let span = Math.max(540, (position.y + 3) * 45 + 200);
  for (const loop of track.loopGuides ?? []) {
    // Begin opening the view before the focus reaches the loop, not at its lip.
    const weight = influence(Math.abs(position.x - loop.center.x), loop.pathRadius + 6, loop.pathRadius + 38);
    const loopSpan = loop.pathRadius * 90 * Math.max(1, screenHeight / Math.max(180, screenHeight - 130)) + 170;
    span = Math.max(span, 540 + (loopSpan - 540) * weight);
  }
  return span;
}

export function smoothZoom(current: number, target: number, deltaMs: number): number {
  if (deltaMs <= 0) return current;
  const seconds = Math.min(deltaMs, 100) / 1000;
  const eased = current + (target - current) * (1 - Math.exp(-5 * seconds));
  const limit = (target < current ? 0.65 : 0.18) * seconds;
  return current + Math.max(-limit, Math.min(limit, eased - current));
}
