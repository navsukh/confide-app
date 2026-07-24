import { prisma } from "../lib/prisma.js";
import {
  levelForPoints,
  POINTS_FOR_COMPLETED_SESSION,
  POINTS_BY_RATING_SCORE,
} from "./leveling-math.js";

export { levelForPoints } from "./leveling-math.js";

/**
 * Section 1's leveling system: 100 points per level, 4 levels total (so a
 * listener caps out at 300+ points = level 4). Implemented as an
 * append-only ledger (PointLedgerEntry) rather than a bare counter so a
 * bad grant can be reversed with a negative entry instead of silently
 * edited — keeps an audit trail for anything ops needs to look back at.
 *
 * The pure point/level math lives in leveling-math.ts — this file is only
 * the database-touching orchestration on top of it.
 */

// Section 11 Phase 1 explicitly said "no levels/points yet" — this
// implements the Phase 2 feature described in Section 1. If you want to
// keep Phase 1 scope strictly frozen, don't call awardPoints from the
// ratings route until you're ready to turn this on.

export async function awardPoints(params: {
  userId: string;
  points: number;
  reason: string;
  conversationId?: string;
}): Promise<void> {
  const { userId, points, reason, conversationId } = params;

  await prisma.pointLedgerEntry.create({
    data: { userId, points, reason, conversationId },
  });

  const profile = await prisma.listenerProfile.upsert({
    where: { userId },
    create: { userId, points: Math.max(points, 0) },
    update: { points: { increment: points } },
  });

  const newLevel = levelForPoints(profile.points);
  await prisma.listenerProfile.update({
    where: { userId },
    data: {
      level: newLevel,
      priorityEligible: newLevel >= 3,
    },
  });
}

/**
 * Called after a conversation ends and gets rated. Awards the listener
 * (always participantB by the matching worker's convention — see
 * workers/matching.worker.ts) points for completing the session, plus a
 * rating-based bonus/penalty.
 */
export async function handleConversationRated(params: {
  conversationId: string;
  listenerUserId: string;
  score: number;
}): Promise<void> {
  const ratingPoints = POINTS_BY_RATING_SCORE[params.score] ?? 0;

  await awardPoints({
    userId: params.listenerUserId,
    points: POINTS_FOR_COMPLETED_SESSION + ratingPoints,
    reason: `session-completed:rating-${params.score}`,
    conversationId: params.conversationId,
  });

  await prisma.listenerProfile.update({
    where: { userId: params.listenerUserId },
    data: { totalSessions: { increment: 1 } },
  });

  // avgRating recompute — simple full recompute rather than an incremental
  // running average, since rating volume per listener is low enough that
  // this isn't a performance concern at Phase 1/2 scale.
  const ratings = await prisma.rating.findMany({
    where: { conversation: { participantBId: params.listenerUserId } },
  });
  const avg = ratings.reduce((sum: number, r: { score: number }) => sum + r.score, 0) / (ratings.length || 1);
  await prisma.listenerProfile.update({
    where: { userId: params.listenerUserId },
    data: { avgRating: avg },
  });
}
