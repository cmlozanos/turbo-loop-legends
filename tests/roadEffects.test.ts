import { describe, expect, it } from "vitest";
import { roadEffectsPlan, type RoadEffectsInput } from "../src/game/roadEffects";
import type { TrackId } from "../src/game/track";

const driving: RoadEffectsInput = {
  speed: 12, grounded: true, throttle: 1, turbo: false, brake: false,
  lightMode: false, motion: true, trackId: "canyon",
};

const tracks: TrackId[] = ["forest", "canyon", "neon", "volcano", "moon", "jungle", "glacier", "factory"];

function rates(input: RoadEffectsInput): number[] {
  const plan = roadEffectsPlan(input);
  return [plan.dust.rate, plan.exhaust.rate, plan.brakeSmoke.rate];
}

describe("road effects rate policy", () => {
  it("is deterministic, does not mutate input, and needs no elapsed-time state", () => {
    const input = Object.freeze({ ...driving });
    expect(roadEffectsPlan(input)).toEqual(roadEffectsPlan(input));
    expect(input).toEqual(driving);
    const changed = roadEffectsPlan(input);
    changed.dust.rate = 0;
    expect(roadEffectsPlan(input).dust.rate).toBeGreaterThan(0);
  });

  it("emits wheel dust when rolling even without throttle, never while airborne or still", () => {
    expect(roadEffectsPlan({ ...driving, throttle: 0 }).dust.rate).toBeGreaterThan(0);
    expect(roadEffectsPlan({ ...driving, grounded: false }).dust.rate).toBe(0);
    expect(rates({ ...driving, speed: 0, turbo: true, brake: true })).toEqual([0, 0, 0]);
    expect(rates({ ...driving, speed: 0.1 })).toEqual([0, 0, 0]);
  });

  it("requires moving drive input for exhaust; turbo alone and braking are not driving", () => {
    expect(roadEffectsPlan(driving).exhaust.rate).toBeGreaterThan(0);
    expect(roadEffectsPlan({ ...driving, throttle: 0, turbo: true }).exhaust.rate).toBe(0);
    expect(roadEffectsPlan({ ...driving, throttle: 0.001 }).exhaust.rate).toBe(0);
    expect(roadEffectsPlan({ ...driving, brake: true, turbo: true }).exhaust.rate).toBe(0);
    expect(roadEffectsPlan({ ...driving, grounded: false }).exhaust.rate).toBeGreaterThan(0);
    expect(roadEffectsPlan({ ...driving, turbo: true }).exhaust.rate).toBeGreaterThan(roadEffectsPlan(driving).exhaust.rate);
  });

  it("emits brake smoke only with actual speed, wheel contact and effective brake input", () => {
    expect(roadEffectsPlan(driving).brakeSmoke.rate).toBe(0);
    expect(roadEffectsPlan({ ...driving, brake: true }).brakeSmoke.rate).toBeGreaterThan(0);
    expect(roadEffectsPlan({ ...driving, brake: true, speed: 1 }).brakeSmoke.rate).toBe(0);
    expect(roadEffectsPlan({ ...driving, brake: true, grounded: false }).brakeSmoke.rate).toBe(0);
  });

  it("treats reverse as movement and scales rates with bounded actual speed", () => {
    expect(rates({ ...driving, speed: -12, throttle: -1 })).toEqual(rates(driving));
    expect(roadEffectsPlan({ ...driving, speed: 3 }).dust.rate).toBeLessThan(roadEffectsPlan(driving).dust.rate);
    expect(rates({ ...driving, speed: 1e300, throttle: 1e300 })).toEqual(rates({ ...driving, speed: 30 }));
  });

  it.each([NaN, Infinity, -Infinity])("fails closed for invalid speed %s", speed => {
    expect(rates({ ...driving, speed, brake: true, turbo: true })).toEqual([0, 0, 0]);
  });

  it.each([NaN, Infinity, -Infinity])("does not invent engine activity for invalid throttle %s", throttle => {
    expect(roadEffectsPlan({ ...driving, throttle }).exhaust.rate).toBe(0);
  });

  it.each([false, true])("disables every rate and pool budget when motion is reduced (light=%s)", lightMode => {
    const plan = roadEffectsPlan({ ...driving, motion: false, brake: true, turbo: true, lightMode });
    expect(rates({ ...driving, motion: false, brake: true, turbo: true, lightMode })).toEqual([0, 0, 0]);
    expect(plan.maxParticles).toBe(0);
    expect(plan.dust.maxParticles + plan.exhaust.maxParticles + plan.brakeSmoke.maxParticles).toBe(0);
  });

  it("uses sand in the canyon and circuit-specific wheel tints, with pale subtle smoke", () => {
    expect(roadEffectsPlan(driving).dust.kind).toBe("sand");
    expect(roadEffectsPlan({ ...driving, trackId: "forest" }).dust.kind).toBe("dust");
    expect(roadEffectsPlan({ ...driving, trackId: "glacier" }).dust.tint).not.toBe(roadEffectsPlan(driving).dust.tint);
    for (const trackId of tracks) {
      const plan = roadEffectsPlan({ ...driving, trackId });
      for (const smoke of [plan.exhaust, plan.brakeSmoke]) {
        expect(smoke.tint).toBe(0xe3e8e8);
        expect(smoke.alpha).toBeLessThanOrEqual(0.22);
        expect(smoke.lifespanSeconds).toBeLessThanOrEqual(0.4);
      }
    }
  });

  it("bounds all circuit/control combinations to 12 light or 40 normal particles", () => {
    for (const lightMode of [false, true]) {
      for (const trackId of tracks) {
        for (const speed of [0, 0.5, 1, 2, 3, 12, 30, 1e300, -30]) {
          for (const grounded of [false, true]) {
            for (const throttle of [-1, 0, 1]) {
              for (const brake of [false, true]) {
                for (const turbo of [false, true]) {
                  const plan = roadEffectsPlan({ ...driving, lightMode, trackId, speed, grounded, throttle, brake, turbo });
                  const effects = [plan.dust, plan.exhaust, plan.brakeSmoke];
                  expect(plan.maxParticles).toBe(lightMode ? 12 : 40);
                  expect(effects.reduce((sum, effect) => sum + effect.maxParticles, 0)).toBe(plan.maxParticles);
                  expect(effects.reduce((sum, effect) => sum + effect.rate, 0)).toBeLessThanOrEqual(plan.maxParticles);
                  for (const effect of effects) {
                    expect(Number.isFinite(effect.rate)).toBe(true);
                    expect(effect.rate).toBeGreaterThanOrEqual(0);
                    expect(effect.rate * effect.lifespanSeconds).toBeLessThanOrEqual(effect.maxParticles);
                    expect(effect.alpha).toBeGreaterThan(0);
                    expect(effect.radiusEnd).toBeGreaterThan(effect.radiusStart);
                  }
                }
              }
            }
          }
        }
      }
    }
  });
});
