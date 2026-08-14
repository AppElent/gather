# How does Convex work in React Native, and how is the Clerk JWT bridge expressed there?

Research for [#138](https://github.com/AppElent/gather/issues/138), part of the mobile
shell map ([#134](https://github.com/AppElent/gather/issues/134)). Blocks
[#143](https://github.com/AppElent/gather/issues/143) (the sharing decision), because
question 5 — how `convex/_generated/api` crosses the workspace boundary — is a
sharing question wearing a bundler costume.

**Sources.** Convex's own docs (`docs.convex.dev`), Convex's own source
(`get-convex/convex-js`) and Convex's own Expo+Clerk monorepo template
(`get-convex/turbo-expo-nextjs-clerk-convex-monorepo`); Clerk's own docs
(`clerk.com/docs`); Expo's own docs (`docs.expo.dev`) and Expo's own source
(`expo/expo`); Metro's own docs (`metrobundler.dev`); the npm registry for versions.
No blog posts, no Medium. Two Clerk *articles* on `clerk.com` are cited where they are
the only first-party statement on a point, and are marked as such.

Local reading: `src/integrations/convex/provider.tsx`,
`src/integrations/clerk/provider.tsx`, `convex/auth.config.ts`,
`convex/_generated/api.{js,d.ts}`, `package.json`, `pnpm-workspace.yaml`,
`tsconfig.json`, `apps/mobile/{package.json,tsconfig.json,app.json}`.

Version snapshot taken **2026-08-12** from the npm registry.

---

## Verdict, one line per question

| # | Question | Answer |
| --- | --- | --- |
| 1 | Which client package? | **Plain `convex/react`.** No RN entry point exists and none is needed. WebSocket works unchanged. |
| 2 | How is the auth bridge wired? | **The same `ConvexProviderWithClerk` from `convex/react-clerk`**, given `useAuth` from `@clerk/expo` instead of `@clerk/clerk-react`. Convex explicitly supports this. |
| 3 | Does anything need native code? | **Convex: no.** **Clerk: yes** — `@clerk/expo` ships a config plugin and native SDKs, and needs `expo-secure-store` for the token cache. This costs a build. |
| 4 | What has to be configured? | `EXPO_PUBLIC_CONVEX_URL` + `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in `apps/mobile/.env.local`, inlined by Metro at bundle time. No backend change — `convex/auth.config.ts` already covers the phone. |
| 5 | Does the generated API cross the workspace boundary? | **Yes, and Metro needs told nothing** on SDK 57 — `metro.config.js` can be the two-line default. The work is in `package.json`/`tsconfig.json`, not in Metro. The real risk is **pnpm's isolated node-linker**, not Metro's resolver. |
| 6 | Anything that differs from web? | Reconnection is automatic and already handled; the differences are **iOS background socket suspension**, **no `beforeunload`**, and **an Expo-specific Clerk bug that gather's convex version already contains the fix for**. |

**Nothing here requires a change to the `apps/mobile` scaffold's architecture, and
nothing forces a native module for Convex.** The one finding that genuinely moves the
plan is in §3 (Clerk is the thing that costs an EAS build, and it costs it on day one)
and §5.3 (pnpm's node linker may have to change repo-wide).

---

## 1. Which client package, and does the socket work?

**`convex/react`. The same import the web app uses.** There is no
`convex/react-native` entry point — the `convex` package's `exports` map contains
exactly `.`, `./server`, `./react`, `./react-auth0`, `./react-clerk`, `./nextjs`,
`./browser`, `./values`, `./package.json`
([convex@1.43.0 package.json](https://unpkg.com/convex@1.43.0/package.json)).

Convex's React Native quickstart states it outright: *"React native uses the same
library as React web"*
([React Native Quickstart](https://docs.convex.dev/quickstart/react-native)), and
`docs.convex.dev/client/react-native` is a stub that forwards to the plain React
client docs and to the
[`convex-demos/react-native`](https://github.com/get-convex/convex-demos/tree/main/react-native)
sample.

**The reactive socket works unchanged.** *"The `ConvexReactClient` connects to your
Convex deployment by creating a `WebSocket`"* and *"If the internet connection drops,
the client will handle reconnecting and re-establishing the Convex session
automatically"* ([Convex React](https://docs.convex.dev/client/react)). React Native
provides a global `WebSocket` on both platforms, and the client takes it from the
global environment by default —
[`webSocketConstructor`](https://docs.convex.dev/api/interfaces/browser.BaseConvexClientOptions)
exists precisely so you *can* override it, and nothing in RN requires you to.

**No polyfills.** The quickstart lists none, the Expo guide lists none, and the
`convex` package's Node-specific code path is quarantined behind a `"node"` export
condition on `./browser` only (`./dist/cjs/browser/index-node.js`, the branch that
pulls in `ws`). Metro never asserts the `node` condition, so RN gets the browser build
that uses the global socket. `convex`'s `ws`/`esbuild`/`prettier` dependencies are CLI
and Node-runtime concerns and are not reachable from `convex/react`.

**Bundle-graph caveat.** Metro has `unstable_enablePackageExports` **enabled by
default since SDK 53**
([metro.config.js](https://docs.expo.dev/versions/latest/config/metro/)), which is what
makes the above true. If anyone ever disables it to work around an unrelated library,
`convex` falls back to `main` (`./dist/cjs/index.js`) and the export-condition
quarantine stops applying. Don't disable it.

---

## 2. The auth bridge, and what changes from the web

### What gather does today

`src/integrations/clerk/provider.tsx` — plain `ClerkProvider` from
`@clerk/clerk-react`, keyed on `import.meta.env.VITE_CLERK_PUBLISHABLE_KEY`, with
`signInUrl` / `signUpUrl` / `afterSignOutUrl` pointed at gather's own routes.

`src/integrations/convex/provider.tsx` — a module-scope
`new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)`, wrapped by
`<ConvexProviderWithClerk client={convex} useAuth={useAuth} />` where `useAuth` comes
from `@clerk/clerk-react`. The file carries a comment pinning `convex >= 1.42.2` —
which turns out to be an *Expo* bug fix (see §6.3).

`convex/auth.config.ts` — one provider, `domain: process.env.CLERK_JWT_ISSUER_DOMAIN`,
`applicationID: 'convex'`.

### What changes on Expo

**Structurally: three lines.** The bridge composes exactly as it does on the web.

| Web | Expo |
| --- | --- |
| `import { useAuth } from '@clerk/clerk-react'` | `import { useAuth } from '@clerk/expo'` |
| `import { ClerkProvider } from '@clerk/clerk-react'` | `import { ClerkProvider } from '@clerk/expo'` + `import { tokenCache } from '@clerk/expo/token-cache'` |
| `import.meta.env.VITE_*` | `process.env.EXPO_PUBLIC_*` |
| `signInUrl` / `signUpUrl` / `afterSignOutUrl` | *(nothing — these are URL-router concepts; the phone navigates with Expo Router)* |
| — | `tokenCache={tokenCache}` (persists the session to the Keychain/Keystore) |

This is not inference. Convex's API reference for
[`ConvexProviderWithClerk`](https://docs.convex.dev/api/modules/react_clerk) says the
component *"must be wrapped by a configured `ClerkProvider`, from `@clerk/react`,
`@clerk/clerk-expo`, `@clerk/nextjs`, and others"* — Expo is named in Convex's own docs
for the very component gather already uses. And Convex's own
[Expo+Clerk monorepo template](https://github.com/get-convex/turbo-expo-nextjs-clerk-convex-monorepo/blob/main/apps/native/ConvexClientProvider.tsx)
is this exact composition.

Note that Convex's prose page [Convex & Clerk](https://docs.convex.dev/auth/clerk)
covers only Next.js and React-with-Vite, and Clerk's own
[Integrate Convex with Clerk](https://clerk.com/docs/guides/development/integrations/databases/convex)
page has **no Expo section at all**. The Expo support is real but it is documented in
the API reference and the template, not in the guide.

### Minimal working provider sketch

`apps/mobile/src/integrations/convexClerk.tsx` (name/location to taste):

```tsx
import { ClerkProvider, useAuth } from '@clerk/expo'
import { tokenCache } from '@clerk/expo/token-cache'
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import type { ReactNode } from 'react'

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL
const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY

if (!convexUrl) throw new Error('Missing EXPO_PUBLIC_CONVEX_URL')
if (!clerkPublishableKey) throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY')

// unsavedChangesWarning is a browser-only feature and defaults to true; React
// Native has a `window` but no `beforeunload`, so turn it off explicitly.
const convex = new ConvexReactClient(convexUrl, { unsavedChangesWarning: false })

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}
```

Mounted from `apps/mobile/app/_layout.tsx` around the `<Stack />` / `<Slot />`.

`unsavedChangesWarning: false` is what both
[Expo's Convex guide](https://docs.expo.dev/guides/using-convex/) and
[Convex's RN quickstart](https://docs.convex.dev/quickstart/react-native) pass. The
option is documented as *"Whether to prompt the user if they have unsaved changes
pending when navigating away or closing a web page"*, is browser-only, and **defaults
to `true`**
([`ConvexReactClientOptions`](https://docs.convex.dev/api/interfaces/react.ConvexReactClientOptions)).
Leaving it on is not known to throw on RN, but it is dead weight guarding an event that
does not exist.

### Backend: nothing to do

`convex/auth.config.ts` is deployment-level, not client-level. The phone presents a
Clerk JWT with `aud: "convex"` from the same Clerk instance and the same
`CLERK_JWT_ISSUER_DOMAIN`, so **the same Convex deployment authenticates it with no
change**. The mobile app is genuinely a second client onto the existing backend, as
#134 assumes.

### Package-name and Clerk-major wrinkle — flag for the coordinator

Clerk **renamed the SDK from `@clerk/clerk-expo` to `@clerk/expo`** in Clerk Core 3
(released 2026-03-03, per Clerk's own article
[Clerk Compatibility in Expo 54 and 55](https://clerk.com/articles/clerk-compatibility-in-expo-54-and-55)).
Both names are still published, and they are on different Clerk majors:

| Package | Latest | Bundles | `expo` peer | `react-native` peer |
| --- | --- | --- | --- | --- |
| `@clerk/expo` | **4.2.7** | `@clerk/react@^6.14.1` (Core 3) | `>=54 <58` | `>=0.75` |
| `@clerk/clerk-expo` | 2.20.0 | `@clerk/clerk-react@^5.61.9` (Core 2) | *(none declared)* | `>=0.73` |

**Use `@clerk/expo@4`.** It is the only one whose declared `expo` peer range
(`>=54 <58`) covers **SDK 57**. Convex's template still uses the old name because it
is on SDK 55, and Convex's `ConvexProviderWithClerk` doc comment still says
`@clerk/clerk-expo` — cosmetic lag, not a compatibility statement.

Consequence worth naming: **the repo will contain two Clerk major lines** —
`@clerk/clerk-react@5` (Core 2) on the web, `@clerk/react@6` (Core 3) vendored inside
`@clerk/expo@4` on the phone. These are distinct npm packages so pnpm installs both
without conflict, and `convex@1.43.0` declares peers for *both*
(`"@clerk/react": "^6.4.3"` **and** `"@clerk/clerk-react": "^4.12.8 || ^5.0.0"`), so
`convex/react-clerk` supports either. They talk to the same Clerk instance, so the JWT
template and issuer domain are shared. **But the web is one major behind**, and that
is a latent divergence someone should decide about deliberately rather than discover.

---

## 3. Native code — this is where the plan changes

**Convex needs no native code, no config plugin, and no rebuild.** It is pure
JavaScript over the platform `WebSocket`. Neither
[Expo's Convex guide](https://docs.expo.dev/guides/using-convex/) nor Convex's
quickstart mentions a plugin, a native module, or a `metro.config.js` change. A Convex
version bump is a JS-only reload.

**Clerk does.** Per
[Clerk's Expo quickstart](https://clerk.com/docs/expo/getting-started/quickstart):

- Install is `@clerk/expo` + `expo-secure-store` (+ `expo-auth-session`,
  `expo-crypto`, `expo-web-browser` for hosted/OAuth flows).
- *"Verify `@clerk/expo` and `expo-secure-store` appear in the `plugins` array of
  `app.json`."* Both are **config plugins**.
- Clerk's own article notes the `@clerk/expo` config plugin *"automatically adds the
  native SDKs (clerk-ios and clerk-android) and configures required build settings"*
  ([migration article](https://clerk.com/articles/migrating-from-clerk-clerk-expo-to-clerk-expo-breaking-changes-native-components)).

A config plugin mutates the native project, and **Expo Go cannot apply config
plugins** — it is a prebuilt binary. So:

### What this costs, concretely

| Path | Works? | Cost |
| --- | --- | --- |
| Stock Expo Go (App Store) | Only up to SDK 54; SDK 57's is still in Apple review (Expo's own [SDK 57 changelog](https://expo.dev/changelog/sdk-57): *"We'd like to release a new version for SDK 57, but we're still waiting on approval."*) | — |
| **Android via `expo start`** | Yes for email/password + `useAuth()` JS flows; **no** for OAuth/native sign-in | Free |
| **iOS via `eas go`** | Same limits as Expo Go — it is Expo Go, just yours | 1 build, needs the Apple membership already planned |
| **Development build** (`eas build --profile development`) | Everything | 1 iOS + 1 Android build, **plus a rebuild whenever `app.json` plugins change** |

Clerk is explicit that the JS-only path survives Expo Go: *"email/password sign-in and
sign-up, phone verification (OTP), magic links"* work, while *"social OAuth
(`useSSO()`), native Google Sign-In, native Apple Sign-In"* do not, because *"Expo Go
cannot load custom native modules or register custom URL schemes"*
([Clerk Expo 54/55 compatibility](https://clerk.com/articles/clerk-compatibility-in-expo-54-and-55),
[Expo Go or Development Build?](https://clerk.com/articles/expo-go-or-development-build-building-production-ready-authentication-with-clerk)).

### The finding that matters for #134

**#134's "roughly one iOS build plus one per native dependency added" is right, but
the first native dependency is Clerk, and it arrives in the first wiring ticket, not
late.** Two follow-on consequences:

1. **The map's "real Clerk sign-in" premise needs a sign-in *method* decided.** If
   Eric signs in with email/password or an email OTP code, `eas go` is enough and the
   shell can be driven from an Android emulator all the way through. **If he expects
   "Sign in with Google/Apple", that is a development build from day one** — and the
   Android emulator loop needs a dev build too, not just `expo start`. This is a
   question for #143's neighbourhood, or a ticket of its own; it is not answerable
   from documentation.
2. **`expo-secure-store` is a genuine native module.** It is an Expo SDK module and is
   therefore *inside* Expo Go, so the token cache itself does not force a dev build.
   `@clerk/expo`'s own config plugin is the thing that does — and only for the native
   features it enables.

Worth confirming empirically rather than from docs: whether `@clerk/expo@4`'s plugin is
*required* to be listed for the JS-only flow, or whether omitting it degrades
gracefully to a working Expo Go build. Clerk's quickstart says to verify it is present;
it does not say the JS flow breaks without it. **A ten-minute check on the Android
emulator settles this and saves guessing.**

---

## 4. Configuration and environment values

### The two variables

```
# apps/mobile/.env.local   (gitignored)
EXPO_PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

Both names are the documented conventions:
[Expo's Convex guide](https://docs.expo.dev/guides/using-convex/) writes
`EXPO_PUBLIC_CONVEX_URL` to `.env.local`, and
[Clerk's Expo quickstart](https://clerk.com/docs/expo/getting-started/quickstart) uses
`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. Convex's own
[deployment URLs page](https://docs.convex.dev/client/react/deployment-urls) frames this
as the per-framework prefix rule that already gives the web `VITE_CONVEX_URL`.

### How Expo env vars actually behave — four rules that bite

From [Environment variables in Expo](https://docs.expo.dev/guides/environment-variables/):

1. **They are inlined by Metro at bundle time, not read at runtime.** *"These variables
   will be visible in plain-text in your compiled application."* The Clerk publishable
   key and the Convex URL are both public by design, so this is fine — but it means
   **never** put anything else behind `EXPO_PUBLIC_`.
2. **Only static dot access is inlined.** `process.env.EXPO_PUBLIC_CONVEX_URL` works;
   `process.env['EXPO_PUBLIC_CONVEX_URL']` and destructuring do **not**. This is a real
   trap for anyone writing a `getEnv()` helper — a t3-oss/`env-core`-style dynamic
   accessor, like the web's `src/env.ts`, will silently yield `undefined`. **Do not
   port `src/env.ts` to the phone.**
3. **Editing `.env` does not need a CLI restart, but does need a full reload** — shake
   → Reload. A Fast Refresh will not pick up a changed value.
4. **`.env` files load from the project root**, i.e. `apps/mobile/`, not the monorepo
   root. Expo's docs say *"in the root of your project directory"* and do not carve out
   a monorepo case. Convex's own template puts `.example.env` in `apps/native/`.
   Verify empirically if a shared root `.env` is ever wanted; assume per-app until then.

### EAS builds

`.env.local` is gitignored and therefore invisible to a remote EAS Build:
*"Local `.env` files are unavailable to remote EAS Build jobs because they're typically
excluded from version control"*
([EAS environment variables](https://docs.expo.dev/eas/environment-variables/)). For
`eas go` / `eas build`, the two values become **EAS environment variables** scoped to a
build profile, at visibility **plain text** (both are public anyway; "secret" would be
actively wrong here since they must reach the client bundle).

### Naming consistency note

The web reads `VITE_CONVEX_URL` from `.env.local` at the repo root; the phone reads
`EXPO_PUBLIC_CONVEX_URL` from `apps/mobile/.env.local`. **Two files, two names, one
value.** Worth a line in `.env.example` and in `CLAUDE.md`'s Env vars section when the
wiring lands, or the first "why is the phone on the wrong deployment" will cost an hour.

---

## 5. The Metro / workspace-boundary question

This was flagged as the likeliest source of a nasty afternoon. **The good news is that
Metro is not the problem on SDK 57.** The problems are elsewhere and are all in
config files gather already owns.

### 5.1 `metro.config.js` needs to say nothing

`apps/mobile` has **no `metro.config.js` today**. When one is added it should be
exactly:

```js
// apps/mobile/metro.config.js
const { getDefaultConfig } = require('expo/metro-config')

module.exports = getDefaultConfig(__dirname)
```

That is verbatim what
[Convex's own Expo monorepo template ships](https://github.com/get-convex/turbo-expo-nextjs-clerk-convex-monorepo/blob/main/apps/native/metro.config.js).

**Do not write `watchFolders`, `resolver.nodeModulesPaths`, `resolver.extraNodeModules`,
or `resolver.disableHierarchicalLookup`.** Expo's monorepo guide is unambiguous:
*"Expo configures Metro automatically for monorepos starting with SDK 52... If you
previously configured Metro manually for monorepos and have a `metro.config.js` that
modifies `watchFolders`, delete these from your configuration"*
([Work with monorepos](https://docs.expo.dev/guides/monorepos/)). Every "add this to
metro.config.js" recipe on the internet is pre-SDK-52 advice and will now actively
*narrow* resolution rather than widen it.

The mechanism, from Expo's source: `getDefaultConfig` calls `getMetroServerRoot()`,
which delegates to `resolveWorkspaceRoot()` from the `resolve-workspace-root` package
and caches the result
([`@expo/config/src/paths/paths.ts`](https://github.com/expo/expo/blob/main/packages/@expo/config/src/paths/paths.ts)).
That package understands `pnpm-workspace.yaml`, so **gather's repo root becomes the
Metro server root automatically** and everything under it — including `convex/` — is in
the graph. There is an escape hatch, `EXPO_NO_METRO_WORKSPACE_ROOT`, which must not be
set.

SDK 56 made this stronger still: *"Expo's file map supports on-demand filesystem
access, which means your `watchFolders` no longer need to include every module your app
bundles, and projects that symlink to dependencies outside of the project root will now
resolve correctly"*, adding *"Global Virtual Store support in package managers such as
Bun and pnpm"*
([Metro bundler](https://docs.expo.dev/guides/customizing-metro/)). SDK 57 inherits
this.

Metro's resolver itself walks `node_modules` upward from the requiring file
(*"Try resolving moduleName under `node_modules` from the current directory (i.e. parent
of `context.originModulePath`) up to the root directory"*) and follows symlinks to real
paths ([Metro module resolution](https://metrobundler.dev/docs/resolution/)). So
`convex/_generated/api.js`'s own `import { anyApi, componentsGeneric } from "convex/server"`
resolves from `<repo-root>/convex/_generated/` upward into `<repo-root>/node_modules/convex`
without anything being configured.

### 5.2 The import specifier is the actual decision

`convex/_generated/api` **cannot be written as a bare specifier from `apps/mobile`.**
Not a monorepo issue — `convex` is the name of an npm package, and `convex/_generated/api`
would resolve against `node_modules/convex`, whose `exports` map has no `./_generated`
subpath. This works in a single-package Convex app only because the app's own `convex/`
folder is reached by relative path. gather's web app already knows this: every call site
uses `import { api } from '../../../convex/_generated/api'`.

Three options, in increasing order of tidiness:

**A. Relative path — zero config, works today.**

```ts
import { api } from '../../../../convex/_generated/api'
```

Nothing to install, nothing to declare. The path depth is fragile and the specifier is
unreadable, but it is the fastest way to prove the boundary works end to end. **Use this
for the first spike; do not ship it.**

**B. `apps/mobile` depends on the root package.** Add to `apps/mobile/package.json`:

```json
"dependencies": { "gather": "workspace:*" }
```

then `import { api } from 'gather/convex/_generated/api'`. The root package has **no
`exports` field** (only private `imports`: `{"#/*": "./src/*"}`), and Metro falls back
to legacy file-path resolution for packages without `exports` — so the deep subpath
resolves to `<repo-root>/convex/_generated/api.js`.

Two caveats. **(i)** Whether pnpm will link the *workspace root package itself* via
`workspace:*` is not stated in [pnpm's workspace docs](https://pnpm.io/workspaces) —
the docs discuss `includeWorkspaceRoot` for command execution, not dependency
resolution, and `pnpm-workspace.yaml` here globs only `apps/*`. **Verify with a real
`pnpm install` before committing to this shape.** **(ii)** If anyone ever adds an
`exports` field to the root `package.json`, this import breaks unless `./convex/*` is
mapped — an invisible tripwire.

**C. Move `convex/` into its own workspace package.** This is what
[Convex's own template](https://github.com/get-convex/turbo-expo-nextjs-clerk-convex-monorepo)
does: `packages/backend` is a package named `@packages/backend` whose only real content
is `convex/`, both apps declare `"@packages/backend": "workspace:*"`, and the native app
imports `from "@packages/backend/convex/_generated/api"`. That package has no `exports`
and no `main` either — the deep subpath is resolved by file path, exactly as in B.

C is the shape Convex intends and the shape that makes the boundary explicit. It is also
the most disruptive: it moves `convex/` out of the repo root, which touches every one of
the ~40 web call sites, the `convex.json`-less deploy scripts, `convex/tsconfig.json`,
the seed scripts, and CI. **That is a #143 decision, not a #138 one** — this note's job
is to establish that all three work, and they do.

### 5.3 The real risk is pnpm's node linker, not Metro

gather's `pnpm-workspace.yaml` sets no `nodeLinker`, so it uses pnpm's default
**isolated** install. Expo's position:

> *"Starting with SDK 54, Expo supports isolated dependencies, though some React Native
> libraries may cause issues."* — [Work with monorepos](https://docs.expo.dev/guides/monorepos/)

and the documented remedy is repo-wide:

```yaml
# pnpm-workspace.yaml
nodeLinker: hoisted
```

**Convex's own Expo+Clerk+pnpm template sets exactly this**
([its `pnpm-workspace.yaml`](https://github.com/get-convex/turbo-expo-nextjs-clerk-convex-monorepo/blob/main/pnpm-workspace.yaml),
pnpm 10.33.0, `nodeLinker: hoisted`). That is the single most useful data point in this
whole note: the closest thing to gather's exact stack that Convex publishes did not
trust isolated installs.

**Why this is not a free switch for gather.** `nodeLinker: hoisted` changes the install
strategy for the *entire* workspace, including the web app, and gather's
`pnpm-workspace.yaml` is doing real security work that hoisting interacts with —
`allowBuilds` (pnpm 11 default-denies lifecycle scripts), `minimumReleaseAge: 4320`, and
the `@google/genai` pin. Hoisting does not disable any of those, but it does flatten
`node_modules`, which is precisely the condition `allowBuilds`-style hardening assumes
away, and it makes the web app's undeclared-dependency surface larger.

**Recommended sequence:** try isolated first — SDK 56's on-demand filesystem plus Global
Virtual Store support was built for this case, and SDK 57 has it. Only flip to hoisted
if resolution actually fails, and if it does, record it as its own decision because it
affects the web app too.

Two smaller pnpm-side items to expect on the first `pnpm install` after adding these
deps:

- `minimumReleaseAge: 4320` (3 days) will reject any Expo/Clerk release newer than 3
  days. `npx expo install` picks the SDK-pinned version, which is usually older than
  that, but a same-week patch will fail the install. Either wait, or add a pin to
  `overrides` the way `@google/genai` was handled — **do not** weaken the policy.
- `allowBuilds` may need new entries for native deps that legitimately compile or
  download a binary. Add them one at a time with a comment saying why, matching the
  existing file's style.

### 5.4 Two copies of `convex` — a hazard that turns out not to be one

With `apps/mobile` declaring its own `convex` dependency (it must, for `convex/react`)
and the root declaring `convex@^1.42.3`, an isolated pnpm install produces two symlinks.
If the resolved versions are identical, pnpm points both at the same `.pnpm` store
directory and Metro sees one module. If they drift, the bundle contains two copies of
`convex` — and `api` would be built by one copy while `useQuery` is from the other.

**This is safe.** `getFunctionName` reads the reference through a symbol that
`convex-js` defines as:

```ts
export const functionName = Symbol.for("functionName");
```

([`src/server/functionName.ts`](https://github.com/get-convex/convex-js/blob/main/src/server/functionName.ts))

`Symbol.for` uses the **global symbol registry**, so two independently-loaded copies of
`convex` produce the *same* symbol and function references cross the copy boundary
intact. Duplicate copies cost bundle size, not correctness.

Still: **pin `convex` to the same version in both `package.json`s** and keep them moving
together. Nothing enforces it, and a future Convex change that stops being
version-agnostic would fail in a way nobody would guess at.

### 5.5 TypeScript is the boundary problem Metro isn't

**Expect this to bite before Metro does.** `apps/mobile/tsconfig.json` extends
`expo/tsconfig.base`, whose relevant settings are:

```json
{ "lib": ["DOM", "ESNext"], "moduleResolution": "bundler",
  "customConditions": ["react-native"], "module": "preserve",
  "jsx": "react-jsx", "allowJs": true, "noEmit": true }
```

([`expo@57.0.12/tsconfig.base.json`](https://unpkg.com/expo@57.0.12/tsconfig.base.json))
— note there is **no `types: ["node"]`**.

The moment anything in `apps/mobile` imports `_generated/api`, `tsc --noEmit` pulls
`convex/_generated/api.d.ts` into the program, and that file `import type`s **every
backend module**:

```ts
import type * as activity from "../activity.js";
import type * as babies from "../babies.js";
…50-odd more…
```

Those are `.ts` **source** files, not declaration files, so `skipLibCheck` does not
skip them. The whole Convex backend gets typechecked under Expo's config — a config
whose `lib` is `["DOM","ESNext"]` and which has no Node types, whereas
`convex/tsconfig.json` deliberately declares `"types": ["node"]` and
`"lib": ["ES2021","dom"]`. Backend code touching `process.env` (which
`convex/auth.config.ts` does on line 4, among many others) is the obvious first
failure.

Mitigations, cheapest first — all unverified, all cheap to test:

- Add `@types/node` to `apps/mobile` devDependencies and `"types": ["node"]` to its
  `compilerOptions`. Probably sufficient; also probably what Convex's template gets away
  with implicitly.
- Import only `dataModel`/`api` **types** and keep the value import narrow — does not
  help, the type graph is the problem.
- Under option C (§5.2), give `packages/backend` its own `tsconfig` and have the mobile
  app consume a built `.d.ts` surface rather than source. Correct, and the most work.

**Run `pnpm --filter @gather/mobile typecheck` immediately after the first
`_generated/api` import lands.** This is the cheapest possible early warning and it
directly informs #143.

Related: `expo/tsconfig.base` sets `customConditions: ["react-native"]`, so TS resolves
package `exports` with a `react-native` condition that `convex`'s exports map does not
declare. With `moduleResolution: "bundler"` TS still asserts `import`, which `convex`
does declare, so `convex/react` and `convex/react-clerk` type-resolve fine.

### 5.6 A footnote on git worktrees

This effort is being run from `C:\Users\ericj\orca\workspaces\gather\mobile-app-v1`, a
git worktree. Metro's server root resolution keys off `pnpm-workspace.yaml`, which the
worktree has, so nothing special is required — but each worktree needs its own
`pnpm install` and its own `apps/mobile/.env.local`, and Metro's cache is per-project.
Expo's SDK 56 note about Global Virtual Store support explicitly calls out *"agents
working across multiple Git worktrees"* as the motivating case, which is a good sign for
this setup.

---

## 6. What behaves differently from the web

### 6.1 Handled for you

Reconnection needs no code: *"If the internet connection drops, the client will handle
reconnecting and re-establishing the Convex session automatically"*
([Convex React](https://docs.convex.dev/client/react)). This is the same machinery the
web relies on; a phone just exercises it far more often.

### 6.2 Genuinely different

- **iOS suspends the app.** When gather is backgrounded, iOS freezes timers and tears
  down sockets; on return the Convex client reconnects and re-runs subscriptions. The
  practical effect is a visible gap between foregrounding and fresh data — a state the
  web shell essentially never shows, because a browser tab stays alive. **The shell
  should have an opinion about what renders during that gap**, which is precisely
  #134's open item *"What the app does with no network"*. This note does not close it,
  but it confirms the gap is real and routine rather than exceptional.
- **There is a hook for exactly this.** `useConvexConnectionState()` —
  *"Get the current `ConnectionState` and subscribe to changes... automatically
  rerenders when any part of the connection state changes (e.g., when going
  online/offline, when requests start/complete)"*
  ([Module: react](https://docs.convex.dev/api/modules/react)). `ConnectionState`
  carries `isWebSocketConnected`, `hasEverConnected`, `hasInflightRequests`,
  `timeOfOldestInflightRequest`, `connectionCount`, `connectionRetries`,
  `inflightMutations`, `inflightActions`
  ([Module: browser](https://docs.convex.dev/api/modules/browser)). Convex marks the
  shape as **unstable** — *"ConnectionState may also lose properties in future
  versions"* — so build any offline banner on `isWebSocketConnected` /
  `hasEverConnected` and nothing more exotic.
- **No offline persistence.** Convex's reactive client is a live-socket cache, not a
  local database. A cold start with no network shows nothing. If the phone ever needs
  to be useful offline, that is a separate capability and a separate decision.
- **`unsavedChangesWarning` is dead weight** (§2). RN defines `window` but has no
  `beforeunload`.
- **`useConvexAuth()`, not Clerk's `useAuth()`, decides "is the user signed in"** for
  data-fetching purposes. Clerk's own docs are emphatic: *"It's important to use the
  `useConvexAuth()` hook instead of Clerk's `useAuth()` hook when you need to check
  whether the user is signed in or not"*
  ([Clerk × Convex](https://clerk.com/docs/guides/development/integrations/databases/convex)).
  This is the same rule as the web, but note it interacts with a gather-specific memory:
  route guards on the **web** were deliberately switched to redirect on Clerk's
  `isSignedIn` to avoid a handshake-lag redirect loop. **The phone will hit the same
  three-state lag** (Clerk loaded → Clerk signed in → Convex authenticated), and Expo
  Router's guard shape is different from TanStack Router's `beforeLoad`. Whoever builds
  the entry flow should read that memory first rather than rediscovering the loop.

### 6.3 The Expo-specific bug gather already has the fix for

`src/integrations/convex/provider.tsx`'s comment pins `convex >= 1.42.2` against
[get-convex/convex-js#156](https://github.com/get-convex/convex-js/issues/156) — whose
title is *"ConvexProviderWithClerk on Expo can stay unauthenticated after Clerk session
replacement"*. **That bug was found on Expo.** The web app inherited the fix; the phone
is the platform it was reported from.

The fix is visible in
[`ConvexProviderWithClerk.tsx`](https://github.com/get-convex/convex-js/blob/main/src/react-clerk/ConvexProviderWithClerk.tsx):
the token fetcher is memoized on `[orgId, orgRole, sessionId]` — `sessionId` being the
addition that makes a replaced session rebuild the fetcher. The same file carries a
comment explaining that `getToken` is deliberately **excluded** from the deps because
*"Clerk's Expo `useAuth` hook is not memoized"* — i.e. `getToken`'s identity changes on
every render on Expo, and including it would rebuild the fetcher continuously.

gather's root pins `convex@^1.42.3` and latest is `1.43.0`, so **this is already
satisfied** — provided `apps/mobile` pins the same floor. Add the same comment to the
mobile provider; it is more relevant there than on the web.

---

## Version snapshot (npm registry, 2026-08-12)

| Package | Latest | Notes |
| --- | --- | --- |
| `convex` | **1.43.0** | root pins `^1.42.3`; `>=1.42.2` required (§6.3) |
| `expo` | **57.0.12** | RN 0.86, React 19.2 per the SDK 57 changelog |
| `@clerk/expo` | **4.2.7** | peers: `expo >=54 <58`, `react-native >=0.75`; bundles `@clerk/react@^6.14.1` |
| `@clerk/clerk-expo` | 2.20.0 | **old name** — no `expo` peer declared; do not use |
| `expo-secure-store` | 57.0.1 | Expo SDK module, present in Expo Go |
| `@clerk/clerk-react` (web today) | 5.61.9 | gather pins `^5.61.3` — one Clerk major behind `@clerk/expo@4` |

`apps/mobile` today: `expo ~54.0.35`, `expo-router ~6.0.24`, `react-native 0.81.5`,
`react 19.1.0`, no `metro.config.js`, no Clerk, no Convex. The SDK 57 upgrade
([#134](https://github.com/AppElent/gather/issues/134)) is a prerequisite for
`@clerk/expo@4`'s peer range.

---

## What to do first, in order

1. Upgrade `apps/mobile` to **SDK 57** (already planned) — `@clerk/expo@4` requires it.
2. Add `metro.config.js` as the **two-line default**. Write nothing else in it.
3. `pnpm --filter @gather/mobile add convex @clerk/expo expo-secure-store`, pinning
   `convex` to the root's version.
4. Import `api` by **relative path** (§5.2 option A) in one screen and run
   `pnpm --filter @gather/mobile typecheck`. **This is the cheap experiment that
   decides §5.5 and feeds #143.**
5. Run it on the Android emulator with email/password sign-in. If resolution fails,
   §5.3 (`nodeLinker: hoisted`) is the documented remedy — but record it as a decision,
   because it changes the web app's install too.
6. Only then decide the permanent import shape (§5.2 B or C) in
   [#143](https://github.com/AppElent/gather/issues/143).

## Left open, deliberately

- **Which sign-in method Eric actually uses.** Email/password keeps `eas go` viable;
  OAuth forces a development build for both platforms from day one (§3). Not a
  documentation question.
- **Whether `@clerk/expo@4`'s config plugin is mandatory for the JS-only flow**, or
  only for native features (§3). Ten minutes on the emulator.
- **Whether pnpm will link the workspace root via `workspace:*`** (§5.2 option B). One
  `pnpm install`.
- **Whether isolated pnpm installs work on SDK 57 for this dependency set** (§5.3).
  Convex's own template says they did not trust it; Expo says SDK 54+ supports it.
  Only running it settles it.
- **What the shell renders while the socket is down** (§6.2). Correctly deferred by
  #134 until there is a shell to be offline.
