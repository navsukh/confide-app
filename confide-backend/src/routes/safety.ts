import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { handleConversationRated } from "../services/leveling.js";

/**
 * Section 10: both app stores require user-facing report + block in v1,
 * not as a later add-on. This file is that surface.
 */

const reportSchema = z.object({
  reportedUserId: z.string(),
  conversationId: z.string().optional(),
  reason: z.enum([
    "HARASSMENT",
    "SEXUAL_CONTENT",
    "SELF_HARM_DISCLOSURE",
    "SPAM",
    "UNDERAGE_SUSPECTED",
    "OTHER",
  ]),
  details: z.string().max(2000).optional(),
});

const rateSchema = z.object({
  conversationId: z.string(),
  score: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export async function registerSafetyRoutes(app: FastifyInstance) {
  app.post("/reports", { onRequest: [app.authenticate] }, async (req, reply) => {
    const body = reportSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const report = await prisma.report.create({
      data: { reportingUserId: req.user.sub, ...body.data },
    });

    // UNDERAGE_SUSPECTED gets a fast-track: Section 9.2 calls for a fast
    // account-suspension path when a report suggests a user is a minor.
    // This is a stub notification hook, not a full moderation-queue
    // integration — wire this into whatever ops tooling triages reports.
    if (body.data.reason === "UNDERAGE_SUSPECTED") {
      req.log.warn({ reportId: report.id, reportedUserId: body.data.reportedUserId }, "underage report — fast-track review needed");
    }

    return reply.code(201).send({ reportId: report.id });
  });

  app.post("/blocks", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { blockedUserId } = req.body as { blockedUserId?: string };
    if (!blockedUserId) return reply.code(400).send({ error: "blockedUserId_required" });

    await prisma.block.upsert({
      where: { blockerUserId_blockedUserId: { blockerUserId: req.user.sub, blockedUserId } },
      create: { blockerUserId: req.user.sub, blockedUserId },
      update: {},
    });
    return reply.code(204).send();
  });

  app.delete("/blocks/:blockedUserId", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { blockedUserId } = req.params as { blockedUserId: string };
    await prisma.block
      .delete({ where: { blockerUserId_blockedUserId: { blockerUserId: req.user.sub, blockedUserId } } })
      .catch(() => {});
    return reply.code(204).send();
  });

  // Basic listener rating (Section 11 Phase 1: "no levels/points yet").
  // Leveling math (100 pts/level, Section 1) is intentionally Phase 2 —
  // don't wire point accrual here without an ADR revisiting that scope.
  app.post("/ratings", { onRequest: [app.authenticate] }, async (req, reply) => {
    const body = rateSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const conversation = await prisma.conversation.findUnique({ where: { id: body.data.conversationId } });
    if (!conversation) return reply.code(404).send({ error: "not_found" });
    if (conversation.participantAId !== req.user.sub && conversation.participantBId !== req.user.sub) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const rating = await prisma.rating.upsert({
      where: { conversationId: body.data.conversationId },
      create: { conversationId: body.data.conversationId, score: body.data.score, comment: body.data.comment },
      update: { score: body.data.score, comment: body.data.comment },
    });

    // Only the listener (participantB, by the matching worker's convention)
    // earns leveling points — the speaker isn't being rated on performance.
    await handleConversationRated({
      conversationId: body.data.conversationId,
      listenerUserId: conversation.participantBId,
      score: body.data.score,
    }).catch((err) => req.log.error({ err }, "failed to award listener points"));

    return reply.code(201).send({ ratingId: rating.id });
  });

  app.get("/listener-profile/me", { onRequest: [app.authenticate] }, async (req, reply) => {
    const profile = await prisma.listenerProfile.findUnique({ where: { userId: req.user.sub } });
    if (!profile) {
      return reply.send({ level: 1, points: 0, totalSessions: 0, avgRating: null, priorityEligible: false });
    }
    return reply.send({
      level: profile.level,
      points: profile.points,
      totalSessions: profile.totalSessions,
      avgRating: profile.avgRating,
      priorityEligible: profile.priorityEligible,
    });
  });
}
