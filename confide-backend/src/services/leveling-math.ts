/**
 * Pure leveling math, split out from services/leveling.ts specifically so
 * it can be unit-tested without constructing a PrismaClient (which needs a
 * live database connection to even instantiate in some environments).
 */

export const POINTS_PER_LEVEL = 100;
export const MAX_LEVEL = 4;

export const POINTS_FOR_COMPLETED_SESSION = 20;
export const POINTS_BY_RATING_SCORE: Record<number, number> = {
  5: 15,
  4: 8,
  3: 0,
  2: -5,
  1: -10,
};

export function levelForPoints(points: number): number {
  const level = Math.floor(Math.max(points, 0) / POINTS_PER_LEVEL) + 1;
  return Math.min(level, MAX_LEVEL);
}
