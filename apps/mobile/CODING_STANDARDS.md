# Gather mobile coding standards

Apply the shared [mobile coding](../../docs/standards/mobile-coding.md),
[mobile structure](../../docs/standards/mobile-structure.md) and
[mobile baseline](../../docs/standards/mobile-baseline.md) standards. UI rules:
[mobile design system](DESIGN_SYSTEM.md).

## Bindings

- **A development build, never Expo Go.** Expo Go cannot load this app's native
  surface (Clerk, SQLite, secure storage, image picking, `expo-updates`,
  `expo-share-intent`). Build, run and drive it as in
  [mobile verification](../../docs/runbooks/mobile-verification.md).
- **Verify on the device, not with `typecheck` alone**, through `agent-device`,
  running the loop in [verification](../../docs/standards/verification.md).
- **A JavaScript change ships over the air; a native one needs a build**
  ([ADR-0029](../../docs/adr/0029-a-javascript-change-ships-over-the-air-and-a-native-one-does-not.md)).
  The `fingerprint` runtime policy decides which, so a native dependency,
  `app.json` or config-plugin change never reaches installed builds by update.
  Nothing under `src/` imports `expo-updates`; updates apply silently on the
  next launch. Publishing: [mobile releases](../../docs/runbooks/mobile-releases.md).
- **`EXPO_PUBLIC_*` are inlined at bundle time**
  ([mobile baseline](../../docs/standards/mobile-baseline.md#build-and-release-boundaries)).
  `EXPO_PUBLIC_CONVEX_URL` and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` are
  required — `src/auth/config.ts` and `src/convex/provider.tsx` throw at import
  without them.
- **Local files** are read with `expo-file-system`
  ([mobile coding](../../docs/standards/mobile-coding.md)); Convex answers an
  upload with an empty `Content-Type` with a `BadHeader` 400. Upload order and
  registration: [stored files](../../docs/contracts/stored-files.md).
- **A Drop is native surface** — see [Drop](../../docs/contracts/drop.md).
- **Auth is Clerk Core 3** (`@clerk/expo`), a generation ahead of the web
  ([ADR-0014](../../docs/adr/0014-the-phone-is-a-clerk-generation-ahead-of-the-web.md)).
- **Words** come from `@gather/core`'s message trees, composed with the phone's
  own in `src/i18n/messages/`; rules in [localization](../../CODING_STANDARDS.md#localization).
- **Tests** run in the root Vitest `mobile` project (`src/**/*.test.ts`), and
  `pnpm --filter @gather/mobile typecheck` covers the app.
