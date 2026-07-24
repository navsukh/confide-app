import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

/**
 * NOTE: Section 2 specifies Better Auth as the auth library. This file is a
 * minimal, dependency-light JWT flow so the rest of the stack (matching,
 * chat, moderation) has something real to plug into today. Swap the guts of
 * signup/login for Better Auth's session handling later — keep the route
 * shapes stable so mobile doesn't have to change much.
 *
 * Age verification here implements Section 9.2's v1 approach and its
 * documented limitation: DOB self-attestation + phone OTP with VOIP
 * rejection is NOT cryptographic proof of age. The interim mitigations
 * (18+ floor, no minor-implying UI, fast suspension path) still need to be
 * built on top of this — this file only enforces the DOB floor and stores
 * the phone-verified timestamp so a later ID-verification vendor swap
 * (Persona / Stripe Identity) has something to hang off.
 */

const signupSchema = z.object({
  displayHandle: z.string().min(3).max(24),
  dob: z.string().date(), // "YYYY-MM-DD"
  phoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/),
  gender: z.enum(["MALE", "FEMALE", "NON_BINARY", "UNSPECIFIED"]).default("UNSPECIFIED"),
  region: z.string().length(2).optional(), // ISO 3166-1 alpha-2
  languages: z.array(z.string()).default([]),
});

const verifyOtpSchema = z.object({
  phoneE164: z.string(),
  code: z.string().length(6),
});

function isAtLeast18(dob: Date): boolean {
  const now = new Date();
  const eighteenthBirthday = new Date(dob.getFullYear() + 18, dob.getMonth(), dob.getDate());
  return eighteenthBirthday <= now;
}

// In-memory OTP store for the stub flow. Replace with Redis (with a TTL) or
// Better Auth's own mechanism before this touches real traffic — this is
// intentionally not production-durable.
const otpStore = new Map<string, string>();

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/signup", async (req, reply) => {
    const body = signupSchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    }
    const { displayHandle, dob, phoneE164, gender, region, languages } = body.data;

    const dobDate = new Date(dob);
    if (!isAtLeast18(dobDate)) {
      // Hard rule, not a soft warning — Section 9.2: don't build any flow
      // that suggests under-18 use is supported.
      return reply.code(403).send({ error: "must_be_18_or_older" });
    }

    // TODO (Section 2): carrier-level line-type check to reject VOIP numbers.
    // Stubbed here — wire up a real lookup provider (e.g. Twilio Lookup)
    // before launch; without it, VOIP-based evasion is trivial.
    const existing = await prisma.user.findUnique({ where: { phoneE164 } });
    if (existing) {
      return reply.code(409).send({ error: "phone_already_registered" });
    }

    const user = await prisma.user.create({
      data: { displayHandle, dob: dobDate, phoneE164, gender, region, languages },
    });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(phoneE164, code);
    req.log.info({ phoneE164, code }, "OTP generated (stub — wire up real SMS provider)");

    return reply.code(201).send({ userId: user.id, otpSent: true });
  });

  app.post("/auth/verify-otp", async (req, reply) => {
    const body = verifyOtpSchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body" });
    }
    const { phoneE164, code } = body.data;

    const expected = otpStore.get(phoneE164);
    if (!expected || expected !== code) {
      return reply.code(401).send({ error: "invalid_or_expired_code" });
    }
    otpStore.delete(phoneE164);

    const user = await prisma.user.update({
      where: { phoneE164 },
      data: { phoneVerifiedAt: new Date() },
    });

    const token = app.jwt.sign({ sub: user.id }, { expiresIn: "30d" });
    return reply.send({ token });
  });

  app.post("/auth/login", async (req, reply) => {
    // Placeholder: real login should re-verify via OTP or a Better Auth
    // session, not just phone lookup. Left minimal for local development.
    const { phoneE164 } = req.body as { phoneE164?: string };
    if (!phoneE164) return reply.code(400).send({ error: "phone_required" });

    const user = await prisma.user.findUnique({ where: { phoneE164 } });
    if (!user || !user.phoneVerifiedAt) {
      return reply.code(401).send({ error: "not_found_or_unverified" });
    }
    const token = app.jwt.sign({ sub: user.id }, { expiresIn: "30d" });
    return reply.send({ token });
  });
}
