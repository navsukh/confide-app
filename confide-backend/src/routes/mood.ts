import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hasActiveSubscription } from "../lib/subscription.js";

const createMoodSchema = z.object({
  score: z.number().int().min(1).max(5),
  note: z.string().max(500).optional(),
});

export async function registerMoodRoutes(app: FastifyInstance) {
  app.post("/mood", { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await hasActiveSubscription(req.user.sub))) {
      return reply.code(402).send({ error: "subscription_required" });
    }
    const body = createMoodSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const entry = await prisma.moodEntry.create({
      data: { userId: req.user.sub, score: body.data.score, note: body.data.note },
    });
    return reply.code(201).send({ entry });
  });

  app.get("/mood", { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await hasActiveSubscription(req.user.sub))) {
      return reply.code(402).send({ error: "subscription_required" });
    }
    // Most-recent-first, capped — this backs a simple trend view, not
    // long-range analytics, so 200 entries is plenty for now.
    const entries = await prisma.moodEntry.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return reply.send({ entries });
  });
}
