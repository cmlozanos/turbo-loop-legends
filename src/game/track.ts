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

export interface TrackDefinition {
  id?: TrackId;
  name?: string;
  tagline?: string;
  difficulty?: number;
  capabilities?: readonly string[];
  theme?: TrackTheme;
  physics?: TrackPhysics;
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
  springboards: readonly Springboard[];
}

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
    capabilities: ["Rampas suaves", "2 saltadores", "Precipicios cortos"],
    theme: { skyTop: 0x79ccec, skyBottom: 0xeaf8f2, ground: 0x4f8e52, scenery: 0x376b42, road: 0x9b5a2f, roadEdge: 0xe6ad62, abyss: 0x15202b, accent: 0x5ce1a5 },
    physics: { gravity: -9.5, grip: 1.5, suspensionFrequency: 4.3, suspensionDamping: 0.9 },
    gapWidths: [8, 7, 7, 7], rampHeights: [3.2, 3, 3.2, 2.8],
    springboards: [
      { id: "forest-one", position: { x: 232, y: 0 }, width: 3.2, verticalBoost: 13, forwardBoost: 3.5 },
      { id: "forest-two", position: { x: 488, y: 0 }, width: 3.4, verticalBoost: 14, forwardBoost: 4 },
    ],
  },
  {
    id: "canyon", name: "Cañón Salvaje", tagline: "Gargantas profundas y grandes vuelos", difficulty: 2,
    capabilities: ["4 precipicios", "3 saltadores", "Looping roto"],
    theme: { skyTop: 0x55b8df, skyBottom: 0xffddb0, ground: 0xa85b32, scenery: 0x743e35, road: 0x8b4b28, roadEdge: 0xffc260, abyss: 0x1b1015, accent: 0xffb12b },
    physics: { gravity: -10, grip: 1.45, suspensionFrequency: 4.4, suspensionDamping: 0.88 },
    gapWidths: [11.5, 6, 10, 9.5], rampHeights: [4.2, 3.6, 4, 3.4],
    springboards: [
      { id: "canyon-one", position: { x: 232, y: 0 }, width: 3.2, verticalBoost: 15, forwardBoost: 4.5 },
      { id: "canyon-two", position: { x: 318, y: 0 }, width: 3.2, verticalBoost: 15.5, forwardBoost: 4.5 },
      { id: "canyon-three", position: { x: 488, y: 0 }, width: 3.6, verticalBoost: 16, forwardBoost: 5 },
    ],
  },
  {
    id: "neon", name: "Ciudad Neón", tagline: "Velocidad, rebotes y luces eléctricas", difficulty: 3,
    capabilities: ["4 turbos de suelo", "Rampas altas", "Agarre máximo"],
    theme: { skyTop: 0x171448, skyBottom: 0x593783, ground: 0x18172d, scenery: 0x29265d, road: 0x26354e, roadEdge: 0x26f7ff, abyss: 0x06040f, accent: 0xff3bda },
    physics: { gravity: -10.5, grip: 1.7, suspensionFrequency: 4.8, suspensionDamping: 0.92 },
    gapWidths: [8, 6, 8, 7], rampHeights: [4, 3.4, 4, 3.5],
    springboards: [218, 300, 408, 500].map((x, index) => ({ id: `neon-${index}`, position: { x, y: 0 }, width: 3, verticalBoost: 14 + index, forwardBoost: 5 })),
  },
  {
    id: "volcano", name: "Volcán Furia", tagline: "La pista más agresiva de la Tierra", difficulty: 4,
    capabilities: ["Gravedad fuerte", "Rampas extremas", "5 saltadores"],
    theme: { skyTop: 0x571c23, skyBottom: 0xf56c3b, ground: 0x3b2424, scenery: 0x271617, road: 0x4b3330, roadEdge: 0xff8a33, abyss: 0x190505, accent: 0xff4b22 },
    physics: { gravity: -11.5, grip: 1.55, suspensionFrequency: 5.2, suspensionDamping: 0.94 },
    gapWidths: [10, 9, 10, 10], rampHeights: [5, 4.8, 5.2, 4.6],
    springboards: [205, 244, 320, 418, 492].map((x, index) => ({ id: `volcano-${index}`, position: { x, y: 0 }, width: 3.2, verticalBoost: 16 + index * 0.4, forwardBoost: 5.5 })),
  },
  {
    id: "moon", name: "Base Lunar", tagline: "Gravedad baja y saltos gigantes", difficulty: 5,
    capabilities: ["Baja gravedad", "Vuelos largos", "6 saltadores"],
    theme: { skyTop: 0x070b22, skyBottom: 0x283460, ground: 0x777b91, scenery: 0x494e6b, road: 0x515772, roadEdge: 0xc8e6ff, abyss: 0x02030a, accent: 0x95f5ff },
    physics: { gravity: -6.2, grip: 1.25, suspensionFrequency: 3.5, suspensionDamping: 0.82 },
    gapWidths: [13, 11, 13, 12], rampHeights: [4.5, 4.2, 4.8, 4.4],
    springboards: [190, 228, 310, 350, 420, 490].map((x, index) => ({ id: `moon-${index}`, position: { x, y: 0 }, width: 3.5, verticalBoost: 11 + index * 0.3, forwardBoost: 4.5 })),
  },
] as const;

function buildTrack(profile: TrackProfile): TrackDefinition {
  const [gap1, gap2, gap3, gap4] = profile.gapWidths;
  const [ramp1, ramp2, ramp3, ramp4] = profile.rampHeights;
  const landing1 = 96 + gap1;
  const landing2 = 264 + gap2;
  const landing3 = 442 + gap3;
  const landing4 = 532 + gap4;
  const fullLoop = arc({ id: "full-loop", center: { x: 180, y: 7 }, radius: 4, startAngle: -Math.PI / 2, endAngle: (3 * Math.PI) / 2, samples: 64, closed: true });
  const incompleteLoop = arc({ id: "incomplete-loop", center: { x: 380, y: 7 }, radius: 4, startAngle: -Math.PI / 2, endAngle: (5 * Math.PI) / 4, samples: 44 });

  return {
    ...profile,
    segments: [
      line("reverse-runway", { x: -140, y: 0 }, { x: 76, y: 0 }),
      line("first-ramp", { x: 76, y: 0 }, { x: 84, y: 0 }, { x: 96, y: ramp1 }),
      line("first-landing", { x: landing1, y: 1.2 }, { x: landing1 + 13, y: 0 }, { x: 158, y: 0 }, { x: 168, y: 1.8 }, { x: 176, y: 3 }, { x: 180, y: 3 }),
      fullLoop,
      line("between-loops", { x: 180, y: 3 }, { x: 205, y: 3 }, { x: 220, y: 0 }, { x: 242, y: 0 }),
      line("cliff-ramp", { x: 242, y: 0 }, { x: 252, y: 0 }, { x: 264, y: ramp2 }),
      line("cliff-landing", { x: landing2, y: 0.8 }, { x: landing2 + 14, y: 0 }, { x: 344, y: 1.2 }, { x: 352, y: 0 }, { x: 364, y: 2 }, { x: 376, y: 3 }, { x: 380, y: 3 }),
      incompleteLoop,
      line("broken-loop-landing", { x: 379.5, y: 1.7 }, { x: 396, y: 0 }, { x: 420, y: 0 }),
      line("canyon-ramp", { x: 420, y: 0 }, { x: 430, y: 0 }, { x: 442, y: ramp3 }),
      line("canyon-landing", { x: landing3, y: 0.8 }, { x: landing3 + 14, y: 0 }, { x: 510, y: 0 }),
      line("final-ramp", { x: 510, y: 0 }, { x: 520, y: 0 }, { x: 532, y: ramp4 }),
      line("finish-road", { x: landing4, y: 0.6 }, { x: landing4 + 13, y: 0 }, { x: 588, y: 0 }),
    ],
    checkpoints: [
      { id: "start", position: { x: -12, y: 1.1 }, angle: 0, radius: 2 },
      { id: "first-landing", position: { x: landing1 + 5, y: 2.2 }, angle: -0.08, radius: 5 },
      { id: "full-loop", position: { x: 172, y: 4.1 }, angle: 0, radius: 3 },
      { id: "cliff-landing", position: { x: landing2 + 6, y: 2 }, angle: -0.08, radius: 6 },
      { id: "incomplete-loop", position: { x: 372, y: 4.1 }, angle: 0, radius: 3 },
      { id: "broken-loop-exit", position: { x: 394, y: 2 }, angle: -0.15, radius: 4 },
      { id: "canyon-landing", position: { x: landing3 + 6, y: 2 }, angle: -0.08, radius: 6 },
      { id: "final-landing", position: { x: landing4 + 6, y: 1.8 }, angle: -0.05, radius: 6 },
    ],
    springboards: profile.springboards,
    hazards: [
      { id: "first-gorge", startX: 96, endX: landing1, depth: 8 },
      { id: "middle-gorge", startX: 264, endX: landing2, depth: 10 },
      { id: "deep-canyon", startX: 442, endX: landing3, depth: 12 },
      { id: "final-chasm", startX: 532, endX: landing4, depth: 11 },
    ],
    killY: -12,
  };
}

export const TRACKS: readonly TrackDefinition[] = PROFILES.map(buildTrack);

export function getTrack(id: TrackId): TrackDefinition {
  return TRACKS.find((track) => track.id === id) ?? TRACKS[0];
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
