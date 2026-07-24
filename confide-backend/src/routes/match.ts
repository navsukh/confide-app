import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { matchingQueue } from "../lib/queues.js";
import { config } from "../config.js";
import { getCrisisResources, isCrisisTopic } from "../lib/crisis.js";
import { hasActiveSubscription } from "../lib/subscription.js";

const createMatchRequestSchema = z.object({
  role: z.enum(["SPEAKER", "LISTENER"]),
  topicTag: z.string().min(1),
  genderPref: z.enum(["MALE", "FEMALE", "NON_BINARY", "UNSPECIFIED"]).optional(),
  radiusMinKm: z.number().int().nonnegative().optional(),
  radiusMaxKm: z.number().int().positive().optional(),
  languagePref: z.string().optional(),
});

export async function registerMatchRoutes(app: FastifyInstance) {
  app.post("/match/request", { onRequest: [app.authenticate] }, async (req, reply) => {
    const body = createMatchRequestSchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    }
    const userId = req.user.sub;

    // Product decision: BOTH roles require an active subscription for real
    // (non-trial) matching. The one-time free trial goes through
    // routes/trial.ts instead, which doesn't call this endpoint at all.
    if (!(await hasActiveSubscription(userId))) {
      return reply.code(402).send({ error: "subscription_required" });
    }

    // Hard exclusion (Section 1.1 / Section 9): these topics never enter the
    // peer-matching pool, full stop — not a client-side filter, enforced
    // here regardless of what a (possibly modified) client sends.
    if (isCrisisTopic(body.data.topicTag)) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      return reply.code(200).send({
        routedToCrisisResources: true,
        resources: getCrisisResources(user?.region),
      });
    }

    const expiresAt = new Date(Date.now() + config.matching.requestTtlSeconds * 1000);

    const matchRequest = await prisma.matchRequest.create({
      data: {
        userId,
        role: body.data.role,
        topicTag: body.data.topicTag,
        genderPref: body.data.genderPref,
        radiusMinKm: body.data.radiusMinKm,
        radiusMaxKm: body.data.radiusMaxKm,
        languagePref: body.data.languagePref,
        expiresAt,
      },
    });

    await matchingQueue.add(
      "attempt-match",
      { matchRequestId: matchRequest.id },
      { attempts: 1 },
    );

    return reply.code(201).send({ matchRequestId: matchRequest.id, expiresAt });
  });

  app.get("/match/request/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const matchRequest = await prisma.matchRequest.findUnique({ where: { id } });
    if (!matchRequest || matchRequest.userId !== req.user.sub) {
      return reply.code(404).send({ error: "not_found" });
    }
    return reply.send({
      state: matchRequest.state,
      conversationId: matchRequest.matchedConversationId,
      expiresAt: matchRequest.expiresAt,
    });
  });

  app.delete("/match/request/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const matchRequest = await prisma.matchRequest.findUnique({ where: { id } });
    if (!matchRequest || matchRequest.userId !== req.user.sub) {
      return reply.code(404).send({ error: "not_found" });
    }
    if (matchRequest.state === "QUEUED") {
      await prisma.matchRequest.update({ where: { id }, data: { state: "CANCELLED" } });
    }
    return reply.code(204).send();
  });
}
