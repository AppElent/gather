# Gather mobile

Gather mobile is the native, connected-only companion to the Gather household
app. It shares the same Clerk account and Convex service as the web app.

## How this app behaves

Interaction rules — press-and-hold, swipe, haptics, sheets, undo, loading,
empty states — live in [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md#interaction-vocabulary).
Read it before adding a screen. The research behind it is in
[`docs/records/2026-08-20-mobile-interaction-vocabulary.md`](../../docs/records/2026-08-20-mobile-interaction-vocabulary.md).

## Run locally

1. Copy `.env.example` to `.env.local` and provide the Clerk and Convex values.
2. From the repository root, run `pnpm --filter @gather/mobile start`.
3. Open the development build on a device, or start the Android or iOS target
   with `pnpm --filter @gather/mobile android` or
   `pnpm --filter @gather/mobile ios`.

The native app icon and launch mark are rendered from Gather's web favicon. A
native rebuild is required after changing `app.json` or anything in
`assets/images`.

## Building, verifying and shipping

- Development build, `agent-device` and the Drop harness:
  [mobile verification](../../docs/runbooks/mobile-verification.md).
- Over-the-air updates, store builds, channels and rollback:
  [mobile releases](../../docs/runbooks/mobile-releases.md).
- Coding rules: [CODING_STANDARDS.md](CODING_STANDARDS.md).
