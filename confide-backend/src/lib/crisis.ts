/**
 * Section 1.1 / Section 9: self-harm, suicidal ideation, and sexual
 * exploitation topics never enter the peer-matching pool. This is a hard
 * exclusion, not a filter a client can bypass — it's enforced server-side
 * both at MatchRequest creation (see routes/match.ts) and mid-conversation
 * via the moderation BLOCK_AND_ESCALATE path (see services/moderation.ts).
 */
export const CRISIS_TOPIC_TAGS = new Set([
  "self-harm",
  "suicidal-ideation",
  "sexual-exploitation",
]);

export interface CrisisResource {
  name: string;
  description: string;
  phone?: string;
  url?: string;
}

// Placeholder set, keyed by region. This MUST be legally reviewed per
// Section 9.1 before launch — treat this as a stub, not a verified source
// of truth, and keep it in a config store that can be updated without a
// deploy once real review is done.
const CRISIS_RESOURCES_BY_REGION: Record<string, CrisisResource[]> = {
  IN: [
    { name: "KIRAN Mental Health Helpline", description: "24/7, government-run", phone: "1800-599-0019" },
    { name: "iCall", description: "Psychosocial helpline", phone: "9152987821" },
    { name: "Vandrevala Foundation", description: "24/7 crisis helpline", phone: "1860-2662-345" },
  ],
  DEFAULT: [
    { name: "Find a local crisis line", description: "findahelpline.com maintains a verified, region-specific directory", url: "https://findahelpline.com" },
  ],
};

export function getCrisisResources(region: string | null | undefined): CrisisResource[] {
  if (region && CRISIS_RESOURCES_BY_REGION[region]) {
    return CRISIS_RESOURCES_BY_REGION[region];
  }
  return CRISIS_RESOURCES_BY_REGION.DEFAULT;
}

export function isCrisisTopic(topicTag: string): boolean {
  return CRISIS_TOPIC_TAGS.has(topicTag);
}
