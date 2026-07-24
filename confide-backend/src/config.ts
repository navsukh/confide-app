function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required("DATABASE_URL", "postgresql://localhost:5432/confide"),
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  jwtSecret: required("JWT_SECRET", "dev-only-change-me"),

  // Moderation provider — swappable, see src/services/moderation.ts.
  // Defaults to OpenAI's moderation endpoint per the user's chosen approach.
  moderation: {
    provider: process.env.MODERATION_PROVIDER ?? "openai",
    openaiApiKey: process.env.OPENAI_API_KEY ?? "",
    // Sub-300ms p95 target per Section 6.3 — keep this tight and fail open
    // to a conservative default (block + queue for async re-check) rather
    // than hanging the send path.
    timeoutMs: Number(process.env.MODERATION_TIMEOUT_MS ?? 2500),
  },

  matching: {
    // How long a MatchRequest stays queued before it expires (Section 4.1).
    requestTtlSeconds: Number(process.env.MATCH_REQUEST_TTL_SECONDS ?? 120),
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    // Map your Stripe Price IDs to internal tiers. Fill these in from the
    // Stripe dashboard — placeholders here will not work against a real
    // Stripe account.
    priceIdToTier: {
      [process.env.STRIPE_PRICE_SILVER ?? "price_silver_placeholder"]: "SILVER",
      [process.env.STRIPE_PRICE_GOLD ?? "price_gold_placeholder"]: "GOLD",
      [process.env.STRIPE_PRICE_DIAMOND ?? "price_diamond_placeholder"]: "DIAMOND",
      [process.env.STRIPE_PRICE_PLATINUM ?? "price_platinum_placeholder"]: "PLATINUM",
    } as Record<string, "SILVER" | "GOLD" | "DIAMOND" | "PLATINUM">,
  },

  admin: {
    // Simple shared-secret gate for the admin dashboard (Section: ops
    // tooling). Swap for real staff SSO before this handles real user data.
    token: process.env.ADMIN_TOKEN ?? "dev-admin-token-change-me",
  },

  push: {
    // expo-server-sdk needs no API key for basic sends; an access token is
    // only required if you enable Expo's push security feature.
    expoAccessToken: process.env.EXPO_ACCESS_TOKEN ?? undefined,
  },

  encryption: {
    // 32-byte key, base64 or hex — see lib/encryption.ts for generation
    // instructions. Deliberately no insecure default here: escalated
    // self-harm/exploitation content should never silently encrypt with a
    // guessable key.
    escalationKey: process.env.ESCALATION_ENCRYPTION_KEY ?? "",
  },

  sentry: {
    dsn: process.env.SENTRY_DSN ?? "",
  },
} as const;
