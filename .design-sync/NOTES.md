# design-sync notes — apps/mobile

Findings that cost a debugging cycle. Read before changing `.ds-sync/`.

## Why this sync is off-script

Neither converter shape fits. `apps/mobile` is an Expo / React Native app: no
Storybook, no `*.stories.*`, and no compiled `dist/` of components. The upload
layout is therefore generated directly by `.ds-sync/build.mjs`. The verification
gates still apply — every preview is rendered and graded before it uploads.

## react-native-web is the whole mechanism

Claude Design renders React in a browser, so every component goes through
`react-native-web` (already a dependency, for `expo start --web`).

- **`Appearance.setColorScheme` does not exist in react-native-web.**
  `AppearanceProvider` calls it in a `useEffect` to move the *platform's* idea of
  the scheme. In a browser that call throws inside a passive effect and React
  unmounts the entire tree — the symptom is a completely blank page with one
  console error, not a styling glitch. `.ds-sync/shims/react-native.js` wraps
  react-native-web and patches it to a no-op. Do not "fix" this by deleting the
  effect in `src/theme/appearance.tsx`: on a phone that call is load-bearing
  (keyboard, selection handles, tab bar).
- **`--resolve-extensions` must put `.web.*` first.** This is the platform
  extension mechanism Metro provides and esbuild does not. Without it,
  `react-native-svg` resolves its fabric/native variants and the build fails with
  ~32 `Could not resolve "react-native/Libraries/..."` errors. With it, the same
  package resolves `ReactNativeSVG.web.js` and every lucide icon renders.
- `--main-fields=module,browser,main` for the same family of reasons.

## Shims, and why each exists

| Shim | Reason |
| --- | --- |
| `react-native` | react-native-web + the `Appearance.setColorScheme` patch above. |
| `expo-router` | `Stack.Screen`, `Link`, `useRouter` are meaningless in a static preview. Four components import it. |
| `expo-sqlite/kv-store` | `localPreference` needs a *synchronous* store before first paint; a preview has nothing to persist. |
| `expo-localization` | Previews render in the source language (English). |
| `convex/react` | Only `GroupForms` reaches the backend. The shim returns fixture data so the form renders without a deployment. |

## Provider wrap

Nothing renders correctly unstyled-but-present; it renders *wrong* or not at all.
Every preview is wrapped in `SafeAreaProvider` → `AppearanceProvider` →
`LocaleProvider`. `useTokens` throws outside `AppearanceProvider` by design, and
that is the right behaviour — a screen in the wrong scheme is a wiring bug.

`SafeAreaProvider` needs explicit `initialMetrics` in a preview; without a real
device there are no insets to measure and components that read
`useSafeAreaInsets()` collapse their padding.

## Three more things that each cost a debugging cycle

- **`process` is not defined in a browser, and `src/auth/config.ts` *throws*
  without a publishable key.** Both are handled by defines in `build.mjs`. The
  key is deliberately `pk_live_…`-shaped, not `pk_test_…`: the test prefix is
  what unlocks the dev-login shortcut in `WelcomeActions`, and a design agent
  should see the front door real users get. A `process` banner catches anything
  else that reaches for the global. Symptom if missing: every card blank,
  `ReferenceError: process is not defined`, then `Cannot read … 'mount'`.
- **The Clerk shim must be Core 3, not Core 2 (ADR-0014).** `useSignIn()` has to
  return an `errors` signal with `{ fields, global }` — `usePasswordSignIn`
  calls `pickError(errors, …)` during render and reads `errors.fields`
  unconditionally. A shim without it throws on first render and `WelcomeActions`
  renders as a blank card while every other component looks fine.
- **Windows: do not `rmSync` the output directory itself.** Anything holding a
  handle inside it — the preview server, a browser with a card open, a virus
  scanner — makes removing the directory fail with EPERM even though its
  contents delete fine. `cleanOutDir()` clears the children and leaves the
  directory in place.

## Verifying a rebuild

`node .ds-sync/sheet.mjs light` (and `dark`) writes a local contact sheet that
iframes all 20 cards, so a whole scheme can be checked in one screenshot. The
sheets are gitignored and never uploaded. Serve `apps/mobile` over HTTP —
`file://` is blocked by the browser tooling.

## Preference keys

The appearance key is `gather:appearance` (colon, not dot) — see
`src/prefs/localPreference.ts`. The probe shim seeds it from a `?scheme=` query
param so the dark palette is verified through the real provider rather than a
fake.
