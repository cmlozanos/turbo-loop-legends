export type CarId = "comet" | "lynx" | "titan" | "spark" | "gecko" | "mammoth";
export type CarSize = "small" | "medium" | "large";

export interface CarCapabilities {
  size: CarSize;
  acceleration: number;
  braking: number;
  grip: number;
  jump: number;
  power: number;
}

export interface CarSpec {
  id: CarId;
  name: string;
  tagline: string;
  color: number;
  accent: number;
  asset: string;
  gameAsset: string;
  bodyScale: number;
  exhaustOffset: { x: number; y: number };
  motor: number;
  grip: number;
  airControl: number;
  wheelRadius: number;
  wheelName: string;
  capabilities: CarCapabilities;
  unlock: string;
}

export const CARS: CarSpec[] = [
  {
    id: "comet",
    name: "Cometa",
    tagline: "Rápido y equilibrado",
    color: 0xe54737,
    accent: 0xffd166,
    asset: "cars/comet-preview.svg",
    gameAsset: "cars/comet-body.png",
    bodyScale: 0.27,
    exhaustOffset: { x: -1.42, y: 0.12 },
    motor: 1,
    grip: 1,
    airControl: 1,
    wheelRadius: 21,
    wheelName: "Ruedas sport",
    capabilities: { size: "medium", acceleration: 3, braking: 3, grip: 3, jump: 3, power: 2 },
    unlock: "Listo para correr"
  },
  {
    id: "lynx",
    name: "Lince",
    tagline: "Domina los saltos",
    color: 0x25a8e0,
    accent: 0xa8ecff,
    asset: "cars/lynx-preview.svg",
    gameAsset: "cars/lynx-body.png",
    bodyScale: 0.29,
    exhaustOffset: { x: -1.5, y: 0.18 },
    motor: 1.02,
    grip: 0.96,
    airControl: 1.12,
    wheelRadius: 24,
    wheelName: "Ruedas de salto",
    capabilities: { size: "medium", acceleration: 4, braking: 3, grip: 3, jump: 5, power: 2 },
    unlock: "Supera el looping roto"
  },
  {
    id: "titan",
    name: "Titán",
    tagline: "Agarre imparable",
    color: 0x7f5af0,
    accent: 0xf3c4ff,
    asset: "cars/titan-preview.svg",
    gameAsset: "cars/titan-body.png",
    bodyScale: 0.27,
    exhaustOffset: { x: -1.48, y: 0.08 },
    motor: 0.94,
    grip: 1.12,
    airControl: 0.92,
    wheelRadius: 21,
    wheelName: "Ruedas de agarre",
    capabilities: { size: "large", acceleration: 2, braking: 4, grip: 5, jump: 2, power: 5 },
    unlock: "Cruza la meta"
  },
  {
    id: "spark",
    name: "Chispa",
    tagline: "Pequeño, rápido y saltarín",
    color: 0xffc928,
    accent: 0x7af5ff,
    asset: "cars/spark-preview.svg",
    gameAsset: "cars/spark-body.png",
    bodyScale: 0.25,
    exhaustOffset: { x: -1.34, y: 0.08 },
    motor: 1.14,
    grip: 0.92,
    airControl: 1.16,
    wheelRadius: 19,
    wheelName: "Ruedas ligeras",
    capabilities: { size: "small", acceleration: 5, braking: 3, grip: 2, jump: 4, power: 1 },
    unlock: "Disponible"
  },
  {
    id: "gecko",
    name: "Gecko",
    tagline: "Frena y se pega al suelo",
    color: 0x34d17b,
    accent: 0xc8ff6a,
    asset: "cars/gecko-preview.svg",
    gameAsset: "cars/gecko-body.png",
    bodyScale: 0.27,
    exhaustOffset: { x: -1.42, y: 0.1 },
    motor: 1,
    grip: 1.22,
    airControl: 0.96,
    wheelRadius: 22,
    wheelName: "Ruedas ventosa",
    capabilities: { size: "medium", acceleration: 3, braking: 5, grip: 5, jump: 2, power: 2 },
    unlock: "Disponible"
  },
  {
    id: "mammoth",
    name: "Mamut",
    tagline: "Enorme y capaz de aplastarlo todo",
    color: 0xff7a31,
    accent: 0xffe26a,
    asset: "cars/mammoth-preview.svg",
    gameAsset: "cars/mammoth-body.png",
    bodyScale: 0.3,
    exhaustOffset: { x: -1.55, y: 0.14 },
    motor: 0.9,
    grip: 1.14,
    airControl: 0.84,
    wheelRadius: 27,
    wheelName: "Ruedas gigantes",
    capabilities: { size: "large", acceleration: 2, braking: 3, grip: 4, jump: 2, power: 5 },
    unlock: "Disponible"
  }
];

export function getCar(id: CarId): CarSpec {
  return CARS.find((car) => car.id === id) ?? CARS[0];
}

export function isCarId(value: string): value is CarId {
  return CARS.some((car) => car.id === value);
}
