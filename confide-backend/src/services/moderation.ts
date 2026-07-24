import { createHash } from "node:crypto";
import { config } from "../config.js";

/**
 * Moderation is a swappable internal interface (Section 2 / Section 6):
 * call sites depend on `ModerationService`, never on a specific vendor SDK,
 * so the provider can change later without touching route handlers.
 */

export type ModerationVerdict = "ALLOW" | "WARN" | "BLOCK" | "BLOCK_AND_ESCALATE";

export interface ModerationResult {
  verdict: ModerationVerdict;
  category: string; // e.g. "self-harm", "sexual-content", "harassment", "none"
  modelName: string;
  modelVersion: string;
  contentHash: string; // SHA-256 of the raw text — stored instead of plaintext by default (Section 7.2)
  /**
   * Only set when the verdict is BLOCK_AND_ESCALATE (credible threat,
   * exploitation disclosure, acute self-harm risk). Callers are responsible
   * for routing this into the encrypted, access-logged retention bucket —
   * this service does not persist anything itself.
   */
  escalationReason?: string;
}

export interface ModerationService {
  /** Must complete within config.moderation.timeoutMs or the caller will fail-closed. */
  moderate(text: string): Promise<ModerationResult>;
}

function hashContent(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Crisis / acute-risk categories that must NEVER be peer-matched (Section 1.1,
 * Section 9). If the moderation provider flags these, we escalate regardless
 * of overall score — this is a hard rule, not a threshold to tune.
 */
const ESCALATION_CATEGORIES = new Set([
  "self-harm",
  "self-harm/intent",
  "self-harm/instructions",
  "sexual/minors",
]);

/**
 * OpenAI's hosted moderation endpoint, used as the "start with a hosted
 * moderation API" default called out in Section 2. Swap this class out (or
 * add a second implementation and route by borderline-score, per Section
 * 6.3's "fast classifier + escalate to a stronger model" plan) without
 * touching anything outside this file.
 */
export class OpenAiModerationService implements ModerationService {
  async moderate(text: string): Promise<ModerationResult> {
    const contentHash = hashContent(text);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.moderation.timeoutMs);

    try {
      const res = await fetch("https://api.openai.com/v1/moderations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.moderation.openaiApiKey}`,
        },
        body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Moderation API returned ${res.status}`);
      }

      const data = (await res.json()) as {
        results: Array<{
          flagged: boolean;
          categories: Record<string, boolean>;
          category_scores: Record<string, number>;
        }>;
      };

      const result = data.results[0];
      const flaggedCategories = Object.entries(result.categories)
        .filter(([, flagged]) => flagged)
        .map(([cat]) => cat);

      const escalate = flaggedCategories.some((c) => ESCALATION_CATEGORIES.has(c));

      let verdict: ModerationVerdict = "ALLOW";
      if (escalate) verdict = "BLOCK_AND_ESCALATE";
      else if (result.flagged) verdict = "BLOCK";

      return {
        verdict,
        category: flaggedCategories[0] ?? "none",
        modelName: "openai-omni-moderation",
        modelVersion: "latest",
        contentHash,
        escalationReason: escalate ? flaggedCategories.join(",") : undefined,
      };
    } catch (err) {
      // Fail closed: per Section 6.3, a moderation outage should not mean
      // messages skip moderation entirely. Block and let the sender retry —
      // this is where a false-positive appeal path (also Section 6.3)
      // matters, since outages will otherwise generate support load.
      return {
        verdict: "BLOCK",
        category: "moderation-unavailable",
        modelName: "openai-omni-moderation",
        modelVersion: "latest",
        contentHash,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createModerationService(): ModerationService {
  switch (config.moderation.provider) {
    case "openai":
      return new OpenAiModerationService();
    default:
      throw new Error(`Unknown moderation provider: ${config.moderation.provider}`);
  }
}
