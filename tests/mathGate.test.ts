import { describe, expect, it } from "vitest";

import {
  createAdditionChallenge,
  FIVE_MINUTES_MS,
  needsMathChallenge,
  ONE_HOUR_MS,
  recordSolvedChallenge,
} from "../src/game/mathGate";

describe("math gate", () => {
  it("always creates additions with positive digits and a result below ten", () => {
    for (let index = 0; index <= 100; index += 1) {
      const challenge = createAdditionChallenge(() => index / 101);
      expect(challenge.left).toBeGreaterThanOrEqual(1);
      expect(challenge.right).toBeGreaterThanOrEqual(1);
      expect(challenge.left).toBeLessThan(10);
      expect(challenge.right).toBeLessThan(10);
      expect(challenge.answer).toBe(challenge.left + challenge.right);
      expect(challenge.answer).toBeLessThan(10);
    }
  });

  it("requires the first addition and waits one hour before repeating", () => {
    const start = new Date("2026-08-04T18:00:00");
    expect(needsMathChallenge({}, start)).toBe(true);
    const session = recordSolvedChallenge({}, start.getTime());
    expect(needsMathChallenge(session, new Date(start.getTime() + ONE_HOUR_MS - 1))).toBe(false);
    expect(needsMathChallenge(session, new Date(start.getTime() + ONE_HOUR_MS))).toBe(true);
  });

  it("repeats every five minutes after the first hour", () => {
    const first = new Date("2026-08-04T18:00:00").getTime();
    const last = first + ONE_HOUR_MS;
    const session = { firstSolvedAt: first, lastSolvedAt: last };
    expect(needsMathChallenge(session, new Date(last + FIVE_MINUTES_MS - 1))).toBe(false);
    expect(needsMathChallenge(session, new Date(last + FIVE_MINUTES_MS))).toBe(true);
  });

  it("uses five-minute intervals immediately from 23:00", () => {
    const first = new Date("2026-08-04T22:58:00").getTime();
    const session = { firstSolvedAt: first, lastSolvedAt: first };
    expect(needsMathChallenge(session, new Date("2026-08-04T23:02:59"))).toBe(false);
    expect(needsMathChallenge(session, new Date("2026-08-04T23:03:00"))).toBe(true);
  });
});
