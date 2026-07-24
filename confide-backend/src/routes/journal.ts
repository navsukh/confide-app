import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hasActiveSubscription } from "../lib/subscription.js";

const createEntrySchema = z.object({
  content: z.string().min(1).max(10_000),
  mood: z.string().max(50).optional(),
});

const updateEntrySchema = z.object({
  content: z.string().min(1).max(10_000).optional(),
  mood: z.string().max(50).optional(),
});

/**
 * Wellness feature, gated behind active subscription per the product
 * decision — same gate as real matching (lib/subscription.ts). Entries are
 * private: no sharing, no moderation pipeline, since this is reflective
 * content rather than a conversation with another person.
 */
export async function registerJournalRoutes(app: FastifyInstance) {
  app.post("/journal", { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await hasActiveSubscription(req.user.sub))) {
      return reply.code(402).send({ error: "subscription_required" });
    }
    const body = createEntrySchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const entry = await prisma.journalEntry.create({
      data: { userId: req.user.sub, content: body.data.content, mood: body.data.mood },
    });
    return reply.code(201).send({ entry });
  });

  app.get("/journal", { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await hasActiveSubscription(req.user.sub))) {
      return reply.code(402).send({ error: "subscription_required" });
    }
    const entries = await prisma.journalEntry.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return reply.send({ entries });
  });

  app.patch("/journal/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await hasActiveSubscription(req.user.sub))) {
      return reply.code(402).send({ error: "subscription_required" });
    }
    const { id } = req.params as { id: string };
    const body = updateEntrySchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const existing = await prisma.journalEntry.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.sub) {
      return reply.code(404).send({ error: "not_found" });
    }

    const entry = await prisma.journalEntry.update({ where: { id }, data: body.data });
    return reply.send({ entry });
  });

  app.delete("/journal/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await hasActiveSubscription(req.user.sub))) {
      return reply.code(402).send({ error: "subscription_required" });
    }
    const { id } = req.params as { id: string };
    const existing = await prisma.journalEntry.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.sub) {
      return reply.code(404).send({ error: "not_found" });
    }
    await prisma.journalEntry.delete({ where: { id } });
    return reply.code(204).send();
  });
}
