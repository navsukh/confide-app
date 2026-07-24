import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { config } from "../config.js";

/**
 * Application-layer encryption for the one field in this schema that's
 * genuinely sensitive at rest: ModerationEvent.escalatedCiphertext (Section
 * 7.2's "self-harm/exploitation content that got escalated for safety
 * review" bucket). This is deliberately independent of whatever the hosting
 * provider's disk-encryption story is — it travels with the data if you
 * move from a free-tier Postgres host to AWS RDS or anywhere else.
 *
 * Key management: ESCALATION_ENCRYPTION_KEY must be a 32-byte key, base64
 * or hex encoded, set via env var. Generate one with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 * Losing this key means losing the ability to ever decrypt existing
 * escalated content — back it up like you would any other secret, and
 * treat rotating it as requiring a re-encryption migration, not a simple
 * swap.
 */

function loadKey(): Buffer {
  const raw = config.encryption.escalationKey;
  if (!raw) {
    throw new Error(
      "ESCALATION_ENCRYPTION_KEY is not set — required to encrypt/decrypt escalated moderation content.",
    );
  }
  const buf = raw.length === 64 ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("ESCALATION_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256).");
  }
  return buf;
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended for GCM

/** Returns a single base64 string packing iv + authTag + ciphertext. */
export function encryptEscalatedContent(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptEscalatedContent(packed: string): string {
  const key = loadKey();
  const buf = Buffer.from(packed, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = buf.subarray(IV_LENGTH + 16);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
