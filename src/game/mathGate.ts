export interface AdditionChallenge {
  left: number;
  right: number;
  answer: number;
}

export interface MathGateSession {
  firstSolvedAt?: number;
  lastSolvedAt?: number;
}

export const ONE_HOUR_MS = 60 * 60 * 1000;
export const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function createAdditionChallenge(random: () => number = Math.random): AdditionChallenge {
  const left = 1 + Math.floor(random() * 8);
  const maximumRight = 9 - left;
  const right = 1 + Math.floor(random() * maximumRight);
  return { left, right, answer: left + right };
}

export function isLateNight(date: Date): boolean {
  return date.getHours() >= 23;
}

export function needsMathChallenge(session: MathGateSession, now: Date): boolean {
  if (session.firstSolvedAt === undefined || session.lastSolvedAt === undefined) return true;
  const currentTime = now.getTime();
  if (isLateNight(now)) return currentTime - session.lastSolvedAt >= FIVE_MINUTES_MS;
  if (currentTime - session.firstSolvedAt < ONE_HOUR_MS) return false;
  return currentTime - session.lastSolvedAt >= FIVE_MINUTES_MS;
}

export function recordSolvedChallenge(session: MathGateSession, solvedAt: number): MathGateSession {
  return {
    firstSolvedAt: session.firstSolvedAt ?? solvedAt,
    lastSolvedAt: solvedAt,
  };
}
