export type CarId = "comet" | "lynx" | "titan";

export interface CarSpec {
  id: CarId;
  name: string;
  tagline: string;
  color: number;
  accent: number;
  motor: number;
  grip: number;
  airControl: number;
  unlock: string;
}

export const CARS: CarSpec[] = [
  {
    id: "comet",
    name: "Cometa",
    tagline: "Rápido y equilibrado",
    color: 0xe54737,
    accent: 0xffd166,
    motor: 1,
    grip: 1,
    airControl: 1,
    unlock: "Listo para correr"
  },
  {
    id: "lynx",
    name: "Lince",
    tagline: "Domina los saltos",
    color: 0x25a8e0,
    accent: 0xa8ecff,
    motor: 1.02,
    grip: 0.96,
    airControl: 1.12,
    unlock: "Supera el looping roto"
  },
  {
    id: "titan",
    name: "Titán",
    tagline: "Agarre imparable",
    color: 0x7f5af0,
    accent: 0xf3c4ff,
    motor: 0.94,
    grip: 1.12,
    airControl: 0.92,
    unlock: "Cruza la meta"
  }
];

export function getCar(id: CarId): CarSpec {
  return CARS.find((car) => car.id === id) ?? CARS[0];
}
