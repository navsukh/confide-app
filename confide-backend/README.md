# Confide — Backend Skeleton (Phase 1)

This is a working starting point for the backend described in
`01-architecture-overview.md` — **not** a complete implementation. It covers
the Phase 1 slice: auth, tier/topic/gender/language matching, 1:1 moderated
chat, reporting/blocking, and basic ratings. It typechecks cleanly
(`npx tsc --noEmit`) and the Prisma schema is syntactically valid, but it has
**not** been run against a live Postgres/Redis instance — see "What to check
before running" below.

## Layout

```
prisma/schema.prisma      Data model for Section 4's entities
src/config.ts             Env var loading
src/server.ts             Fastify bootstrap: cors, jwt, websocket, routes
src/routes/auth.ts        Signup / OTP verify / login (simplified — see note)
src/routes/match.ts        Create/poll/cancel a match request; hard crisis-topic exclusion
src/routes/chat.ts         WebSocket chat gateway with pre-send moderation
src/routes/safety.ts       Report, block, rate
src/workers/matching.worker.ts   BullMQ worker that pairs queued requests
src/services/moderation.ts       Swappable moderation interface + OpenAI impl
src/lib/crisis.ts          Crisis-topic list + region-keyed resource lookup
src/lib/redis.ts           Shared Redis connections + pub/sub channel naming
src/lib/queues.ts          BullMQ queue definitions
src/lib/prisma.ts          Shared Prisma client
```

## Running with Docker

```bash
cp .env.example .env   # fill in at least JWT_SECRET; others can stay blank for local dev
docker compose up --build
```

This starts Postgres, Redis, runs migrations once (`migrate` service), then
starts the API (`:3000`) and the matching worker. **Not verified in the
sandbox this was built in** — Docker isn't installed there. The
`docker-compose.yml` and `Dockerfile` are written to standard practice and
the YAML has been syntax-checked, but the actual build/run hasn't been
exercised. Try it and expect to debug at least the first run.

## Mandatory subscription gate, free trial, and wellness features (latest addition)

Per product decision: **both** Speaker and Listener roles now require an
active subscription for real matching — enforced server-side in
`routes/match.ts` (`hasActiveSubscription`, `lib/subscription.ts`), not just
assumed client-side. **App Store risk flag, repeating it here since it's
the actual enforcement point:** a hard paywall with zero free usage on
both sides of a two-sided marketplace is a real review-rejection risk on
both app stores. This was an explicit product decision, not a
recommendation.

- **One-time free trial**: `POST /trial/start` — 10 minutes, SILVER tier
  only, no topic selection (fixed "general" tag). Marked used at request
  time (not completion) so cancel-and-retry can't farm multiple trials.
  Server-side enforced expiry lives in `routes/chat.ts` (a `setTimeout` per
  active trial connection — **note**: this timer is lost on a server
  restart mid-trial; acceptable for now, worth a durable-scheduler fix
  before real scale).
- **Journal** (`routes/journal.ts`) and **Mood tracker** (`routes/mood.ts`):
  full CRUD, gated behind the same subscription check. Private per-user
  data, no moderation pipeline (not shared with anyone).
- **Meditation** and **breathing exercise**: mobile-only, no backend
  routes — see the mobile README for what's stubbed there (no real audio).
- `GET /subscription/status`: convenience endpoint the mobile app polls to
  decide whether to show Home, the trial/subscribe offer, or nothing new —
  this is NOT the enforcement point, just a UX convenience. The gated
  routes check for themselves.

## Setup (without Docker)

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, REDIS_URL, JWT_SECRET, OPENAI_API_KEY
npx prisma generate
npx prisma migrate dev --name init
npm run dev             # API server
npm run worker:matching  # in a second terminal — matching won't happen without this
```

Requires a running Postgres and Redis (`docker run -p 5432:5432 postgres`,
`docker run -p 6379:6379 redis` work fine for local dev).

**Note on this build environment specifically:** the sandbox this was built
in only allows egress to package registries, not `binaries.prisma.sh`, so
`prisma generate`'s engine-binary download couldn't be verified here (it
still generated the TypeScript types, which is what let `tsc` typecheck
against real Prisma models — see below). On a normal machine with unrestricted
internet, `npx prisma generate` and `npx prisma migrate dev` should work
without the workaround.

## What's real vs. stubbed

| Area | Status |
|---|---|
| Moderation | **Real** — calls OpenAI's hosted `/v1/moderations` endpoint, per your call. Fails closed (blocks) on timeout/error rather than skipping moderation. |
| Matching (tier/topic/gender/language/**spatial radius**) | **Real** logic, simple poll-and-retry implementation. Distance filtering uses haversine on `User.latitude/longitude`, only applied when the requester specified a radius and both users have shared a location. Not load-tested. |
| Payments | **Real Stripe integration** — checkout session creation, webhook handler with signature verification, subscription sync. Won't do anything until you fill in real `STRIPE_*` env vars from an actual Stripe account/dashboard. |
| Listener leveling/points | **Real** — append-only ledger (`PointLedgerEntry`), 100 pts/level capped at level 4 per Section 1. Pure math lives in `services/leveling-math.ts`, separated specifically so it's unit-testable without a DB connection. |
| Push notifications | **Real** — Expo push on match-found. Requires the mobile app to actually register a push token via `PATCH /me`. |
| Admin dashboard | **Real**, minimal — single-file HTML/JS UI at `/admin`, backend routes for reports/escalated-events/suspend/ban, gated by one shared bearer token. Fine for a couple of trusted people, not a real access-control system. |
| Escalated-content encryption + audit logging | **Real** — AES-256-GCM at the application layer (`lib/encryption.ts`, tested), independent of hosting; every decrypt writes an `AccessAuditLog` row, viewable at `GET /admin/audit-log`. Requires `ESCALATION_ENCRYPTION_KEY` to be set — the server will throw if escalated content needs encrypting/decrypting and it's missing, by design. |
| Monitoring | **Real** — Sentry wired into both the API's error handler and the matching worker's failure handler. No-op if `SENTRY_DSN` isn't set. |
| Deployment | **Documented in `DEPLOYMENT.md`** — a free-tier-now path (Render + Neon + Upstash) with an explicit path to real cloud later. `Dockerfile` + `docker-compose.yml` included; **not verified in this sandbox** (no Docker available here). |
| Crisis-topic exclusion | **Real** — enforced server-side in `match.ts`, not just a client-side filter. |
| WebSocket chat + pub/sub fan-out | **Real**, single-process and multi-process safe via Redis. |
| Tests | 16 vitest tests covering geo math, crisis routing, leveling math, and moderation escalation logic (with mocked `fetch`) — real logic, not smoke tests. |
| CI | GitHub Actions workflow (`.github/workflows/ci.yml`) running typecheck + tests on push/PR. **Assumes this project lives in a `confide-backend/` subfolder of a monorepo** — adjust the `paths:`/`working-directory:` keys if it's its own repo. |
| Auth | **Stubbed.** DOB floor (18+) and phone OTP are real logic, but OTP delivery is logged to console instead of sent via SMS, and this isn't Better Auth (which Section 2 specifies) — it's a minimal JWT flow so everything else has something to authenticate against. Swap this file out when you wire up Better Auth or a real SMS/ID-verification vendor. |
| Age/identity verification | **Stubbed at the "interim mitigation" level only** — DOB self-attestation isn't cryptographic proof. No VOIP-rejection lookup, no ID-verification vendor (Persona/Stripe Identity) integration. |
| Crisis resources | **Placeholder data** for one region — needs legal review before launch per the architecture doc's own Section 9.1. |
| Group chat | **Not built.** Deliberately deferred — it's a real schema redesign (1:1 → N-party participants), not a bolt-on, and Section 11 puts it at Phase 3 anyway. |
| Encryption-at-rest + access audit logging for escalated content | Schema fields exist (`escalatedPlaintext`, `escalatedRetainUntil`), no implementation — infra-level work needing a decision on approach. |

## Important caveat on "typechecks cleanly"

This was built in a sandbox that can reach npm/GitHub but not
`binaries.prisma.sh`. Early on, that meant `prisma generate` silently fell
back to a placeholder `type PrismaClient = any` instead of real
schema-derived types — so an initial "clean typecheck" claim for this
project was **not actually validating Prisma model/field usage at all**. On
a normal machine, `npx prisma generate` will produce real types and may
surface issues this sandbox couldn't catch. Run it and re-typecheck before
trusting this fully. The 16 vitest tests are a stronger signal than the
typecheck was — they exercise real logic (geo math, crisis routing, leveling
math, moderation escalation) rather than depending on generated types.

## Deliberately not solved here

A few things the architecture doc calls out as open questions are left as
TODOs rather than guessed at, since guessing wrong here is expensive to
unwind later:

- Exact crisis-resource content/region coverage (legal review required).
- Real SMS/OTP provider and VOIP-number rejection.
