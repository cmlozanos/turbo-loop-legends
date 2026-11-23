import type { VehicleInput, VehicleSnapshot } from "./physics";
import type { TrackId } from "./track";

export interface RoadEffectsInput {
  /** Signed road speed in physics metres/second, NOT the HUD's speed × 9. */
  speed: number;
  grounded: VehicleSnapshot["grounded"];
  /** Effective simulation input, including reverse, rather than raw pedal state. */
  throttle: NonNullable<VehicleInput["throttle"]>;
  turbo: boolean;
  brake: boolean;
  lightMode: boolean;
  /** Resolved appearance.motion: false disables all decorative particles. */
  motion: boolean;
  trackId: TrackId;
}

export interface RoadEffectEmission {
  kind: "sand" | "dust" | "exhaust" | "brakeSmoke";
  /** Particles/second for the ENTIRE effect, not per wheel. No frame accumulator. */
  rate: number;
  /** Hard live-particle cap; drop emissions when full, never queue catch-up bursts. */
  maxParticles: number;
  tint: number;
  alpha: number;
  lifespanSeconds: number;
  /** Screen-pixel radii; fade alpha to zero over the lifetime. */
  radiusStart: number;
  radiusEnd: number;
}

export interface RoadEffectsPlan {
  /** Sum of the three independent pool caps, including inactive effects. */
  maxParticles: number;
  dust: RoadEffectEmission;
  exhaust: RoadEffectEmission;
  brakeSmoke: RoadEffectEmission;
}

const DUST_TINTS: Record<TrackId, number> = {
  forest: 0xb6a381,
  canyon: 0xd8c28f,
  neon: 0xb8c2ce,
  volcano: 0xb4aaa1,
  moon: 0xc2c4cf,
  jungle: 0xb6ad88,
  glacier: 0xdcecf2,
  factory: 0xb8b9b7,
};

/**
 * Pure decorative policy: no Phaser, randomness, clocks or vehicle damage state.
 * Anchor dust/brake smoke at contacting wheels and exhaust at car.exhaustOffset.
 * grounded means at least one wheel touches: the renderer must not duplicate the
 * total rate on both wheels, or place dust on a wheel known to be airborne.
 */
export function roadEffectsPlan(input: RoadEffectsInput): RoadEffectsPlan {
  const speed = Number.isFinite(input.speed) ? Math.min(30, Math.abs(input.speed)) : 0;
  const throttle = Number.isFinite(input.throttle) ? Math.min(1, Math.abs(input.throttle)) : 0;
  const moving = speed > 0.5;
  const rolling = input.grounded && moving;
  const driving = moving && throttle > 0.001 && !input.brake;
  const speedFactor = Math.min(1, speed / 15);
  const enabled = input.motion;
  const dustCap = enabled ? (input.lightMode ? 7 : 24) : 0;
  const exhaustCap = enabled ? (input.lightMode ? 3 : 10) : 0;
  const brakeCap = enabled ? (input.lightMode ? 2 : 6) : 0;

  return {
    maxParticles: dustCap + exhaustCap + brakeCap,
    dust: {
      kind: input.trackId === "canyon" ? "sand" : "dust",
      rate: rolling ? dustCap * speedFactor : 0,
      maxParticles: dustCap,
      tint: DUST_TINTS[input.trackId],
      alpha: 0.3,
      lifespanSeconds: 0.45,
      radiusStart: 2,
      radiusEnd: 6,
    },
    exhaust: {
      kind: "exhaust",
      rate: driving ? exhaustCap * throttle * (input.turbo ? 1 : 0.55) : 0,
      maxParticles: exhaustCap,
      // Pale, brief tailpipe puffs read as engine activity, not a damaged engine.
      tint: 0xe3e8e8,
      alpha: 0.18,
      lifespanSeconds: 0.35,
      radiusStart: 1.5,
      radiusEnd: 4,
    },
    brakeSmoke: {
      kind: "brakeSmoke",
      rate: rolling && input.brake && speed > 2 ? brakeCap * speedFactor : 0,
      maxParticles: brakeCap,
      tint: 0xe3e8e8,
      alpha: 0.22,
      lifespanSeconds: 0.3,
      radiusStart: 2,
      radiusEnd: 5,
    },
  };
}
