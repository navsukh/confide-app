import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { config } from "../config.js";
import { decryptEscalatedContent } from "../lib/encryption.js";

/**
 * Minimal ops surface: list open reports, list escalated moderation events
 * (the BLOCK_AND_ESCALATE bucket from services/moderation.ts), and
 * suspend/ban an account. Gated by a single shared bearer token — fine for
 * a small internal team, NOT fine once there's more than a couple of
 * trusted people touching this; swap for real staff auth (SSO + roles)
 * before that point, especially given this surface can read escalated
 * plaintext content.
 */
async function requireAdmin(req: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (token !== config.admin.token) {
    reply.code(401).send({ error: "unauthorized" });
  }
}

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get("/admin/reports", { onRequest: [requireAdmin] }, async (req, reply) => {
    const reports = await prisma.report.findMany({
      where: { resolved: false },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        reportingUser: { select: { displayHandle: true } },
        reportedUser: { select: { displayHandle: true, accountStatus: true } },
      },
    });
    return reply.send({ reports });
  });

  app.post("/admin/reports/:id/resolve", { onRequest: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.report.update({ where: { id }, data: { resolved: true } });
    return reply.code(204).send();
  });

  app.get("/admin/moderation-events", { onRequest: [requireAdmin] }, async (req, reply) => {
    const events = await prisma.moderationEvent.findMany({
      where: { verdict: "BLOCK_AND_ESCALATE" },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { message: { select: { senderId: true, conversationId: true } } },
    });

    // Decrypt here — this endpoint is the one legitimate access path for
    // escalated content (Section 7.2's "access-logged" requirement). Every
    // read writes an AccessAuditLog row rather than just being logged at
    // the infra/proxy level, so the audit trail survives independent of
    // hosting setup.
    const decrypted = events.map((e: { escalatedCiphertext: string | null; id: string; [key: string]: unknown }) => ({
      ...e,
      escalatedPlaintext: e.escalatedCiphertext ? decryptEscalatedContent(e.escalatedCiphertext) : null,
      escalatedCiphertext: undefined, // never send the ciphertext blob to the client, no reason to
    }));

    if (events.length > 0) {
      await prisma.accessAuditLog.createMany({
        data: events.map((e: { id: string }) => ({
          actor: "admin", // shared-token auth has no per-admin identity yet — see requireAdmin's note
          action: "decrypt_escalated_content",
          resourceType: "ModerationEvent",
          resourceId: e.id,
        })),
      });
    }

    return reply.send({ events: decrypted });
  });

  app.get("/admin/audit-log", { onRequest: [requireAdmin] }, async (req, reply) => {
    const entries = await prisma.accessAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return reply.send({ entries });
  });

  app.post("/admin/users/:id/suspend", { onRequest: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.user.update({ where: { id }, data: { accountStatus: "SUSPENDED" } });
    return reply.code(204).send();
  });

  app.post("/admin/users/:id/ban", { onRequest: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.user.update({ where: { id }, data: { accountStatus: "BANNED" } });
    return reply.code(204).send();
  });

  app.post("/admin/users/:id/reinstate", { onRequest: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.user.update({ where: { id }, data: { accountStatus: "ACTIVE" } });
    return reply.code(204).send();
  });
}
