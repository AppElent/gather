# Gather mobile

Gather mobile is the native, connected-only companion to the Gather household
app. It shares the same Clerk account and Convex service as the web app.

## How this app behaves

Interaction rules — press-and-hold, swipe, haptics, sheets, undo, loading,
empty states — live in [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md#interaction-vocabulary).
Read it before adding a screen. The research behind it is in
[`docs/records/2026-08-20-mobile-interaction-vocabulary.md`](../../docs/records/2026-08-20-mobile-interaction-vocabulary.md).

## Run locally

1. `.env.local` is generated: a new worktree gets it from the `t3.json` setup
   hook, and `pnpm env:apply local --only file` (from the repository root)
   rewrites it from Infisical. Never edit it by hand.
2. From the repository root, run `pnpm --filter @gather/mobile start`.
3. Open the development build on a device, or start the Android or iOS target
   with `pnpm --filter @gather/mobile android` or
   `pnpm --filter @gather/mobile ios`.

The native app icon and launch mark are rendered from Gather's web favicon. A
native rebuild is required after changing `app.json`, `app.config.ts` or
anything in `assets/images`. `app.config.ts` gives each build variant its own
name, bundle ID, scheme and badged icon ([ADR 0045](../../docs/adr/0045-each-build-variant-installs-beside-the-others.md));
rerun `node apps/mobile/scripts/badge-icons.mjs` after changing an icon.

## Building, verifying and shipping

- Development build, `agent-device` and the Drop harness:
  [mobile verification](../../docs/runbooks/mobile-verification.md).
- Over-the-air updates, store builds, channels and rollback:
  [mobile releases](../../docs/runbooks/mobile-releases.md).
- Coding rules: [CODING_STANDARDS.md](CODING_STANDARDS.md).

## The standalone staging loop

Staging on the phone is **Gather Preview** (`com.appelent.gather.preview`, the
`preview` channel): a release build with no Metro, on the production Clerk
instance and the production Convex deployment
([ADR 0039](../../docs/adr/0039-staging-is-a-frontend-on-the-production-backend.md)).
It writes real household data, so test destructive flows (account deletion,
leaving a Group) on a throwaway account. iOS only: Android is paused
([releases standard](../../docs/standards/releases.md#android-pause)),
so there is no Android staging build or script.

1. **Build** only when the native fingerprint changes: the mobile runtime PR
   comment says so, and the preview update job reports "rebuild
   `preview-internal`". From `apps/mobile`, after `pnpm install` at the root:
   `pnpm exec eas build -p ios --profile preview-internal`. A new iPhone is
   registered first with `pnpm exec eas device:create`; the first build of a new
   bundle ID or extension runs without `--non-interactive`
   ([channels](../../docs/runbooks/mobile-releases.md#channels)).
2. **Install** from the EAS build page on the registered iPhone. Stop Metro
   and take the Mac off the network the phone uses, so nothing is served from
   a laptop.
3. **Update.** Every merge to `main` publishes an over-the-air update to
   `preview` (`mobile-update.yml`); by hand, `pnpm mobile:update:preview
   --message "…"` from the root. Close and reopen the app twice: the first
   launch downloads it, the second runs it.
4. **Walk it.** Sign in and out, switch Groups, open each Module, Settings,
   the Unavailable screen (airplane mode on, launch, Try again, airplane mode
   off) and a `gather-preview://` link. Errors reach Sentry under the
   `preview` environment.
5. **Roll back** a bad update with `eas update:republish` or
   `eas update:roll-back-to-embedded`
   ([when a bad update is out](../../docs/runbooks/mobile-releases.md#when-a-bad-update-is-out)).

Preview shows every Module, placeholders included; only the store build
(`APP_VARIANT=production`) hides the ones that are not live
(`src/modules/moduleVisibility.ts`). To see what the store build shows on a
development build, start Metro with `EXPO_PUBLIC_LIVE_MODULES_ONLY=1`.
