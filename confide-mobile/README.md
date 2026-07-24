# Confide — Mobile Skeleton (Phase 1)

Expo/React Native app that talks to `confide-backend`. Covers the core loop:
sign up → verify OTP → pick role/topic → wait for a match → chat (moderated,
real-time) → rate → repeat. Typechecks cleanly (`npx tsc --noEmit`).

## Setup

```bash
npm install
npm start   # then press 'i' for iOS simulator or 'a' for Android emulator
```

Expects `confide-backend` running locally (`API_BASE_URL`/`WS_BASE_URL` in
`src/api/client.ts` point at `localhost:3000`). If you're running on a
physical device instead of a simulator, `localhost` won't reach your laptop —
swap in your machine's LAN IP, or better, wire up an env-based config
(`expo-constants` + `app.config.ts`) before this goes further.

## What's here

- `src/screens/SignupScreen.tsx`, `VerifyOtpScreen.tsx` — auth flow against
  the backend's simplified JWT endpoints (see backend README for the Better
  Auth caveat)
- `src/screens/RoleTopicScreen.tsx` — speaker/listener + topic + gender pref,
  and the hard crisis-topic redirect if the backend routes the request away
  from matching
- `src/screens/MatchingScreen.tsx` — polls match status until matched/expired
- `src/screens/ChatScreen.tsx` — WebSocket chat, renders blocked-message and
  crisis-resource events from the moderation pipeline, report/block/end menu
- `src/screens/RateConversationScreen.tsx`, `CrisisResourcesScreen.tsx`
- `src/screens/BillingScreen.tsx` — tier picker, opens Stripe Checkout in the
  system browser via the backend's checkout-session endpoint
- `src/screens/ListenerProfileScreen.tsx` — level/points/rating display
- `src/screens/SettingsScreen.tsx` — edit display handle/languages, links to
  stats/billing, sign out (backed by the new `GET /me` / extended
  `PATCH /me` on the backend)
- `src/hooks/useRegisterDeviceInfo.ts` — requests push + location permission
  and syncs both to the backend (`PATCH /me`) once signed in; degrades
  gracefully if either is declined
- `src/context/AuthContext.tsx` — token persistence via AsyncStorage
- `src/api/client.ts` — typed fetch wrapper matching the backend's route
  shapes exactly
- `assets/` — placeholder icon/splash/adaptive-icon/favicon (simple
  generated shapes, not real brand assets — swap before shipping)

## Notes on the newer additions

- **Push notifications**: `expo-notifications` needs a real EAS project id
  (`app.json` → `extra.eas.projectId`) to call `getExpoPushTokenAsync()` in
  a real build — it'll throw (caught, logged, skipped) in an unconfigured
  local dev client. Run `eas init` before relying on this.
- **Location**: requests foreground permission only, at low accuracy —
  intentionally coarse, matching the backend's privacy stance on
  `User.latitude/longitude` (see backend README).
- **Billing**: opens Stripe Checkout in the system browser rather than an
  in-app WebView. Flagging again here: Apple/Google may require their own
  IAP for this depending on how tiers get classified — confirm with both
  stores before shipping a Stripe-only flow.
- One TypeScript quirk worth knowing about: under plain `tsc` (not Metro),
  Expo SDK 51's package-exports map resolves `expo-notifications`'
  permission-response types to an empty stub instead of the real shape.
  `useRegisterDeviceInfo.ts` casts past it with a comment — the runtime
  object genuinely has `.granted`, this is a type-resolution gap, not a
  logic bug.

## Notes on the newest additions (paywall, trial, wellness features)

- **Navigation restructure**: `Welcome` is now the landing screen right
  after OTP verification (not `RoleTopic`/`Home`). It checks
  `GET /subscription/status` on every focus (not just mount — a screen
  further down the stack getting popped back into view via `goBack()`
  doesn't remount, so a plain `useEffect` would show stale state) and
  forwards to `Home` if a subscription is active, or offers the trial/
  subscribe choice if not.
- **Topic selection is now a picker** (`components/TopicPickerModal.tsx`),
  not free text — includes a clearly-labeled crisis option that still maps
  to the exact tag the backend's hard crisis-exclusion checks for.
- **Trial flow**: `TrialRoleSelectScreen` (Speak/Listen only, no topic) →
  `MatchingScreen` (unchanged, works for trial and real requests alike) →
  `ChatScreen` (now shows a live countdown banner, driven by a `trial_info`
  WebSocket event). Ending a trial — automatically or manually — routes to
  `TrialEndedScreen`, which previews locked features and offers Subscribe.
- **BillingScreen** now re-checks subscription status when the app returns
  to the foreground after the Stripe Checkout browser tab, with a few
  retries (the webhook can lag slightly) and a manual "I've already
  subscribed" fallback button — since there's no in-app way to know a
  browser-based checkout completed otherwise.
- **Meditation** (`MeditationScreen.tsx`): timer + calming visual only —
  **no real audio is bundled**. I can't source or verify licensing for
  meditation audio. To add real sound: install `expo-av` or `expo-audio`,
  add royalty-free tracks under `assets/meditation/`, and wire playback to
  the existing timer state.
- **Journal** and **Mood tracker**: full CRUD against the new backend
  routes, gated behind the subscription check server-side (a 402 here
  would mean the paywall gate let someone through it shouldn't have).
- **Breathing**: pure client-side animation (box breathing, 4-4-4-4), no
  backend or audio dependency at all.

## Explicitly not built here

- Group chat, dark/light theming beyond the one palette used here
- Gender is intentionally NOT editable in Settings — see the comment in
  `SettingsScreen.tsx` for why
- No E2E/device testing — CI (`.github/workflows/ci.yml`) covers typecheck
  only; that needs an actual simulator/device farm, not just more code
- App icon/splash are placeholder generated shapes, not real brand assets
