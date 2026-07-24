import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";

// Set the key before importing the module under test, since config.ts reads
// process.env at import time.
beforeAll(() => {
  process.env.ESCALATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("escalated content encryption", () => {
  it("round-trips plaintext through encrypt/decrypt", async () => {
    const { encryptEscalatedContent, decryptEscalatedContent } = await import("../lib/encryption.js");
    const original = "I've been thinking about hurting myself";
    const ciphertext = encryptEscalatedContent(original);
    expect(ciphertext).not.toContain(original);
    expect(decryptEscalatedContent(ciphertext)).toBe(original);
  });

  it("produces different ciphertext for the same plaintext each time (random IV)", async () => {
    const { encryptEscalatedContent } = await import("../lib/encryption.js");
    const a = encryptEscalatedContent("same message");
    const b = encryptEscalatedContent("same message");
    expect(a).not.toBe(b);
  });

  it("throws if the auth tag doesn't match (tampered ciphertext)", async () => {
    const { encryptEscalatedContent, decryptEscalatedContent } = await import("../lib/encryption.js");
    const ciphertext = encryptEscalatedContent("some message");
    const tampered = ciphertext.slice(0, -4) + "abcd";
    expect(() => decryptEscalatedContent(tampered)).toThrow();
  });
});
