import Stripe from "stripe";
import { config } from "../config.js";

/**
 * Thin wrapper so route handlers don't import the Stripe SDK directly —
 * same "swappable behind an interface" pattern as moderation.ts, in case a
 * second payment provider (Play Billing / App Store direct, per Section 10's
 * store-specific IAP requirements) gets added later instead of Stripe alone.
 *
 * NOTE: Stripe requires real API keys and Price IDs from a real Stripe
 * account/dashboard — nothing here works until STRIPE_SECRET_KEY etc. in
 * .env are filled in with real values.
 */

console.log("========== STRIPE CONFIG ==========");
console.log("Secret Key:", config.stripe.secretKey?.substring(0, 20));
console.log("Silver Price:", process.env.STRIPE_PRICE_SILVER);
console.log("Gold Price:", process.env.STRIPE_PRICE_GOLD);
console.log("Diamond Price:", process.env.STRIPE_PRICE_DIAMOND);
console.log("Platinum Price:", process.env.STRIPE_PRICE_PLATINUM);
console.log("===================================");

export const stripe = new Stripe(config.stripe.secretKey || "sk_test_placeholder", {
  apiVersion: "2024-06-20",
});

export async function createCheckoutSession(params: {
  userId: string;
  priceId: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  console.log("Creating Stripe Checkout Session");
  console.log("Price ID:", params.priceId);
  console.log("User:", params.userId);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: params.priceId, quantity: 1 }],
      client_reference_id: params.userId,
      customer_email: params.customerEmail,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });

    console.log("Checkout Session Created:", session.id);
    return session;
  } catch (err: any) {
    console.error("========== STRIPE ERROR ==========");
    console.error("Message:", err.message);
    console.error("Type:", err.type);
    console.error("Code:", err.code);
    console.error("Status:", err.statusCode);
    console.error("Raw:", err.raw);
    console.error("==================================");
    throw err;
  }
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string): Stripe.Event {
  return stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
}