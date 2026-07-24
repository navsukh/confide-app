import { Worker } from "bullmq";
import type { Prisma } from "@prisma/client";
import { createRedisConnection, redisPub, conversationChannel } from "../lib/redis.js";
import { prisma } from "../lib/prisma.js";
import { matchingQueue, QUEUE_NAMES, type MatchingJobData } from "../lib/queues.js";
import { sendPushNotifications } from "../services/push.js";
import { haversineKm } from "../lib/geo.js";
import { effectiveTier } from "../lib/matching-tier.js";
import { initSentry, Sentry } from "../lib/sentry.js";

initSentry();

/**
 * Phase 1 matching per Section 11: tier + topic + gender + language filters
 * only. Spatial radius and the fuller cultural/religious filter matrix are
 * explicitly deferred to Phase 3 — don't add them here without an ADR
 * (Section 12) reopening that scope decision.
 *
 * This is a simple poll-and-retry matcher, not a sophisticated matching
 * engine: on each attempt it looks for one compatible counterpart request
 * still QUEUED in Postgres. Good enough to validate the core loop; revisit
 * for scale (Section 6.3-style "cheap path, escalate if needed" thinking
 * applies to matching too, not just moderation).
 */

const RETRY_DELAY_MS = 3000;
const TRIAL_DURATION_MS = 10 * 60 * 1000; // 10 minutes, per product decision

async function findCompatibleCounterpart(request: {
  id: string;
  userId: string;
  role: "SPEAKER" | "LISTENER";
  topicTag: string;
  genderPref: string | null;
  languagePref: string | null;
  radiusMinKm: number | null;
  radiusMaxKm: number | null;
  isTrial: boolean;
}) {
  const counterpartRole = request.role === "SPEAKER" ? "LISTENER" : "SPEAKER";

  const requestingUser = await prisma.user.findUnique({
    where: { id: request.userId },
    include: { subscription: true },
  });
  const requestingTier = effectiveTier(request.isTrial, requestingUser?.subscription?.tier);

  const candidates = await prisma.matchRequest.findMany({
    where: {
      role: counterpartRole,
      topicTag: request.topicTag,
      state: "QUEUED",
      expiresAt: { gt: new Date() },
      userId: { not: request.userId },
    },
    include: { user: { include: { subscription: true } } },
    orderBy: { createdAt: "asc" },
  });

  for (const candidate of candidates) {
    const candidateTier = effectiveTier(candidate.isTrial, candidate.user.subscription?.tier);
    if (candidateTier !== requestingTier) continue; // tier-locked pools (Section 1)

    if (request.genderPref && request.genderPref !== "UNSPECIFIED" && candidate.user.gender !== request.genderPref) {
      continue;
    }
    if (candidate.genderPref && candidate.genderPref !== "UNSPECIFIED" && requestingUser?.gender !== candidate.genderPref) {
      continue;
    }
    if (
      request.languagePref &&
      candidate.user.languages.length > 0 &&
      !candidate.user.languages.includes(request.languagePref)
    ) {
      continue;
    }

    // Spatial radius matching (Section 11 Phase 3, now implemented): only
    // enforced when the requester specified a radius AND both users have
    // shared a location. Requests without a radius preference (or users who
    // haven't shared location) skip this filter entirely rather than being
    // excluded by a distance we can't compute.
    if (request.radiusMaxKm != null && requestingUser?.latitude != null && requestingUser?.longitude != null) {
      if (candidate.user.latitude == null || candidate.user.longitude == null) {
        continue; // can't verify distance — don't match on an unknown gap
      }
      const distanceKm = haversineKm(
        { latitude: requestingUser.latitude, longitude: requestingUser.longitude },
        { latitude: candidate.user.latitude, longitude: candidate.user.longitude },
      );
      if (distanceKm > request.radiusMaxKm) continue;
      if (request.radiusMinKm != null && distanceKm < request.radiusMinKm) continue;
    }

    return candidate;
  }

  return null;
}

const worker = new Worker<MatchingJobData>(
  QUEUE_NAMES.matching,
  async (job) => {
    const request = await prisma.matchRequest.findUnique({ where: { id: job.data.matchRequestId } });
    if (!request || request.state !== "QUEUED") return; // already matched/cancelled elsewhere

    if (request.expiresAt <= new Date()) {
      await prisma.matchRequest.update({ where: { id: request.id }, data: { state: "EXPIRED" } });
      return;
    }

    const counterpart = await findCompatibleCounterpart(request);
    if (!counterpart) {
      // Not found yet — re-enqueue with a delay until this request expires.
      await matchingQueue.add(
        "attempt-match",
        { matchRequestId: request.id },
        { delay: RETRY_DELAY_MS, attempts: 1 },
      );
      return;
    }

    const [speakerReq, listenerReq] = request.role === "SPEAKER" ? [request, counterpart] : [counterpart, request];

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Re-check state inside the transaction to avoid a race where two
      // workers match the same counterpart to different partners.
      const freshCounterpart = await tx.matchRequest.findUnique({ where: { id: counterpart.id } });
      if (!freshCounterpart || freshCounterpart.state !== "QUEUED") {
        throw new Error("counterpart_no_longer_available");
      }

      const conversationIsTrial = request.isTrial || counterpart.isTrial;
      const trialEndsAt = conversationIsTrial ? new Date(Date.now() + TRIAL_DURATION_MS) : null;

      const conversation = await tx.conversation.create({
        data: {
          participantAId: speakerReq.userId,
          participantBId: listenerReq.userId,
          topicTag: request.topicTag,
          isTrial: conversationIsTrial,
          trialEndsAt,
        },
      });

      await tx.matchRequest.update({
        where: { id: request.id },
        data: { state: "MATCHED", matchedConversationId: conversation.id },
      });
      await tx.matchRequest.update({
        where: { id: counterpart.id },
        data: { state: "MATCHED", matchedConversationId: conversation.id },
      });

      await redisPub.publish(
        conversationChannel(conversation.id),
        JSON.stringify({
          type: "matched",
          conversationId: conversation.id,
          isTrial: conversationIsTrial,
          trialEndsAt: trialEndsAt?.toISOString() ?? null,
        }),
      );

      // Push notification for whichever side is backgrounded — the WS
      // pub/sub message above only reaches an open socket, which a
      // backgrounded app usually won't have.
      const [userA, userB] = await Promise.all([
        tx.user.findUnique({ where: { id: speakerReq.userId } }),
        tx.user.findUnique({ where: { id: listenerReq.userId } }),
      ]);
      await sendPushNotifications(
        [userA, userB]
          .filter((u): u is NonNullable<typeof u> => !!u?.expoPushToken)
          .map((u) => ({
            to: u.expoPushToken!,
            title: "You've been matched",
            body: "Someone's ready to talk. Open Confide to start chatting.",
            data: { conversationId: conversation.id },
          })),
      );
    }).catch(async (err: unknown) => {
      // Counterpart got scooped up by another worker — retry this request.
      await matchingQueue.add(
        "attempt-match",
        { matchRequestId: request.id },
        { delay: RETRY_DELAY_MS, attempts: 1 },
      );
    });
  },
  { connection: createRedisConnection() },
);

worker.on("failed", (job, err) => {
  console.error(`Matching job ${job?.id} failed`, err);
  Sentry.captureException(err);
});

console.log("Matching worker started");
