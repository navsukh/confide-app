/**
 * Pure matching-tier logic, split out from workers/matching.worker.ts so it
 * can be unit-tested without importing that file — importing the worker
 * module directly would open real Redis/BullMQ connections as a side
 * effect of module load.
 */
export function effectiveTier(isTrial: boolean, subscriptionTier: string | undefined): string {
  return isTrial ? "SILVER" : subscriptionTier ?? "SILVER";
}
