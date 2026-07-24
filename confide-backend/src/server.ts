import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import { config } from "./config.js";
import { initSentry, Sentry } from "./lib/sentry.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerMatchRoutes } from "./routes/match.js";
import { registerChatRoutes } from "./routes/chat.js";
import { registerSafetyRoutes } from "./routes/safety.js";
import { registerBillingRoutes } from "./routes/billing.js";
import { registerProfileRoutes } from "./routes/profile.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerAdminUiRoutes } from "./routes/adminUi.js";
import { registerTrialRoutes } from "./routes/trial.js";
import { registerJournalRoutes } from "./routes/journal.js";
import { registerMoodRoutes } from "./routes/mood.js";

console.log("Stripe:", process.env.STRIPE_SECRET_KEY?.slice(0, 20));
console.log("Platinum:", process.env.STRIPE_PRICE_PLATINUM);

initSentry();

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => Promise<void>;
  }
}

async function main() {
  const app = Fastify({
    logger: {
      transport: { target: "pino-pretty" },
    },
  });

  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: config.jwtSecret });
  console.log("JWT Secret Prefix:", config.jwtSecret.substring(0, 20));
  await app.register(websocket);

 app.decorate("authenticate", async (req, reply) => {
  console.log("========== AUTH ==========");
  console.log("Authorization Header:", req.headers.authorization);

  try {
    await req.jwtVerify();

    console.log("JWT VERIFIED");
    console.log("User:", req.user);
  } catch (err) {
    console.log("JWT ERROR:", err);
    return reply.code(401).send({ error: "unauthorized" });
  }
});

  app.get("/health", async () => ({ ok: true }));

  // Report unexpected (5xx) errors to Sentry — a no-op if SENTRY_DSN isn't
  // set. Deliberately does NOT report 4xx (auth failures, validation
  // errors, etc.) as those are expected traffic, not incidents.
  app.setErrorHandler((error, req, reply) => {
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      Sentry.captureException(error);
    }
    req.log.error(error);
    reply.code(statusCode).send({ error: "internal_error" });
  });

  await registerAuthRoutes(app);
  await registerMatchRoutes(app);
  await registerChatRoutes(app);
  await registerSafetyRoutes(app);
  await registerBillingRoutes(app);
  await registerProfileRoutes(app);
  await registerAdminRoutes(app);
  await registerAdminUiRoutes(app);
  await registerTrialRoutes(app);
  await registerJournalRoutes(app);
  await registerMoodRoutes(app);

  await app.listen({ port: config.port, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
