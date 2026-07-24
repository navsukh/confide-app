import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getSubscriptionSummary } from "../lib/subscription.js";

const updateMeSchema = z.object({
  expoPushToken: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  displayHandle: z.string().min(3).max(24).optional(),
  languages: z.array(z.string()).optional(),
});

export async function registerProfileRoutes(app: FastifyInstance) {
  app.get("/me", { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user) return reply.code(404).send({ error: "not_found" });

    // Deliberately excludes dob/phoneE164/phoneVerifiedAt — those are
    // verification-only fields per the User model's own comments, never
    // meant to round-trip back to a client.
    return reply.send({
      displayHandle: user.displayHandle,
      gender: user.gender,
      region: user.region,
      languages: user.languages,
      latitude: user.latitude,
      longitude: user.longitude,
    });
  });

  app.patch("/me", { onRequest: [app.authenticate] }, async (req, reply) => {
    const body = updateMeSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    if (body.data.displayHandle) {
      const clash = await prisma.user.findUnique({ where: { displayHandle: body.data.displayHandle } });
      if (clash && clash.id !== req.user.sub) {
        return reply.code(409).send({ error: "handle_taken" });
      }
    }

    await prisma.user.update({
      where: { id: req.user.sub },
      data: body.data,
    });

    return reply.code(204).send();
  });

  // The mobile app's post-login navigation gate reads this to decide
  // whether to land on the Home hub, the trial offer, or a subscribe-only
  // screen. This is a convenience for the client — the REAL enforcement is
  // server-side on each gated route (match.ts, journal.ts, mood.ts), not
  // this endpoint, since a client can't be trusted to honor a gate it only
  // read once.
  app.get("/subscription/status", { onRequest: [app.authenticate] }, async (req, reply) => {
    const summary = await getSubscriptionSummary(req.user.sub);
    return reply.send(summary);
  });
}
