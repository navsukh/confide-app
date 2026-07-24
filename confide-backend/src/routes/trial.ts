import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { matchingQueue } from "../lib/queues.js";

const TRIAL_TOPIC_TAG = "general"; // trial skips topic selection entirely, per product decision
const TRIAL_MATCH_REQUEST_TTL_SECONDS = 120;

const startTrialSchema = z.object({
  role: z.enum(["SPEAKER", "LISTENER"]),
});

export async function registerTrialRoutes(app: FastifyInstance) {
  app.post("/trial/start", { onRequest: [app.authenticate] }, async (req, reply) => {
    const body = startTrialSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const userId = req.user.sub;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.code(404).send({ error: "not_found" });

    if (user.freeTrialUsedAt) {
      return reply.code(409).send({ error: "trial_already_used" });
    }

    // Mark the trial as used at REQUEST time, not at match/completion time —
    // otherwise cancel-and-retry (or just never getting matched) would let
    // someone queue an unlimited number of trial requests.
    await prisma.user.update({ where: { id: userId }, data: { freeTrialUsedAt: new Date() } });

    const expiresAt = new Date(Date.now() + TRIAL_MATCH_REQUEST_TTL_SECONDS * 1000);
    const matchRequest = await prisma.matchRequest.create({
      data: {
        userId,
        role: body.data.role,
        topicTag: TRIAL_TOPIC_TAG,
        isTrial: true,
        expiresAt,
      },
    });

    await matchingQueue.add("attempt-match", { matchRequestId: matchRequest.id }, { attempts: 1 });

    return reply.code(201).send({ matchRequestId: matchRequest.id, expiresAt });
  });
}
