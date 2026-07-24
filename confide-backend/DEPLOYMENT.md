# Deploying Confide — free tier now, real cloud later

This describes one concrete path that starts free and doesn't require a
re-architecture to move to AWS/GCP/Azure later, because everything talks to
Postgres and Redis over their standard protocols via env vars — swapping
hosts later is a connection-string change, not a rewrite.

## The free-tier stack

| Piece | Provider | Why |
|---|---|---|
| Postgres | [Neon](https://neon.tech) | Free tier has no hard expiry (unlike some "free trial" Postgres offers), serverless, standard `postgresql://` connection string |
| Redis | [Upstash](https://upstash.com) | Free tier, standard `redis://` connection string, works fine with ioredis/BullMQ |
| Compute (API + worker) | [Render](https://render.com) | Free web service + free background worker, deploys straight from this repo's `Dockerfile` |
| Error monitoring | [Sentry](https://sentry.io) | Free tier covers 5k errors/month |

None of these require a credit card to start (confirm current terms on each
site — free-tier details change over time and this list wasn't re-verified
against live pricing pages when this was written).

## Setup steps

1. **Neon**: create a project, copy the connection string into
   `DATABASE_URL`. Run `npx prisma migrate deploy` once against it (from
   your machine, or as a one-off Render job) before first boot.
2. **Upstash**: create a Redis database, copy the connection string
   (`rediss://...` — note the TLS scheme) into `REDIS_URL`.
3. **Sentry**: create a project, copy the DSN into `SENTRY_DSN`.
4. **Render**: create two services from this repo:
   - A **Web Service** using `Dockerfile`, exposing port 3000 — this is the
     API.
   - A **Background Worker** using the same `Dockerfile` but with the
     start command overridden to `node dist/workers/matching.worker.js`.
   Set all the env vars from `.env.example` on both services (the worker
   only strictly needs `DATABASE_URL`, `REDIS_URL`, `SENTRY_DSN` — the rest
   are harmless to include anyway).
5. Generate `ESCALATION_ENCRYPTION_KEY` once, store it in both services'
   env vars, and treat it like any other secret — back it up. Losing it
   means losing the ability to decrypt any already-escalated content.

**Free-tier caveats to know about, not to be surprised by:**
- Render's free web services spin down after inactivity and take a few
  seconds to wake up on the next request — fine for early testing, a bad
  first impression for real users. Move to a paid Render tier (or the cloud
  migration below) before real traffic.
- Neon/Upstash free tiers have compute/request caps — check current limits
  before assuming this scales past initial testing.
- The WebSocket chat gateway assumes it can hold long-lived connections;
  confirm Render's free tier doesn't aggressively recycle those (it
  shouldn't for a paid-adjacent web service, but free tiers sometimes have
  different connection-handling behavior — verify rather than assume).

## Moving to real cloud later

Because the app only depends on standard `DATABASE_URL`/`REDIS_URL`
connection strings and a Docker image, moving to AWS/GCP/Azure later is:

1. Stand up managed Postgres (RDS / Cloud SQL) and managed Redis
   (ElastiCache / Memorystore).
2. Point `DATABASE_URL`/`REDIS_URL` at the new instances, run
   `prisma migrate deploy` against the new Postgres.
3. Deploy the same `Dockerfile` to ECS/Cloud Run/wherever.
4. Cut over DNS.

No application code changes required for the migration itself — this is
the entire point of not hand-rolling anything provider-specific in the app
layer.

## Not covered here

- CDN/edge config, custom domains, TLS certs (Render/most platforms handle
  basic TLS automatically; custom domains are a few clicks on any of these
  providers, not documented step-by-step here)
- Horizontal scaling beyond one instance of the API/worker (the chat
  gateway's Redis pub/sub design supports multiple instances — see
  `src/lib/redis.ts` comments — but this hasn't been load-tested)
- Backups/disaster recovery policy for Neon/Upstash — check each
  provider's current backup offering on their free vs. paid tiers
