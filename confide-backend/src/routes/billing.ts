import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { config } from "../config.js";
import { createCheckoutSession, verifyWebhookSignature } from "../services/stripe.js";
import type Stripe from "stripe";

export async function registerBillingRoutes(app: FastifyInstance) {
  app.post(
  "/billing/checkout-session",
  { onRequest: [app.authenticate] },
  async (req, reply) => {
    console.log("========== CHECKOUT REQUEST ==========");
    console.log("Authenticated User:", req.user);

    const { tier } = req.body as { tier?: string };
    console.log("Requested Tier:", tier);

    const priceId = Object.entries(config.stripe.priceIdToTier).find(
      ([, t]) => t === tier,
    )?.[0];

    console.log("Resolved Price ID:", priceId);

    if (!priceId) {
      console.log("ERROR: Unknown tier");
      return reply.code(400).send({ error: "unknown_tier" });
    }

    try {
      const session = await createCheckoutSession({
        userId: req.user.sub,
        priceId,
        successUrl: "confide://billing/success",
        cancelUrl: "confide://billing/cancel",
      });

      console.log("Checkout Session Created:", session.id);
      console.log("Checkout URL:", session.url);
      console.log("======================================");

      return reply.send({ checkoutUrl: session.url });
    } catch (err) {
      console.error("========== STRIPE ERROR ==========");
      console.error(err);
      console.error("==================================");

      return reply.code(500).send({
        error: "stripe_checkout_failed",
      });
    }
  }
);

  // Registered in its own encapsulated scope so the raw-buffer content
  // parser below applies ONLY to this route, not to every JSON route in the
  // app — Stripe's signature check needs the exact raw bytes, which the
  // default JSON body parser doesn't preserve.
  await app.register(async (scoped) => {
    scoped.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (_req, body, done) => done(null, body),
    );

    scoped.post("/billing/webhook", async (req, reply) => {
      const signature = req.headers["stripe-signature"];
      if (typeof signature !== "string") {
        return reply.code(400).send({ error: "missing_signature" });
      }

      let event: Stripe.Event;
      try {
        event = verifyWebhookSignature(req.body as Buffer, signature);
      } catch (err) {
        req.log.warn({ err }, "Stripe webhook signature verification failed");
        return reply.code(400).send({ error: "invalid_signature" });
      }

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = session.client_reference_id;
          const subscriptionId = session.subscription;
          if (!userId || typeof subscriptionId !== "string") break;

          const subscription = await import("../services/stripe.js").then((m) =>
            m.stripe.subscriptions.retrieve(subscriptionId),
          );
          const priceId = subscription.items.data[0]?.price.id;
          const tier = priceId ? config.stripe.priceIdToTier[priceId] : undefined;
          if (!tier) {
            req.log.warn({ priceId }, "Stripe webhook: unrecognized price id, cannot map to tier");
            break;
          }

          await prisma.subscription.upsert({
            where: { userId },
            create: {
              userId,
              tier,
              stripeSubId: subscription.id,
              status: subscription.status,
              renewsAt: new Date(subscription.current_period_end * 1000),
            },
            update: {
              tier,
              stripeSubId: subscription.id,
              status: subscription.status,
              renewsAt: new Date(subscription.current_period_end * 1000),
            },
          });
          break;
        }

        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const existing = await prisma.subscription.findFirst({
            where: { stripeSubId: subscription.id },
          });
          if (!existing) break;

          const priceId = subscription.items.data[0]?.price.id;
          const tier = priceId ? config.stripe.priceIdToTier[priceId] : existing.tier;

          await prisma.subscription.update({
            where: { id: existing.id },
            data: {
              tier,
              status: subscription.status,
              renewsAt: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000)
                : null,
            },
          });
          break;
        }

        default:
          break; // ignore event types we don't act on
      }

      return reply.send({ received: true });
    });
  });
}
