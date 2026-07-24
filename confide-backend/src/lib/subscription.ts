import { prisma } from "./prisma.js";

/**
 * Both roles require an active subscription per the product decision —
 * Listeners are no longer a free volunteer pool, Speakers are no longer
 * free either. The one carve-out is the one-time free trial (see
 * routes/trial.ts), which bypasses this check entirely by creating its own
 * MatchRequest with isTrial=true rather than going through the routes this
 * guards.
 *
 * NOTE ON APP STORE POLICY: a hard paywall with zero free usage for BOTH
 * sides of a two-sided marketplace is a real risk for app review rejection
 * — reviewers generally expect to see some free value before a paywall.
 * This was an explicit product decision, not something this code is
 * silently deciding on your behalf; flagging again here since it's the
 * enforcement point.
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!subscription) return false;

  // Mirror whatever Stripe's webhook last wrote (see routes/billing.ts) —
  // "active" and "trialing" are the two Stripe statuses that mean "the
  // person should have access right now."
  const activeStatuses = new Set(["active", "trialing"]);
  if (!activeStatuses.has(subscription.status)) return false;

  // Belt-and-suspenders: if renewsAt is in the past, don't trust the status
  // string alone — a missed/delayed webhook shouldn't grant free access
  // indefinitely.
  if (subscription.renewsAt && subscription.renewsAt < new Date()) return false;

  return true;
}

export async function getSubscriptionSummary(userId: string) {
  const [subscription, user] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { freeTrialUsedAt: true } }),
  ]);

  const active = subscription
    ? new Set(["active", "trialing"]).has(subscription.status) &&
      (!subscription.renewsAt || subscription.renewsAt >= new Date())
    : false;

  return {
    active,
    tier: active ? subscription?.tier ?? null : null,
    renewsAt: subscription?.renewsAt ?? null,
    trialAvailable: !user?.freeTrialUsedAt,
  };
}
