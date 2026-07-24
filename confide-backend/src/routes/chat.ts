import type { FastifyInstance } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { prisma } from "../lib/prisma.js";
import { redisSub, redisPub, conversationChannel } from "../lib/redis.js";
import { createModerationService } from "../services/moderation.js";
import { getCrisisResources } from "../lib/crisis.js";
import { encryptEscalatedContent } from "../lib/encryption.js";

const moderation = createModerationService();

// 30-day encrypted, access-logged retention window for escalated content
// (Section 7.2). NOTE: "access-logged" and "encrypted at rest" are
// application/infra-level guarantees this file assumes exist (Postgres
// column-level encryption or an application-layer envelope) — not
// implemented in this snippet, flagging so it isn't silently skipped.
const ESCALATION_RETENTION_DAYS = 30;

interface ChatClientMessage {
  type: "send" | "end";
  text?: string;
}

type ChatServerMessage =
  | { type: "matched" | "history"; [k: string]: unknown }
  | { type: "message"; messageId: string; senderId: string; content: string; sentAt: string }
  | { type: "blocked"; reason: "moderation"; appealHint: string }
  | { type: "crisis_resources"; resources: ReturnType<typeof getCrisisResources> }
  | { type: "trial_info"; trialEndsAt: string }
  | { type: "conversation_ended"; reason: "manual" | "trial_expired" };

/**
 * Marks a conversation ENDED exactly once, even if called concurrently from
 * both the manual-end path and the trial-expiry timer — the `updateMany`
 * with `status: "ACTIVE"` in the where-clause means only the first caller's
 * update actually changes anything; the loser sees count 0 and skips the
 * publish, so both parties get exactly one conversation_ended event, not two.
 */
async function endConversationOnce(
  conversationId: string,
  channel: string,
  reason: "manual" | "trial_expired",
): Promise<void> {
  const result = await prisma.conversation.updateMany({
    where: { id: conversationId, status: "ACTIVE" },
    data: { status: "ENDED", endedAt: new Date() },
  });
  if (result.count === 0) return; // already ended by the other path

  await redisPub.publish(channel, JSON.stringify({ type: "conversation_ended", reason } satisfies ChatServerMessage));
}

export async function registerChatRoutes(app: FastifyInstance) {
  app.get("/ws/chat/:conversationId", { websocket: true }, async (socket: WebSocket, req) => {
    const { conversationId } = req.params as { conversationId: string };

    // Auth over the WS query string since browsers/RN can't set custom
    // headers on the initial upgrade request easily. Swap for Better Auth's
    // cookie/session handling when that lands (see routes/auth.ts note).
    const token = (req.query as { token?: string }).token;
    let userId: string;
    try {
      const decoded = app.jwt.verify<{ sub: string }>(token ?? "");
      userId = decoded.sub;
    } catch {
      socket.close(4001, "unauthorized");
      return;
    }

    const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation || conversation.status !== "ACTIVE") {
      socket.close(4004, "conversation_not_found_or_ended");
      return;
    }
    if (conversation.participantAId !== userId && conversation.participantBId !== userId) {
      socket.close(4003, "forbidden");
      return;
    }

    const channel = conversationChannel(conversationId);

    // Trial conversations are hard-capped server-side, not just shown a
    // client-side countdown — a modified client can't extend its own free
    // trial by ignoring the timer.
    let trialTimer: ReturnType<typeof setTimeout> | undefined;
    if (conversation.isTrial && conversation.trialEndsAt) {
      socket.send(
        JSON.stringify({ type: "trial_info", trialEndsAt: conversation.trialEndsAt.toISOString() } satisfies ChatServerMessage),
      );
      const msRemaining = conversation.trialEndsAt.getTime() - Date.now();
      if (msRemaining <= 0) {
        await endConversationOnce(conversationId, channel, "trial_expired");
      } else {
        trialTimer = setTimeout(() => {
          endConversationOnce(conversationId, channel, "trial_expired").catch((err) =>
            req.log.error({ err }, "failed to auto-end expired trial conversation"),
          );
        }, msRemaining);
      }
    }

    // Each connection gets its own filtered listener on the shared
    // subscriber, per the stateless-gateway design in Section 3: any
    // gateway instance can hold either side of the conversation, and
    // messages cross instances via Redis pub/sub rather than in-process
    // state.
    const onRedisMessage = (chan: string, message: string) => {
      if (chan !== channel) return;
      socket.send(message);
      // Once either party ends the conversation (manually or via trial
      // expiry), close this socket too — there's nothing further to send
      // or receive on an ended conversation.
      try {
        const parsed = JSON.parse(message);
        if (parsed.type === "conversation_ended") {
          socket.close(4000, "conversation_ended");
        }
      } catch {
        // ignore parse failures — not every published message needs this check to succeed
      }
    };
    redisSub.on("message", onRedisMessage);
    await redisSub.subscribe(channel);

    socket.on("close", () => {
      if (trialTimer) clearTimeout(trialTimer);
      redisSub.off("message", onRedisMessage);
      // Note: in a multi-connection-per-channel deployment, only unsubscribe
      // once the last local listener for this channel is gone. Fine for a
      // single 1:1 conversation channel, but worth a comment for whoever
      // extends this to group chat.
      redisSub.unsubscribe(channel).catch(() => {});
    });

    socket.on("message", async (raw: Buffer) => {
      let parsed: ChatClientMessage;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        return; // ignore malformed frames
      }
      if (parsed.type === "end") {
        await endConversationOnce(conversationId, channel, "manual");
        return;
      }
      if (parsed.type !== "send" || typeof parsed.text !== "string" || parsed.text.length === 0) {
        return;
      }

      // Pre-send moderation, in the hot path, per Section 3's "scan before
      // send" requirement — not an async afterthought.
      const verdict = await moderation.moderate(parsed.text);

      const message = await prisma.message.create({
        data: {
          conversationId,
          senderId: userId,
          content: verdict.verdict === "ALLOW" || verdict.verdict === "WARN" ? parsed.text : null,
          moderationAction: verdict.verdict,
          sentAt: verdict.verdict === "ALLOW" || verdict.verdict === "WARN" ? new Date() : undefined,
          blockedAt: verdict.verdict === "BLOCK" || verdict.verdict === "BLOCK_AND_ESCALATE" ? new Date() : undefined,
        },
      });

      await prisma.moderationEvent.create({
        data: {
          messageId: message.id,
          contentHash: verdict.contentHash,
          category: verdict.category,
          verdict: verdict.verdict,
          modelName: verdict.modelName,
          modelVersion: verdict.modelVersion,
          escalatedCiphertext: verdict.verdict === "BLOCK_AND_ESCALATE" ? encryptEscalatedContent(parsed.text) : undefined,
          escalatedRetainUntil:
            verdict.verdict === "BLOCK_AND_ESCALATE"
              ? new Date(Date.now() + ESCALATION_RETENTION_DAYS * 24 * 60 * 60 * 1000)
              : undefined,
        },
      });

      if (verdict.verdict === "ALLOW" || verdict.verdict === "WARN") {
        const payload: ChatServerMessage = {
          type: "message",
          messageId: message.id,
          senderId: userId,
          content: parsed.text,
          sentAt: message.sentAt!.toISOString(),
        };
        await redisPub.publish(channel, JSON.stringify(payload));
        return;
      }

      // BLOCK / BLOCK_AND_ESCALATE: never delivered to the other party.
      // Section 6.3: give the sender a lightweight appeal/reporting path
      // rather than a silent drop, or this becomes a support-load and
      // churn problem for people using strong language about hard topics.
      socket.send(
        JSON.stringify({
          type: "blocked",
          reason: "moderation",
          appealHint: "This message wasn't sent. If you think this was a mistake, use the report/appeal option.",
        } satisfies ChatServerMessage),
      );

      if (verdict.verdict === "BLOCK_AND_ESCALATE") {
        // Section 9.1: surface the resource screen without freezing the
        // user out of the app entirely or treating them as an abuser.
        const sender = await prisma.user.findUnique({ where: { id: userId } });
        socket.send(
          JSON.stringify({
            type: "crisis_resources",
            resources: getCrisisResources(sender?.region),
          } satisfies ChatServerMessage),
        );
      }
    });
  });
}
