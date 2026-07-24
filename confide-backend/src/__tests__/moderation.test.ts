import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenAiModerationService } from "../services/moderation.js";

function mockModerationResponse(categories: Record<string, boolean>, flagged: boolean) {
  return {
    ok: true,
    json: async () => ({
      results: [
        {
          flagged,
          categories,
          category_scores: {},
        },
      ],
    }),
  };
}

describe("OpenAiModerationService", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("allows clean text", async () => {
    (global.fetch as any).mockResolvedValue(mockModerationResponse({ harassment: false }, false));
    const result = await new OpenAiModerationService().moderate("Hey, how's your day going?");
    expect(result.verdict).toBe("ALLOW");
  });

  it("blocks flagged-but-non-escalation content", async () => {
    (global.fetch as any).mockResolvedValue(mockModerationResponse({ harassment: true }, true));
    const result = await new OpenAiModerationService().moderate("some harassing text");
    expect(result.verdict).toBe("BLOCK");
  });

  it("escalates self-harm content regardless of overall flagged score", async () => {
    (global.fetch as any).mockResolvedValue(
      mockModerationResponse({ "self-harm/intent": true }, true),
    );
    const result = await new OpenAiModerationService().moderate("concerning message");
    expect(result.verdict).toBe("BLOCK_AND_ESCALATE");
  });

  it("fails closed (BLOCK) when the API call throws", async () => {
    (global.fetch as any).mockRejectedValue(new Error("network error"));
    const result = await new OpenAiModerationService().moderate("anything");
    expect(result.verdict).toBe("BLOCK");
    expect(result.category).toBe("moderation-unavailable");
  });

  it("never returns plaintext in the result — only a hash", async () => {
    (global.fetch as any).mockResolvedValue(mockModerationResponse({}, false));
    const result = await new OpenAiModerationService().moderate("some private message content");
    expect(JSON.stringify(result)).not.toContain("some private message content");
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
