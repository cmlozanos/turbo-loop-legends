export interface Point {
  x: number;
  y: number;
}

export type TrackId = "forest" | "canyon" | "neon" | "volcano" | "moon";

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
  requiresTurbo?: boolean;
}

export type ObstacleStyle = "rock" | "tires" | "crates" | "roadblock";

export interface TrackObstacle {
  id: string;
  behavior: "avoid" | "breakable";
  style: ObstacleStyle;
  position: Point;
  width: number;
  height: number;
  breakSpeed?: number;
}

export interface TrackTheme {
  skyTop: number;
  skyBottom: number;
  ground: number;
  scenery: number;
  road: number;
  roadEdge: number;
  abyss: number;
  accent: number;
}

export interface TrackPhysics {
  gravity: number;
  grip: number;
  suspensionFrequency: number;
  suspensionDamping: number;
}

export interface LoopGuide {
  id: string;
  kind: "full" | "incomplete";
  center: Point;
  pathRadius: number;
  startAngle: number;
  endAngle: number;
  entryX: number;
}

export interface TrackDefinition {
  id?: TrackId;
  name?: string;
  tagline?: string;
  difficulty?: number;
  capabilities?: readonly string[];
  theme?: TrackTheme;
  physics?: TrackPhysics;
  loopGuides?: readonly LoopGuide[];
  segments: readonly TrackSegment[];
  checkpoints: readonly Checkpoint[];
  springboards: readonly Springboard[];
  obstacles?: readonly TrackObstacle[];
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

interface TrackProfile {
  id: TrackId;
  name: string;
  tagline: string;
  difficulty: number;
  capabilities: readonly string[];
  theme: TrackTheme;
  physics: TrackPhysics;
  gapWidths: readonly [number, number, number, number];
  rampHeights: readonly [number, number, number, number];
  rampStyles: readonly RampStyle[];
  loopDesign: {
    fullCenterX: number;
    fullRadius: number;
    brokenCenterX: number;
    brokenRadius: number;
    brokenEndAngle: number;
    brokenGap: number;
  };
  springboards: readonly Springboard[];
  obstacles: readonly TrackObstacle[];
}

type RampStyle = "smooth" | "kicker" | "wave" | "stepped";

export function line(id: string, ...points: Point[]): TrackSegment {
  if (points.length < 2) throw new Error("A track line needs at least two points");
  return { id, kind: "line", points, closed: false };
}

export function arc(options: ArcOptions): TrackSegment {
  const samples = options.samples ?? 32;
  if (options.radius <= 0 || samples < 2) throw new Error("A track arc needs a positive radius and at least two samples");
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

const PROFILES: readonly TrackProfile[] = [
  {
    id: "forest", name: "Bosque Turbo", tagline: "Rápida, amable y llena de saltos", difficulty: 1,
    capabilities: ["Megasalto turbo", "Loopings pequeños", "2 saltadores"],
    theme: { skyTop: 0x79ccec, skyBottom: 0xeaf8f2, ground: 0x4f8e52, scenery: 0x376b42, road: 0x9b5a2f, roadEdge: 0xe6ad62, abyss: 0x15202b, accent: 0x5ce1a5 },
    physics: { gravity: -9.5, grip: 1.5, suspensionFrequency: 4.3, suspensionDamping: 0.9 },
    gapWidths: [16, 7, 7, 7], rampHeights: [3.2, 3, 3.2, 2.8],
    rampStyles: ["smooth", "wave", "smooth", "kicker"],
    loopDesign: { fullCenterX: 168, fullRadius: 3.25, brokenCenterX: 368, brokenRadius: 3.4, brokenEndAngle: Math.PI * 1.38, brokenGap: 2.4 },
    springboards: [
      { id: "forest-one", position: { x: 232, y: 0 }, width: 3.2, verticalBoost: 13, forwardBoost: 3.5 },
      { id: "forest-two", position: { x: 488, y: 0 }, width: 3.4, verticalBoost: 14, forwardBoost: 4 },
    ],
    obstacles: [
      { id: "forest-rock", behavior: "avoid", style: "rock", position: { x: 236, y: 0 }, width: 1.25, height: 0.75 },
      { id: "forest-crates", behavior: "breakable", style: "crates", position: { x: 55, y: 0 }, width: 1.1, height: 1.15, breakSpeed: 7 },
      { id: "forest-tires", behavior: "avoid", style: "tires", position: { x: 492, y: 0 }, width: 1.15, height: 0.8 },
    ],
  },
  {
    id: "canyon", name: "Cañón Salvaje", tagline: "Gargantas profundas y grandes vuelos", difficulty: 2,
    capabilities: ["Megasalto turbo", "Saltos de cañón", "Looping roto"],
    theme: { skyTop: 0x55b8df, skyBottom: 0xffddb0, ground: 0xa85b32, scenery: 0x743e35, road: 0x8b4b28, roadEdge: 0xffc260, abyss: 0x1b1015, accent: 0xffb12b },
    physics: { gravity: -10, grip: 1.45, suspensionFrequency: 4.4, suspensionDamping: 0.88 },
    gapWidths: [18, 6, 10, 9.5], rampHeights: [4.2, 3.6, 4, 3.4],
    rampStyles: ["smooth", "kicker", "wave", "smooth"],
    loopDesign: { fullCenterX: 180, fullRadius: 4, brokenCenterX: 380, brokenRadius: 4, brokenEndAngle: Math.PI * 1.25, brokenGap: 3 },
    springboards: [
      { id: "canyon-one", position: { x: 232, y: 0 }, width: 3.2, verticalBoost: 15, forwardBoost: 4.5 },
      { id: "canyon-two", position: { x: 318, y: 0 }, width: 3.2, verticalBoost: 15.5, forwardBoost: 4.5 },
      { id: "canyon-three", position: { x: 488, y: 0 }, width: 3.6, verticalBoost: 16, forwardBoost: 5 },
    ],
    obstacles: [
      { id: "canyon-rock", behavior: "avoid", style: "rock", position: { x: 236, y: 0 }, width: 1.45, height: 0.9 },
      { id: "canyon-crates", behavior: "breakable", style: "crates", position: { x: 55, y: 0 }, width: 1.2, height: 1.25, breakSpeed: 7.5 },
      { id: "canyon-roadblock", behavior: "breakable", style: "roadblock", position: { x: 492, y: 0 }, width: 1.3, height: 1.1, breakSpeed: 8.5 },
      { id: "canyon-tires", behavior: "avoid", style: "tires", position: { x: 322, y: 0 }, width: 1.2, height: 0.85 },
    ],
  },
  {
    id: "neon", name: "Ciudad Neón", tagline: "Velocidad, rebotes y luces eléctricas", difficulty: 3,
    capabilities: ["Megasalto turbo", "Looping gigante", "Rampas escalonadas"],
    theme: { skyTop: 0x171448, skyBottom: 0x593783, ground: 0x18172d, scenery: 0x29265d, road: 0x26354e, roadEdge: 0x26f7ff, abyss: 0x06040f, accent: 0xff3bda },
    physics: { gravity: -10.5, grip: 1.7, suspensionFrequency: 4.8, suspensionDamping: 0.92 },
    gapWidths: [18, 6, 8, 7], rampHeights: [4, 3.4, 4, 3.5],
    rampStyles: ["smooth", "kicker", "stepped", "wave"],
    loopDesign: { fullCenterX: 192, fullRadius: 5.1, brokenCenterX: 366, brokenRadius: 3.15, brokenEndAngle: Math.PI * 1.08, brokenGap: 6.5 },
    springboards: [218, 300, 408, 500].map((x, index) => ({ id: `neon-${index}`, position: { x, y: 0 }, width: 3, verticalBoost: 14 + index, forwardBoost: 5 })),
    obstacles: [
      { id: "neon-tires", behavior: "avoid", style: "tires", position: { x: 222, y: 0 }, width: 1.2, height: 0.8 },
      { id: "neon-roadblock", behavior: "breakable", style: "roadblock", position: { x: 55, y: 0 }, width: 1.25, height: 1.1, breakSpeed: 8 },
      { id: "neon-crates", behavior: "breakable", style: "crates", position: { x: 405, y: 0 }, width: 1.1, height: 1.2, breakSpeed: 8 },
    ],
  },
  {
    id: "volcano", name: "Volcán Furia", tagline: "La pista más agresiva de la Tierra", difficulty: 4,
    capabilities: ["Megasalto turbo", "Looping roto enorme", "Rampas extremas"],
    theme: { skyTop: 0x571c23, skyBottom: 0xf56c3b, ground: 0x3b2424, scenery: 0x271617, road: 0x4b3330, roadEdge: 0xff8a33, abyss: 0x190505, accent: 0xff4b22 },
    physics: { gravity: -11.5, grip: 1.55, suspensionFrequency: 5.2, suspensionDamping: 0.94 },
    gapWidths: [19, 9, 10, 10], rampHeights: [5, 4.8, 5.2, 4.6],
    rampStyles: ["kicker", "wave", "kicker", "stepped"],
    loopDesign: { fullCenterX: 174, fullRadius: 4.6, brokenCenterX: 394, brokenRadius: 5.25, brokenEndAngle: Math.PI * 1.46, brokenGap: 2.2 },
    springboards: [205, 244, 320, 418, 492].map((x, index) => ({ id: `volcano-${index}`, position: { x, y: 0 }, width: 3.2, verticalBoost: 16 + index * 0.4, forwardBoost: 5.5 })),
    obstacles: [
      { id: "volcano-rock-one", behavior: "avoid", style: "rock", position: { x: 209, y: 0 }, width: 1.55, height: 1 },
      { id: "volcano-roadblock", behavior: "breakable", style: "roadblock", position: { x: 55, y: 0 }, width: 1.35, height: 1.25, breakSpeed: 8.5 },
      { id: "volcano-rock-two", behavior: "avoid", style: "rock", position: { x: 422, y: 0 }, width: 1.3, height: 0.9 },
      { id: "volcano-crates", behavior: "breakable", style: "crates", position: { x: 495, y: 0 }, width: 1.25, height: 1.3, breakSpeed: 9 },
    ],
  },
  {
    id: "moon", name: "Base Lunar", tagline: "Gravedad baja y saltos gigantes", difficulty: 5,
    capabilities: ["Megasalto turbo XL", "Looping lunar XL", "Vuelos largos"],
    theme: { skyTop: 0x070b22, skyBottom: 0x283460, ground: 0x777b91, scenery: 0x494e6b, road: 0x515772, roadEdge: 0xc8e6ff, abyss: 0x02030a, accent: 0x95f5ff },
    physics: { gravity: -6.2, grip: 1.25, suspensionFrequency: 3.5, suspensionDamping: 0.82 },
    gapWidths: [27, 11, 13, 12], rampHeights: [4.5, 4.2, 4.8, 4.4],
    rampStyles: ["smooth", "smooth", "wave", "smooth"],
    loopDesign: { fullCenterX: 188, fullRadius: 6, brokenCenterX: 372, brokenRadius: 4.7, brokenEndAngle: Math.PI * 1.16, brokenGap: 5 },
    springboards: [190, 228, 310, 350, 420, 490].map((x, index) => ({ id: `moon-${index}`, position: { x, y: 0 }, width: 3.5, verticalBoost: 11 + index * 0.3, forwardBoost: 4.5 })),
    obstacles: [
      { id: "moon-rock", behavior: "avoid", style: "rock", position: { x: 194, y: 0 }, width: 1.3, height: 0.9 },
      { id: "moon-crates", behavior: "breakable", style: "crates", position: { x: 55, y: 0 }, width: 1.2, height: 1.25, breakSpeed: 6 },
      { id: "moon-roadblock", behavior: "breakable", style: "roadblock", position: { x: 494, y: 0 }, width: 1.35, height: 1.2, breakSpeed: 6 },
      { id: "moon-tires", behavior: "avoid", style: "tires", position: { x: 354, y: 0 }, width: 1.2, height: 0.85 },
    ],
  },
] as const;

function buildTrack(profile: TrackProfile): TrackDefinition {
  const [gap1, gap2, gap3, gap4] = profile.gapWidths;
  const [ramp1, ramp2, ramp3, ramp4] = profile.rampHeights;
  const landing1 = 96 + gap1;
  const landing2 = 264 + gap2;
  const landing3 = 442 + gap3;
  const landing4 = 532 + gap4;
  const { fullCenterX, fullRadius, brokenCenterX, brokenRadius, brokenEndAngle, brokenGap } = profile.loopDesign;
  const fullCenter = { x: fullCenterX, y: fullRadius + 3 };
  const brokenCenter = { x: brokenCenterX, y: brokenRadius + 3 };
  const fullLoop = arc({ id: "full-loop", center: fullCenter, radius: fullRadius, startAngle: -Math.PI / 2, endAngle: (3 * Math.PI) / 2, samples: 64, closed: true });
  const incompleteLoop = arc({ id: "incomplete-loop", center: brokenCenter, radius: brokenRadius, startAngle: -Math.PI / 2, endAngle: brokenEndAngle, samples: 44 });
  const brokenExit = incompleteLoop.points.at(-1) ?? { x: brokenCenterX, y: 3 };
  const brokenLandingX = Math.min(brokenExit.x + brokenGap, 414);

  const segments: TrackSegment[] = [
      line("reverse-runway", { x: -140, y: 0 }, { x: 76, y: 0 }),
      ramp("first-ramp", 76, 96, ramp1, profile.rampStyles[0]),
      line("first-landing", { x: landing1, y: 1.2 }, { x: landing1 + 13, y: 0 }, { x: fullCenterX - 22, y: 0 }, { x: fullCenterX - 12, y: 1.6 }, { x: fullCenterX - 4, y: 3 }, { x: fullCenterX, y: 3 }),
      fullLoop,
      line("between-loops", { x: fullCenterX, y: 3 }, { x: fullCenterX + 22, y: 3 }, { x: fullCenterX + 38, y: 0 }, { x: 242, y: 0 }),
      ramp("cliff-ramp", 242, 264, ramp2, profile.rampStyles[1]),
      line("cliff-landing", { x: landing2, y: 0.8 }, { x: landing2 + 14, y: 0 }, { x: brokenCenterX - 36, y: 1.2 }, { x: brokenCenterX - 28, y: 0 }, { x: brokenCenterX - 16, y: 2 }, { x: brokenCenterX - 4, y: 3 }, { x: brokenCenterX, y: 3 }),
      incompleteLoop,
      line("broken-loop-landing", { x: brokenLandingX, y: 1.7 }, { x: Math.min(brokenLandingX + 9, 418), y: 0 }, { x: 420, y: 0 }),
      ramp("canyon-ramp", 420, 442, ramp3, profile.rampStyles[2]),
      line("canyon-landing", { x: landing3, y: 0.8 }, { x: landing3 + 14, y: 0 }, { x: 510, y: 0 }),
      ramp("final-ramp", 510, 532, ramp4, profile.rampStyles[3]),
      line("finish-road", { x: landing4, y: 0.6 }, { x: landing4 + 13, y: 0 }, { x: 588, y: 0 }),
  ];
  return {
    ...profile,
    segments,
    loopGuides: [
      { id: "full-loop", kind: "full", center: fullCenter, pathRadius: Math.max(2.4, fullRadius - 0.8), startAngle: -Math.PI / 2, endAngle: (3 * Math.PI) / 2, entryX: fullCenterX - Math.max(2.4, fullRadius - 0.8) },
      { id: "incomplete-loop", kind: "incomplete", center: brokenCenter, pathRadius: Math.max(2.3, brokenRadius - 0.8), startAngle: -Math.PI / 2, endAngle: brokenEndAngle, entryX: brokenCenterX - Math.max(2.3, brokenRadius - 0.8) },
    ],
    checkpoints: [
      { id: "start", position: { x: -12, y: 1.1 }, angle: 0, radius: 2 },
      { id: "first-landing", position: { x: landing1 + 5, y: 2.2 }, angle: -0.08, radius: 5 },
      { id: "full-loop", position: { x: fullCenterX - fullRadius - 4, y: 4.1 }, angle: 0, radius: 3 },
      { id: "cliff-landing", position: { x: landing2 + 6, y: 2 }, angle: -0.08, radius: 6 },
      { id: "incomplete-loop", position: { x: brokenCenterX - brokenRadius - 4, y: 4.1 }, angle: 0, radius: 3 },
      { id: "broken-loop-exit", position: { x: brokenLandingX, y: 2 }, angle: -0.15, radius: 4 },
      { id: "canyon-landing", position: { x: landing3 + 6, y: 2 }, angle: -0.08, radius: 6 },
      { id: "final-landing", position: { x: landing4 + 6, y: 1.8 }, angle: -0.05, radius: 6 },
    ],
    springboards: profile.springboards.map((board) => ({
      ...board,
      position: { ...board.position, y: trackSurfaceYAt(segments, board.position.x) },
    })),
    obstacles: profile.obstacles.map((obstacle) => ({
      ...obstacle,
      position: { ...obstacle.position, y: trackSurfaceYAt(segments, obstacle.position.x) },
    })),
    hazards: [
      { id: "first-gorge", startX: 96, endX: landing1, depth: 8, requiresTurbo: true },
      { id: "middle-gorge", startX: 264, endX: landing2, depth: 10 },
      { id: "deep-canyon", startX: 442, endX: landing3, depth: 12 },
      { id: "final-chasm", startX: 532, endX: landing4, depth: 11 },
    ],
    killY: -12,
  };
}

function ramp(id: string, startX: number, endX: number, height: number, style: RampStyle): TrackSegment {
  const width = endX - startX;
  if (style === "kicker") return line(id, { x: startX, y: 0 }, { x: startX + width * 0.58, y: 0 }, { x: startX + width * 0.82, y: height * 0.35 }, { x: endX, y: height });
  if (style === "wave") return line(id, { x: startX, y: 0 }, { x: startX + width * 0.28, y: height * 0.45 }, { x: startX + width * 0.5, y: height * 0.2 }, { x: startX + width * 0.75, y: height * 0.68 }, { x: endX, y: height });
  if (style === "stepped") return line(id, { x: startX, y: 0 }, { x: startX + width * 0.3, y: height * 0.22 }, { x: startX + width * 0.48, y: height * 0.22 }, { x: startX + width * 0.68, y: height * 0.58 }, { x: startX + width * 0.82, y: height * 0.58 }, { x: endX, y: height });
  return line(id, { x: startX, y: 0 }, { x: startX + width * 0.25, y: height * 0.08 }, { x: startX + width * 0.52, y: height * 0.32 }, { x: startX + width * 0.78, y: height * 0.7 }, { x: endX, y: height });
}

export function trackSurfaceYAt(segments: readonly TrackSegment[], x: number): number {
  const candidates: number[] = [];
  for (const segment of segments) {
    if (segment.kind !== "line") continue;
    for (let index = 0; index < segment.points.length - 1; index += 1) {
      const start = segment.points[index];
      const end = segment.points[index + 1];
      const minimum = Math.min(start.x, end.x);
      const maximum = Math.max(start.x, end.x);
      if (x < minimum || x > maximum) continue;
      const width = end.x - start.x;
      const progress = Math.abs(width) < 0.0001 ? 0 : (x - start.x) / width;
      candidates.push(start.y + (end.y - start.y) * progress);
    }
  }
  return candidates.length > 0 ? Math.max(...candidates) : 0;
}

export const TRACKS: readonly TrackDefinition[] = PROFILES.map(buildTrack);

export function getTrack(id: TrackId): TrackDefinition {
  return TRACKS.find((track) => track.id === id) ?? TRACKS[0];
}

export function getNextTrackId(id: TrackId): TrackId {
  const index = TRACKS.findIndex((track) => track.id === id);
  return TRACKS[(index + 1) % TRACKS.length].id ?? "forest";
}

export function createDefaultTrack(): TrackDefinition {
  return getTrack("canyon");
}

export function isTrackId(value: string): value is TrackId {
  return TRACKS.some((track) => track.id === value);
}

export function renderPolylines(track: TrackDefinition): Point[][] {
  return track.segments.map((segment) => {
    const points = segment.points.map((point) => ({ ...point }));
    if (segment.closed) points.push({ ...points[0] });
    return points;
  });
}

export function physicsToScreen(point: Point, pixelsPerMetre: number, origin: Point): Point {
  return { x: origin.x + point.x * pixelsPerMetre, y: origin.y - point.y * pixelsPerMetre };
}
