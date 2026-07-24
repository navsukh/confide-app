import * as Sentry from "@sentry/node";
import { config } from "../config.js";

/**
 * Free-tier-friendly monitoring: Sentry's free plan covers 5k errors/month,
 * which is plenty for an early-stage app. This is a complete no-op if
 * SENTRY_DSN isn't set, so it's safe to leave out entirely during local dev.
 */
export function initSentry(): void {
  if (!config.sentry.dsn) return;
  Sentry.init({
    dsn: config.sentry.dsn,
    tracesSampleRate: 0.1,
  });
}

export { Sentry };
