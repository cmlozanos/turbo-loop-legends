export interface Point {
  x: number;
  y: number;
}

export interface TrackSegment {
  id: string;
  kind: "line" | "arc";
  points: readonly Point[];
  closed: boolean;
}

export interface Checkpoint {
  id: string;
  position: Point;
  angle: number;
  radius: number;
}

export interface Springboard {
  id: string;
  position: Point;
  width: number;
  verticalBoost: number;
  forwardBoost: number;
}

export interface HazardGap {
  id: string;
  startX: number;
  endX: number;
  depth: number;
}

export interface TrackDefinition {
  segments: readonly TrackSegment[];
  checkpoints: readonly Checkpoint[];
  springboards: readonly Springboard[];
  hazards: readonly HazardGap[];
  killY: number;
}

export interface ArcOptions {
  id: string;
  center: Point;
  radius: number;
  startAngle: number;
  endAngle: number;
  samples?: number;
  closed?: boolean;
}

export function line(id: string, ...points: Point[]): TrackSegment {
  if (points.length < 2) {
    throw new Error("A track line needs at least two points");
  }

  return { id, kind: "line", points, closed: false };
}

export function arc(options: ArcOptions): TrackSegment {
  const samples = options.samples ?? 32;
  if (options.radius <= 0 || samples < 2) {
    throw new Error("A track arc needs a positive radius and at least two samples");
  }

  const closed = options.closed ?? false;
  const pointCount = closed ? samples : samples + 1;
  const points = Array.from({ length: pointCount }, (_, index) => {
    const progress = index / samples;
    const angle = options.startAngle + (options.endAngle - options.startAngle) * progress;
    return {
      x: options.center.x + Math.cos(angle) * options.radius,
      y: options.center.y + Math.sin(angle) * options.radius,
    };
  });

  return { id: options.id, kind: "arc", points, closed };
}

/**
 * Course coordinates use metres with Y pointing up, matching Planck. Phaser can
 * render the returned polylines after flipping Y with `physicsToScreen`.
 */
export function createDefaultTrack(): TrackDefinition {
  const fullLoop = arc({
    id: "full-loop",
    center: { x: 180, y: 7 },
    radius: 4,
    startAngle: -Math.PI / 2,
    endAngle: (3 * Math.PI) / 2,
    samples: 64,
    closed: true,
  });
  const incompleteLoop = arc({
    id: "incomplete-loop",
    center: { x: 380, y: 7 },
    radius: 4,
    startAngle: -Math.PI / 2,
    endAngle: (5 * Math.PI) / 4,
    samples: 44,
  });

  return {
    segments: [
      line(
        "start-road",
        { x: -16, y: 0 },
        { x: 28, y: 0 },
        { x: 42, y: 0.5 },
        { x: 56, y: 1.6 },
        { x: 70, y: 0.5 },
        { x: 76, y: 0 },
      ),
      line("first-ramp", { x: 76, y: 0 }, { x: 84, y: 0 }, { x: 96, y: 4.2 }),
      line(
        "first-landing",
        { x: 107.5, y: 1.2 },
        { x: 122, y: 0 },
        { x: 144, y: 0 },
        { x: 158, y: 0 },
        { x: 168, y: 1.8 },
        { x: 176, y: 3 },
        { x: 180, y: 3 },
      ),
      fullLoop,
      line(
        "between-loops",
        { x: 180, y: 3 },
        { x: 205, y: 3 },
        { x: 220, y: 0 },
        { x: 242, y: 0 },
      ),
      line("cliff-ramp", { x: 242, y: 0 }, { x: 252, y: 0 }, { x: 264, y: 3.6 }),
      line(
        "cliff-landing",
        { x: 270, y: 0.8 },
        { x: 292, y: 0 },
        { x: 330, y: 0 },
        { x: 344, y: 1.2 },
        { x: 352, y: 0 },
        { x: 364, y: 2 },
        { x: 376, y: 3 },
        { x: 380, y: 3 },
      ),
      incompleteLoop,
      line(
        "broken-loop-landing",
        { x: 379.5, y: 1.7 },
        { x: 396, y: 0 },
        { x: 420, y: 0 },
      ),
      line("canyon-ramp", { x: 420, y: 0 }, { x: 430, y: 0 }, { x: 442, y: 4 }),
      line("canyon-landing", { x: 452, y: 0.8 }, { x: 466, y: 0 }, { x: 510, y: 0 }),
      line("final-ramp", { x: 510, y: 0 }, { x: 520, y: 0 }, { x: 532, y: 3.4 }),
      line("finish-road", { x: 541.5, y: 0.6 }, { x: 554, y: 0 }, { x: 588, y: 0 }),
    ],
    checkpoints: [
      { id: "start", position: { x: -12, y: 1.1 }, angle: 0, radius: 2 },
      { id: "first-landing", position: { x: 113, y: 2.2 }, angle: -0.08, radius: 4 },
      { id: "full-loop", position: { x: 172, y: 4.1 }, angle: 0, radius: 3 },
      { id: "cliff-landing", position: { x: 276, y: 2 }, angle: -0.08, radius: 5 },
      { id: "incomplete-loop", position: { x: 372, y: 4.1 }, angle: 0, radius: 3 },
      { id: "broken-loop-exit", position: { x: 394, y: 2 }, angle: -0.15, radius: 4 },
      { id: "canyon-landing", position: { x: 458, y: 2 }, angle: -0.08, radius: 5 },
      { id: "final-landing", position: { x: 548, y: 1.8 }, angle: -0.05, radius: 5 },
    ],
    springboards: [
      { id: "forest-launcher", position: { x: 232, y: 0 }, width: 3.2, verticalBoost: 15, forwardBoost: 4.5 },
      { id: "loop-launcher", position: { x: 318, y: 0 }, width: 3.2, verticalBoost: 15.5, forwardBoost: 4.5 },
      { id: "canyon-launcher", position: { x: 488, y: 0 }, width: 3.6, verticalBoost: 16, forwardBoost: 5 },
    ],
    hazards: [
      { id: "first-gorge", startX: 96, endX: 107.5, depth: 8 },
      { id: "middle-gorge", startX: 264, endX: 270, depth: 10 },
      { id: "deep-canyon", startX: 442, endX: 452, depth: 12 },
      { id: "final-chasm", startX: 532, endX: 541.5, depth: 11 },
    ],
    killY: -8,
  };
}

export function renderPolylines(track: TrackDefinition): Point[][] {
  return track.segments.map((segment) => {
    const points = segment.points.map((point) => ({ ...point }));
    if (segment.closed) {
      points.push({ ...points[0] });
    }
    return points;
  });
}

export function physicsToScreen(point: Point, pixelsPerMetre: number, origin: Point): Point {
  return {
    x: origin.x + point.x * pixelsPerMetre,
    y: origin.y - point.y * pixelsPerMetre,
  };
}
