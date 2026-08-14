# Clerk on Expo: what it requires, and what the mobile app must build itself

Research for [#139](https://github.com/AppElent/gather/issues/139), part of the mobile shell map ([#134](https://github.com/AppElent/gather/issues/134)).

Researched 2026-08-12 against Expo SDK 57 and the current published package versions.
Sources are Clerk's own documentation, Expo's own documentation, and the npm registry
metadata for the packages themselves. Where a Clerk `/articles/` page is cited it is
still first-party, but a `/docs/` page is preferred wherever one says the same thing.

First, `docs/research/` did not exist. The repo keeps `docs/adr/`, `docs/agents/`,
`docs/migrations/`, `docs/review-notes/` and `docs/superpowers/`, none of which is a home
for a research memo, so this file starts a new sibling directory rather than pretending to
be a decision record. Nothing was decided here — this is the evidence a decision gets made
from.

---

## 0. The verdict on `eas go` — read this first

**YES. `eas go` works.** gather's mobile v1 auth can be built entirely inside the Expo Go
runtime, and the map's chosen iOS path does not break.

This holds **conditionally**, and the condition is the one thing that must be honoured for
the rest of the effort:

> **Build the sign-in surface as a Clerk *custom flow* — hooks and screens we write — and
> ship no OAuth / social sign-in, no passkeys, and no biometric unlock in v1.**

That is not a compromise imposed by `eas go`. It is what gather's web app already does.
`socialProviders: []` in `src/routes/__root.tsx`, and every form in `@appelent/auth` is
hand-built on Clerk hooks rather than a prebuilt Clerk component. **The mobile app staying
inside Expo Go costs gather nothing it currently has.**

### The evidence, in four steps

**1. Clerk documents Expo Go compatibility explicitly, per approach.** The Expo quickstart
presents three approaches and states the runtime requirement for each
([Clerk, Expo Quickstart](https://clerk.com/docs/expo/getting-started/quickstart)):

| Approach | Expo Go? | Clerk's words |
| --- | --- | --- |
| Hosted authentication | Yes | "works in Expo Go" |
| **Custom flow** | **Yes** | **"works in Expo Go — no dev build required"** |
| Native components (`<AuthView />`, `<UserButton />`) | No | "cannot run in Expo Go" |

Clerk's own guidance names what survives the Expo Go boundary: "email/password with custom
sign-in forms, basic session management with `useAuth()`, the `Show` component for
conditional rendering, and any JavaScript-only auth flow that doesn't need native modules
or custom URL schemes"
([Clerk, Expo Go or Development Build?](https://clerk.com/articles/expo-go-or-development-build-building-production-ready-authentication-with-clerk)).
That list is, almost exactly, gather's existing web auth.

**2. Every native module Clerk needs for a custom flow is an optional peer dependency.**
From the registry metadata for `@clerk/expo@4.2.7`:

```
peerDependencies: expo >=54 <58, react-native >=0.75, react ^18||^19,
  expo-crypto, expo-constants, expo-web-browser, expo-auth-session,
  expo-secure-store, expo-apple-authentication, expo-local-authentication,
  @clerk/expo-passkeys, @clerk/expo-google-signin

peerDependenciesMeta: ALL of the above except `expo` / `react` / `react-native`
  are marked { optional: true }
```

Two things follow. `expo: '>=54 <58'` means **SDK 57 is inside Clerk's supported range** —
the map's planned upgrade is not a gamble. And the only two peers that are *not* Expo SDK
packages — `@clerk/expo-passkeys` and `@clerk/expo-google-signin`, the genuinely custom
native modules that Expo Go cannot load — are optional and are only pulled in by passkeys
and native Google Sign-In respectively. Neither is needed.

**3. The Expo SDK packages Clerk does use are all bundled into Expo Go.** Verified one at a
time against each package's own SDK 57 API page, which carries a platform-compatibility
line:

| Package | Expo docs platform line | Needed for |
| --- | --- | --- |
| `expo-secure-store` | "Android, iOS, tvOS, **Included in Expo Go**" ([docs](https://docs.expo.dev/versions/latest/sdk/securestore/)) | the token cache — **the one that matters** |
| `expo-web-browser` | "Android, iOS, Web, **Included in Expo Go**" ([docs](https://docs.expo.dev/versions/latest/sdk/webbrowser/)) | OAuth only |
| `expo-local-authentication` | "Android, iOS, **Included in Expo Go**" ([docs](https://docs.expo.dev/versions/latest/sdk/local-authentication/)) | biometrics only |

`expo-secure-store` being in Expo Go is the load-bearing fact of this entire ticket: it is
what lets the session survive a cold start without a development build.

**4. An `eas go` build *is* Expo Go, so it inherits exactly this runtime.** Expo describes
the command as one that "creates your own build of Expo Go that is then uploaded and made
available to you through your Apple Developer account on TestFlight"
([Expo changelog, Expo Go and the App Store, May 2026](https://expo.dev/changelog/expo-go-and-app-store-may-2026)).
It is the same sandbox with the same bundled SDK, signed by you and delivered through your
own TestFlight — not a development build, and not a build of gather. So it grants no extra
native modules, and it takes none away.

SDK 57 is explicitly served by this path: "Expo Go for SDK 57 is available with `eas go`
for iOS devices, and through Expo CLI for Android devices/emulators and iOS simulators"
([Expo changelog, SDK 57](https://expo.dev/changelog/sdk-57) — released 2026-06-30, React
Native 0.86). The App Store copy of Expo Go for SDK 57 was still awaiting Apple approval as
of that changelog, which is precisely why the map chose `eas go`. The Apple Developer
Program membership requirement is confirmed by the same source.

Note for whoever runs it: **`eas go` is not in the EAS CLI command reference**
([docs.expo.dev/eas/cli](https://docs.expo.dev/eas/cli/) lists ~100 commands and does not
include it). It is documented only in the changelogs. Expect to work from those rather than
from a reference page.

### What would break `eas go` later

Written down so a future ticket recognises the moment rather than discovering it on a
failed build. Adopting **any** of these forces the switch to a development build:

- **Social / OAuth sign-in of any kind.** Two independent reasons. `useSSO()` needs a
  registered custom URL scheme to redirect back into, and Clerk states plainly that "Expo
  Go can't register custom URL schemes. When Google's OAuth flow tries to redirect back to
  your app via `myapp://callback`, there's no `myapp://` scheme registered. The redirect
  fails silently or lands nowhere." Native Google/Apple sign-in additionally needs
  `@clerk/expo-google-signin` / `expo-apple-authentication`. **This also means the
  `gather://` scheme already declared in `app.json` is inert under `eas go`** — which bears
  on the deferred deep-link question in #134, not just on auth.
- **Clerk's native components** — `<AuthView />`, `<UserButton />`, `<UserProfileView />`.
  Clerk's install line for them literally includes `expo-dev-client`.
- **Passkeys** (`@clerk/expo-passkeys`) or **biometric unlock**
  (`useLocalCredentials()` — the module is in Expo Go, but Face ID is not: Expo notes
  FaceID is unsupported in Expo Go on iOS, and `expo-secure-store`'s `requireAuthentication`
  option is likewise unsupported there for want of an `NSFaceIDUsageDescription` key).

None of these is in v1's scope. All of them are plausible v2 wants, and each one costs the
same thing: a real development build, i.e. `eas build` per native change instead of a
one-off Expo Go install.

---

## 1. The package set

**The package the ticket names no longer exists under that name.** `@clerk/clerk-expo` is
deprecated; the registry itself says so:

> `@clerk/clerk-expo is deprecated. Migrate to @clerk/expo by following the Core 3 upgrade
> guide https://clerk.com/docs/guides/development/upgrading/upgrade-guides/core-3`

Current versions at time of writing: **`@clerk/expo` 4.2.7** (last `@clerk/clerk-expo` was
2.20.0). The rename is part of Clerk **Core 3**, which also renamed
`@clerk/clerk-react` → `@clerk/react`
([Clerk, Core 3 upgrade guide](https://clerk.com/docs/guides/development/upgrading/upgrade-guides/core-3)).
See §7 — this is a bigger deal than a rename.

For gather's custom flow, Clerk's quickstart gives the install line as:

```sh
npx expo install @clerk/expo expo-secure-store
```

That is the whole set. Two packages.

| Package | Why | In Expo Go |
| --- | --- | --- |
| `@clerk/expo` | The SDK: `ClerkProvider`, hooks, the `token-cache` subpath export | JS only |
| `expo-secure-store` | Backing store for the token cache — iOS Keychain, Android Keystore-encrypted SharedPreferences | Yes |

Not needed, and deliberately not installed: `expo-web-browser`, `expo-auth-session`,
`expo-crypto` (hosted-auth / OAuth only), `expo-dev-client` (native components only),
`@clerk/expo-passkeys`, `@clerk/expo-google-signin`, `expo-apple-authentication`,
`expo-local-authentication`.

Use `npx expo install` rather than `pnpm add` for the Expo packages — it resolves the
version matched to the installed SDK. The pnpm-workspace rule from CLAUDE.md still holds
for everything else.

---

## 2. The token cache

**Clerk ships one. Do not write one.** `@clerk/expo` exports a ready-made cache from a
subpath, and it wraps `expo-secure-store` internally.

```tsx
// apps/mobile/app/_layout.tsx
import { ClerkProvider } from '@clerk/expo'
import { tokenCache } from '@clerk/expo/token-cache'
import { Slot } from 'expo-router'

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!

if (!publishableKey) {
  throw new Error('Add your Clerk Publishable Key to the .env file')
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <Slot />
    </ClerkProvider>
  )
}
```

(Verbatim shape from [Clerk's Expo quickstart](https://clerk.com/docs/expo/getting-started/quickstart);
the env-var guard mirrors what `src/integrations/clerk/provider.tsx` already does on the web.)

**Why it exists at all.** The web has nowhere to make this decision — the browser owns a
cookie jar and Clerk uses it. React Native has no cookie jar and no `localStorage`, so the
session has to be handed somewhere explicitly. That "somewhere" is the `tokenCache` prop.

**What happens if you omit it.** The session lives in memory only, so it dies with the JS
context: **the user is signed out on every cold start.** Clerk's framing of the positive
case is that the cache "persists the session across app restarts — users do not need to
re-authenticate unless the session is explicitly ended." On a phone this is not a minor
annoyance the way it would be on a desktop tab — the OS kills backgrounded apps routinely,
so "cold start" happens many times a day.

Storage details worth knowing, both from Clerk's docs: on **iOS** tokens go to Keychain
Services, which *survives app reinstall* as long as the bundle ID is unchanged; on
**Android** they go to Keystore-encrypted SharedPreferences, which is *deleted on uninstall*.
That asymmetry will look like a bug during the Android-emulator loop if nobody wrote it down.

Also from Clerk's docs, and relevant to the offline question #134 leaves open: session
tokens have a **60-second lifetime** and are refreshed in the background on a **50-second
interval**, so the app never blocks on a refresh. Related Core 3 change: `getToken()` now
throws a `ClerkOfflineError` when offline rather than returning `null`.

---

## 3. Sign-in flows: what is available, and what gather already uses

### What gather's Clerk instance demonstrably has enabled

Inferred from the web app's shipped, working code rather than from the Dashboard (the
publishable key is not readable from this worktree — **the Clerk Dashboard remains the
authority, and someone should confirm there before building**). Decompiling
`@appelent/auth`'s `dist/index.js` shows exactly three strategies in use:

| Flow | Clerk call in `@appelent/auth` | Therefore enabled |
| --- | --- | --- |
| Email + password sign-in | `signIn.create({ identifier, password })` → `setActive({ session })` | password |
| Sign-up + email verification | `signUp.create({ emailAddress, password })` → `prepareEmailAddressVerification({ strategy: 'email_code' })` → `attemptEmailAddressVerification({ code })` | `email_code` |
| Forgot password | `signIn.create({ strategy: 'reset_password_email_code', identifier })` → `attemptFirstFactor(...)` | `reset_password_email_code` |

And `socialProviders: []` in `src/routes/__root.tsx` means **gather ships no OAuth today**,
on any client.

### What that means for native

All three are pure-JS Clerk API calls against Clerk's Frontend API over HTTPS. **All three
work in Expo Go**, and all three have a documented Expo custom-flow equivalent (§7 has the
API shapes). Email/password is not merely *supported* on native — it is the flow Clerk's
own Expo examples lead with.

### On OAuth and redirect URIs — the answer to the ticket's sub-question

Yes, native OAuth would need a redirect URI registered, and it is *not* analogous to
`/integrations/callback`. That one is an HTTPS URL on gather's own origin, handled by a web
route. A native OAuth redirect is a **custom URL scheme** — `gather://...`, built with
`AuthSession.makeRedirectUri()` or `Linking.createURL()`, registered in the **Clerk
Dashboard under Redirect URLs**, and registered *natively* in the app binary via
`app.json`'s `scheme`. Clerk notes that without the Dashboard registration "the OAuth
provider will complete authentication but the session will not be created."

That native registration is exactly what Expo Go cannot do. **So OAuth is not deferred in v1
by preference — it is unavailable on the chosen runtime.** Since gather has no social
providers configured anyway, this costs nothing now; it is simply the first thing that will
force a development build if it is ever wanted.

---

## 4. Sign-out and the account surface

**There is a prebuilt option, and gather cannot use it.** Clerk's native components
— `<AuthView />` (full auth UI), `<UserButton />`, `<UserProfileView />` — are the native
analogue of the web's prebuilt components, but they are Beta, require a development build,
and Clerk states they "cannot run in Expo Go."

So: **hooks and screens we write.** Which is the same posture the web already takes —
`@appelent/auth` builds every form by hand on `useSignIn` / `useSignUp` / `useUser` /
`useClerk` rather than using Clerk's `<SignIn />`. The mobile app is not adopting a worse
pattern; it is adopting the *same* pattern without the shared component library.

Sign-out is three lines, straight from Clerk's Expo docs:

```tsx
import { useClerk } from '@clerk/expo'
import { useRouter } from 'expo-router'

export const SignOutButton = () => {
  const { signOut } = useClerk()
  const router = useRouter()
  return <Pressable onPress={async () => { await signOut(); router.replace('/') }}>…</Pressable>
}
```

Available for the account/profile surface, all JS-only and all Expo-Go-safe: `useUser()`
(and `user.update()`, `user.updatePassword()` — the two mutations `ProfilePanel` actually
performs), `useAuth()`, `useClerk()`, `useSession()`, plus the control components `<Show>`,
`<ClerkLoaded>`, `<ClerkLoading>`. `<Show>` is the native replacement for the web's
`<SignedIn>` / `<SignedOut>`.

---

## 5. What the mobile app must build outright

This is the cost the ticket exists to establish. `@appelent/auth` is
`peerDependencies: { react-dom }`, ships a single React-DOM ESM bundle, and styles itself
with Tailwind classes and CSS custom properties. **Nothing in it crosses to native — not one
component, not one hook, not the theme script.**

Its full export surface, from `dist/index.d.ts`:
`AppearanceSettings`, `AuthButton`, `AuthCard`, `AuthConfig`, `AuthConfigProvider`,
`AuthError`, `AuthField`, `DEFAULT_AUTH_CONFIG`, `ForgotPasswordForm`, `HeaderUser`,
`ProfilePanel`, `SignInForm`, `SignUpForm`, `THEME_INIT_SCRIPT`, `TestLoginButton`,
`ThemeSync`, `applyThemeMode`, `clerkErrorMessage`, `getInitialMode`, `reconcileTheme`,
`setThemeMode`, `shouldShowTestLogin`, `useAuthConfig`.

Mapped to what mobile owns:

### Screens to build

| Web today | Mobile must build | Notes |
| --- | --- | --- |
| `/sign-in` → `<SignInForm>` | **Sign-in screen** | email + password, `signIn.password()` |
| `/sign-up` → `<SignUpForm>` | **Sign-up screen** + **verification-code screen** | two states, not two routes on the web either |
| `/forgot-password` → `<ForgotPasswordForm>` | **Forgot-password flow: 3 steps** | send code → verify code → set new password. The web's is 2 steps; Core 3 splits verify from submit (§7) |
| `/account` → `<ProfilePanel>` | **Account screen** | name edit, password change, sign-out. Also renders the primary email |
| `HeaderUser` in `Topbar` | **Whatever the native shell's identity affordance is** | Do *not* port a dropdown menu. This is a navigation-shape question for the shell prototype, not an auth question |
| — | **Signed-out welcome screen** | #134 settles that this exists; the web has no equivalent (it redirects) |
| — | **Auth route guard / loading gate** | `<ClerkLoading>` + `<Show>` in `_layout.tsx`. See the memory note: guard on Clerk's `isSignedIn`, **not** Convex's `isAuthenticated`, or you get a redirect loop |

### Non-screen pieces to rebuild

- **Form primitives** — `AuthField`, `AuthButton`, `AuthError`, `AuthCard` are `<input>`,
  `<button>`, `<div>`. Native needs `TextInput` / `Pressable` / `View` equivalents. Small,
  but four of them, and they set the app's whole input feel.
- **`clerkErrorMessage()`** — pure logic, ~10 lines, trivially portable. Core 3 changes the
  error *shape* though (`errors.fields.identifier.message` rather than a thrown error), so
  it is a rewrite not a copy.
- **`ThemeSync` / `applyThemeMode` / `THEME_INIT_SCRIPT`** — `THEME_INIT_SCRIPT` is an
  inline `<script>` touching `document.documentElement` and `localStorage`; it is
  meaningless on native and there is no FOUC to prevent. But **`reconcileTheme()` is pure
  and the concept survives**: theme lives in Clerk `unsafeMetadata.theme`, so the phone must
  read and write the same key or the two clients will fight. That is a real cross-client
  contract, and it is the one piece of `@appelent/auth` whose *behaviour* must be
  reproduced faithfully even though none of its *code* can be.
- **`AuthConfigProvider` / `useAuthConfig`** — path-based config (`signIn: '/sign-in'`, …)
  for a router that does not exist on native. Expo Router has its own paths. Probably drop
  it rather than port it.

### What does *not* need rebuilding

`useAuth`, `useUser`, `useSignIn`, `useSignUp`, `useClerk`, `useSession` — same names, same
concepts, exported by `@clerk/expo`. And `ConvexProviderWithClerk` from `convex/react-clerk`
is the same integration the web uses in `src/integrations/convex/provider.tsx`; it takes
`useAuth` as a prop, so passing `@clerk/expo`'s `useAuth` instead of `@clerk/clerk-react`'s
is the whole change. (Convex wiring is #140's ticket — flagged here only because it
constrains which Clerk package the provider imports from.)

---

## 6. The dev-login shortcut

**Yes, worth having, and it ports cleanly in concept.** Typing a password on an Android
emulator's soft keyboard many times a day is exactly the misery the web button was built to
avoid.

The web's mechanism, from `@appelent/auth`'s `shouldShowTestLogin`:

> "Show the dev test-login button only on a Clerk *test* instance with the test-user
> credentials provided via env. Both conditions must hold, so the button can never appear in
> production (`pk_live_` + no creds in the bundle)."

i.e. `VITE_CLERK_PUBLISHABLE_KEY.startsWith('pk_test')` **and** both
`VITE_TEST_USER_EMAIL` / `VITE_TEST_USER_PASSWORD` present; the handler then calls
`signIn.create({ identifier, password })` with them.

The native equivalent swaps the env prefix. Expo inlines `EXPO_PUBLIC_*` variables from
`.env` files into the bundle at build time, read as `process.env.EXPO_PUBLIC_…`
([Expo, Environment variables](https://docs.expo.dev/guides/environment-variables/)):

```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_…
EXPO_PUBLIC_TEST_USER_EMAIL=…
EXPO_PUBLIC_TEST_USER_PASSWORD=…
```

**The security property is identical to the web's, and so is the trap.** Expo's warning is
blunt: *"Do not store sensitive info, such as private keys, in `EXPO_PUBLIC_` variables.
These variables will be visible in plain-text in your compiled application."* That is the
same reason `shouldShowTestLogin` gates on `pk_test` — the credentials are in the bundle
either way, so the only real defence is that they belong to a throwaway user on a test
instance. **Reuse the same two-condition gate; do not weaken it to a `__DEV__` check**,
because `__DEV__` is false in an `eas go`-delivered bundle while the env values would still
be baked in.

`.env.local` in `apps/mobile` must be gitignored — Expo's docs call this out, and the global
security rules in `CLAUDE.md` make it non-negotiable.

One nicety the web cannot have: on native you can also prefill the `TextInput`s rather than
auto-submitting, which keeps the flow honest while still skipping the keyboard.

---

## 7. The finding nobody asked for: the web and the phone are on different Clerk API generations

This is the largest hidden cost in the ticket and it is not in any of the six questions.

- gather's web app: **`@clerk/clerk-react` ^5.61.3** — Clerk **Core 2**.
- `@clerk/expo` 4.2.7 depends on **`@clerk/react` ^6.14.1** — Clerk **Core 3**.

Core 3 did not just rename packages. It reshaped the custom-flow API. Compare what
`@appelent/auth` does today with what Clerk's current Expo docs show:

| | Web today (Core 2) | Expo (Core 3) |
| --- | --- | --- |
| Hook result | `const { isLoaded, signIn, setActive } = useSignIn()` | `const { signIn, errors, fetchStatus } = useSignIn()` |
| Sign in | `signIn.create({ identifier, password })` | `signIn.password({ emailAddress, password })` |
| Errors | thrown, caught in `try/catch` | returned as `{ error }`; field errors on `errors.fields.*` |
| Loading | `isLoaded` | `fetchStatus === 'fetching'` |
| Completing | `setActive({ session: result.createdSessionId })` | `signIn.finalize({ navigate })` |
| Sign-up verify | `prepareEmailAddressVerification({ strategy: 'email_code' })` then `attemptEmailAddressVerification({ code })` | `signUp.verifications.sendEmailCode()` then `signUp.verifications.verifyEmailCode({ code })` |
| Password reset | `signIn.create({ strategy: 'reset_password_email_code' })` + `attemptFirstFactor` | `signIn.create({ identifier })` then `signIn.resetPasswordEmailCode.sendCode()` / `.verifyCode()` / `.submitPassword()` |

(Expo shapes taken from Clerk's `clerk-docs` partials for Expo email/password sign-in,
sign-up, sign-out and the forgot-password custom flow.)

Three consequences worth carrying into the build tickets:

1. **`@appelent/auth`'s form logic is not a reference implementation for the phone.** It
   reads like one — same hook names, same concepts — which makes it a trap. Copying its
   control flow and renaming the calls will produce code that does not compile and, worse,
   code that half-compiles.
2. **`signIn.finalize({ navigate })` expects a router.** Clerk's examples branch on
   `url.startsWith('http')` and otherwise call Expo Router's `router.push()`. Fine, but it
   couples the auth screens to Expo Router in a way the web's `setActive` did not.
3. **New statuses exist.** `needs_client_trust` (Device Trust) sits alongside
   `needs_second_factor`; Clerk's Core 3 guide says to check for it before treating a
   sign-in as complete. gather has neither enabled, so the correct v1 handling is an
   explicit "not handled" branch rather than silence.

**This is a fork in the road that deserves its own decision**, and it is not #139's to make:
either the mobile app is knowingly a Clerk-generation ahead of the web, or the web upgrades
to Core 3 (`@clerk/clerk-react` → `@clerk/react`) — which also means `@appelent/auth` itself
upgrades, and that package is shared with other Appelent apps. Recommend filing it.

---

## Open questions this research could not close

- **Which strategies gather's Clerk instance actually has enabled**, as opposed to which the
  web app exercises. `.env.local` is outside this worktree's read permissions, so the
  Frontend API environment endpoint could not be queried. Confirm in the Clerk Dashboard.
  The three in §3 are certain (shipped code depends on them); anything *else* being on is
  unknown.
- **Whether `eas go` has non-changelog documentation.** It is absent from the EAS CLI
  reference. Someone should run `eas go --help` on first use and record the real flags.
- **Whether the Core 2 / Core 3 split is accepted or closed** (§7).
