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

export interface TrackDefinition {
  segments: readonly TrackSegment[];
  checkpoints: readonly Checkpoint[];
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
        "approach",
        { x: -16, y: 0 },
        { x: 28, y: 0 },
        { x: 42, y: 0.5 },
        { x: 56, y: 1.6 },
        { x: 70, y: 0.5 },
        { x: 82, y: 0 },
        { x: 98, y: 0 },
        { x: 108, y: 1.4 },
        { x: 118, y: 3 },
        { x: 132, y: 3 },
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
        { x: 248, y: 0 },
        { x: 262, y: 2.4 },
        { x: 276, y: 0 },
        { x: 306, y: 0 },
        { x: 322, y: 1.2 },
        { x: 338, y: 0 },
        { x: 352, y: 0 },
        { x: 364, y: 2 },
        { x: 376, y: 3 },
        { x: 380, y: 3 },
      ),
      incompleteLoop,
      line(
        "landing",
        { x: 379.5, y: 1.7 },
        { x: 396, y: 0 },
        { x: 430, y: 0 },
        { x: 446, y: 2.2 },
        { x: 462, y: 0 },
        { x: 486, y: 0 },
        { x: 500, y: 1.2 },
        { x: 514, y: 0 },
        { x: 528, y: 0 },
      ),
    ],
    checkpoints: [
      { id: "start", position: { x: -12, y: 1.1 }, angle: 0, radius: 2 },
      { id: "full-loop", position: { x: 172, y: 4.1 }, angle: 0, radius: 3 },
      { id: "incomplete-loop", position: { x: 372, y: 4.1 }, angle: 0, radius: 3 },
      { id: "broken-loop-exit", position: { x: 394, y: 2 }, angle: -0.15, radius: 4 },
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
