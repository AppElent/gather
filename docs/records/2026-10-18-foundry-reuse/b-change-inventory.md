---
type: record
kind: research
description: Read when deciding which foundry (workouts) changes gather should reuse; inventory as of 2026-10-18.
version: 1.0.0
date: 2026-10-18
---

# B — Foundry change inventory and what gather can reuse

Read-only research, 2026-10-18. Foundry = `/Users/ericjansen/Developer/workouts`
(`AppElent/workouts`, main at `9ee4d38`). Gather = this worktree, branch
`t3/foundry-onboarding-research` (base `1284b3f`).

Foundry has **301 commits since 2026-08-01** (not ~296), but most are nutrition/training
feature work and merge commits. Gather also has 309 commits in the same window, so this
is a divergence, not a gap: each repo has things the other lacks.

Verdicts: **PORT-CODE** (near copy), **ADOPT-PATTERN** (re-implement for gather's shape),
**ALREADY-HAVE** (says which is better), **SKIP**. Effort S/M/L. Risk L/M/H.

## 0. Three findings that change how to reuse anything

1. **Foundry's `docs/standards/*` is a synced copy of `AppElent/developer-tools`**
   (`~/Developer/developer-tools`, `distribution.json`, `standards/`). The canonical
   source for query caching, mobile baseline, Sentry, auth, previews, environments and
   workspaces is there, not in foundry. For those, sync from developer-tools (via the
   `developer-tools` skill) rather than copying from foundry. Foundry's
   `appelent.json` is baseline v6 (steps 6,14,15,16) with `cli` and `mcp`. Gather is
   baseline v5 (steps 6,9,14,15) with `guidance`.
2. **All Appelent apps share one Clerk application** (`docs/runbooks/social-sign-in.md`
   in foundry). Google, Microsoft and Apple provider credentials, the Apple Services ID
   (`nl.appelent.web`) and the consent branding already exist instance-wide. Gather only
   needs the per-app entries: its iOS bundle ID `com.appelent.gather` grouped under the
   primary App ID `com.appelent.foundry`, plus the `gather://sso-callback` redirect under
   Clerk → Native applications. That makes social sign-in much cheaper than it looks.
3. **Foundry dropped the `@appelent/*` packages on 2026-10-13** (`5d4072b`). It copied
   auth, i18n and cli runtime code into `src/lib/auth`, `src/lib/i18n/runtime` and
   `cli/runtime`, and removed `.npmrc`, the CI registry-auth steps and the EAS
   pre-install hook. Gather still depends on `@appelent/auth ^0.1.0`, `@appelent/i18n
   ^0.1.0` and `@appelent/dev 0.2.0` (the registry now has 0.3.0 / 0.3.0 / 0.4.0).
   That is a decision for gather (vendor, as foundry did, or bump), not a free port.
   See 1.5.

## 1. Auth & account

| # | Item | Foundry evidence | Gather today | Verdict | Effort / risk |
|---|---|---|---|---|---|
| 1.1 | Social sign-in on mobile (Apple native sheet on iOS, Google/Microsoft via browser SSO) | `c034986`, `ed237a4` (PR #115). `apps/mobile/src/auth/useSocialSignIn.ts`, `social-buttons.tsx`, `clerkErrors.ts`; `app.json` `usesAppleSignIn` plus `expo-apple-authentication`, `expo-crypto`, `expo-auth-session` | None. `apps/mobile/src/components/SocialSoon.tsx` is a placeholder on sign-in | **PORT-CODE**: hook and buttons are about 130 lines and Clerk-Core-3 like gather's `usePasswordSignIn`. Swap scheme to `gather://sso-callback`, bundle ID, and i18n keys | M. Needs a **native build** (new fingerprint, no OTA, ADR 0029) plus Clerk Native applications entries on dev and prod. Risk M: Apple App Review 4.8 and the Android Apple flow |
| 1.2 | Social sign-in on web, `/sso-callback` route | `c034986`: `src/lib/auth/components/auth/SocialButtons.tsx`, `src/routes/sso-callback.tsx`, `AuthConfig.socialProviders` | `@appelent/auth` 0.1.0 has no social buttons | **ADOPT-PATTERN**: depends on 1.5 (vendor vs bump `@appelent/auth`; check whether 0.3.0 has social support) | M, risk L |
| 1.3 | Email sign-in code (passwordless), web and mobile | `9afc8c2`, `ed237a4`. `useEmailCodeSignIn.ts` (+test), `app/(auth)/sign-in-code.tsx`; needs "Email verification code" enabled in Clerk | None (gather has password sign-in, sign-up, verify-email, and `reset/*` for password reset) | **PORT-CODE** for mobile; web follows 1.2 | S–M, risk L. Clerk setting is instance-wide and foundry says it is already on for both instances |
| 1.4 | Hide Google outside dev (prod lacks Google credentials) | `9afc8c2`: `SOCIAL_PROVIDERS` gated on `__DEV__`, `import.meta.env.DEV` | n/a | **ADOPT-PATTERN**: copy the gate, drop it when prod Google exists | S, risk L |
| 1.5 | Vendoring `@appelent/auth|i18n|cli` and removing the private registry | `5d4072b` (`src/lib/auth`, `src/lib/i18n/runtime`, deleted `.npmrc`, `eas-build-pre-install.mjs`, `NODE_AUTH_TOKEN` from manifest and CI) | Registry wiring everywhere: `.npmrc`, `ci.yml`/`preview.yml`/`deploy.yml` auth steps, `.claude/hooks/session-start.mjs` token append, `apps/mobile/package.json` `eas-build-pre-install`, `verifyDepsBeforeRun: false` in `pnpm-workspace.yaml` (retire condition stated there) | **ADOPT-PATTERN**, decision needed. Gain: removes the token dependency from CI, EAS and agent sessions, and lets gather fix package bugs (e.g. "ArchStudio" copy in `AppearanceSettings`). Cost: gather's web uses `@appelent/auth` more (ProfilePanel, AppearanceSettings, theme sync, Topbar) and then owns the code | M, risk M |
| 1.6 | Convex-authenticated gate before the signed-in tree | `b05a36c`: `convex-session-gate.tsx` (+test). Redirect follows Clerk `isSignedIn`; data follows Convex `isAuthenticated` | **Partly.** `GroupProvider.tsx:116` skips `myGroups` until `useConvexAuth().isAuthenticated`; `useEnsureUser.ts` also keys on it; root `_layout.tsx` has a splash/Clerk timeout gate. But the other ~50 `useQuery` call sites under `(app)` are not gated | **ADOPT-PATTERN**: one wrapper below the redirect in `(app)/_layout.tsx` is cheaper than auditing every query. Check first whether `GroupProvider` already blocks the tree (its `pending` slot may be enough) | S, risk L |
| 1.7 | Account details: edit name and photo, read-only email and sign-in methods | `c4cf76d` `account-screen.tsx` | **ALREADY-HAVE**: `settings/account/{index,name,email,password,devices,delete}.tsx` is broader (email, password, devices) | ALREADY-HAVE (gather better) | – |
| 1.8 | Account deletion (Convex first, Clerk second) | `c4cf76d`, `convex/account.ts`, `convex/lib/personalData.ts` | **ALREADY-HAVE, better**: `convex/accounts.ts` + `cascade.ts`, `lib/groupCascade.ts` (schema-derived registry that fails typecheck when forgotten), ADR 0032, solo-vs-shared Group rule, `deleteSelfEnabled` guard, `users.deletedAt` anti-reprovision. Foundry hand-lists a `sources` table map in `personalData.ts` | ALREADY-HAVE. Flows the other way, see section 7 | – |
| 1.9 | Revoke Sign in with Apple on account deletion | `9ee4d38` (PR #126): `convex/lib/appleSignIn.ts`, `convex/appleSignIn.test.ts`, `apps/mobile/src/features/profile/apple-revocation.ts`, 3 env keys via `env.manifest.ts` | None. **Required by Apple (TN3194) the moment gather ships Sign in with Apple (1.1)** | **PORT-CODE** together with 1.1. `appleSignIn.ts` is app-agnostic except `APPLE_CLIENT_ID`. Reuse the same Apple team and key from Infisical | M, risk M. Cannot be verified without a real Apple-linked account on a device |
| 1.10 | Data export (JSON of every personal table, shared via system sheet) | `c4cf76d`: `convex/exportData.ts`, `account-export.ts` (expo-sharing) | **None.** Gather's deletion registry has no export twin | **ADOPT-PATTERN**: derive the export set from `groupCascade.ts` so it cannot be forgotten, same trick as deletion. Scope is Groups rather than a user id, and export must skip other members' private rows | M–L, risk M (privacy review) |
| 1.11 | Privacy statement route, linked from Account; names Anthropic, Apple and Microsoft as processors | `9bf7523`, `7b202e2`: `src/routes/privacy.tsx`, `src/lib/i18n/messages/{en,nl}/privacy.ts` | None found (no `privacy` route; only `about.tsx`) | **ADOPT-PATTERN**: gather needs its own text (Groups, photos, Notion/Todoist OAuth, recipe-import AI). Store listings require a URL | S, risk L |
| 1.12 | Translated web auth pages | `c05f5fe` (`src/lib/i18n/messages/{en,nl}/auth.ts`) | Gather translates the shell. Web auth page copy is inside `@appelent/auth` | follows 1.5 | S once vendored |
| 1.13 | Clerk throwaway user script for destructive-flow testing | `4f1b37a`, `190f05f`: `scripts/clerk-test-user.mjs` | None. Account deletion tests on a device would use the shared test user | **PORT-CODE** (about 80 lines; reads Clerk key from env or `apps/mobile/.env.local`). Dev Clerk only, shared instance | S, risk L |

## 2. Mobile infra

| # | Item | Foundry evidence | Gather today | Verdict | Effort / risk |
|---|---|---|---|---|---|
| 2.1 | Expo SDK 58 upgrade | `519522c` (PR #122). RN `0.88.0-rc.4`, React 19.3, Reanimated 4.7, Worklets 0.13, Gesture Handler 3, Screens 4.29, `@expo/ui` 58. Source migrations: replace deep `build/react-navigation` imports, `unstable_settings.anchor`, RN strict TS refs (`TextInputInstance`, …), drop SDK 57 `enableSceneSupport`, `@expo/ui` 58 passes unset HStack/VStack spacing as `nil` (follow-up commit in the same PR). Foundry's earlier `#120` (57.0.28 patch set) was closed in favour of 58 | SDK **57.0.24**, RN 0.86.3, React 19.2.3 | **ADOPT-PATTERN**, wait. Follow foundry's migration notes, not its versions. Foundry is on an RN **release candidate** because 58.0.9 was the newest patch inside the 3-day cooldown (58.0.11+ pins RN 0.88.0 final). Gather has the same cooldown and a bigger native surface (`expo-share-intent` 8.0.1 for the Drop; no SDK 58 evidence found) | L, risk H. Native rebuild, fingerprint change, `expo-share-intent` compat unknown. Gather's `enableSceneSupport: true` build property goes away on 58 |
| 2.2 | Jest + jest-expo + RNTL 14 + Reanimated resolver, `testRouter`, render helpers | `jest.config.js` (pnpm-aware `transformIgnorePatterns`), `jest.setup.ts`, `src/test-support/render-screen.tsx`, `4f1b37a` | No mobile Jest. Mobile tests are pure TS under Vitest (`vitest.config.ts` `mobile` project, `apps/mobile/src/**/*.test.ts`) | **ADOPT-PATTERN**, optional. Worth it only if gather wants component or router tests. Foundry's comment explains why not Vitest (Flow transforms, `expo-router/testing-library` is Jest-only) | M, risk M. Extra runner plus an upgrade tax each SDK |
| 2.3 | CI runs mobile typecheck and tests | `ci.yml`: `pnpm --filter @foundry/mobile typecheck`, `test` | `ci.yml` runs root `check`, `env:check`, `typecheck`, `test`, `build`. Root `tsc` and Vitest may not cover `apps/mobile` (foundry had exactly this gap until #69) | **ADOPT-PATTERN**: confirm `apps/mobile` is typechecked in CI (`pnpm --filter @gather/mobile typecheck` exists, but is not in CI) | S, risk L |
| 2.4 | `run-mobile` skill and `driver.sh` (per-checkout simulator, own Metro port, agent-device wrapper) | `apps/mobile/.claude/skills/run-mobile/{SKILL.md,driver.sh}`; `5434f98`, `4f1b37a`, `190f05f`, `db755eb`, `66519f3` (down kills only the Metro it started; no hang on `up \| tail`; fail fast on Metro config error; `--debug-queries`; `signin --email --password` guard) | None. CLAUDE.md only says "use agent-device"; the global `~/.agents/bin/sim` claim tool exists | **ADOPT-PATTERN**. Foundry's driver is **iOS-simulator only** (`com.appelent.foundry`, iPhone sim). Gather's documented device is Android `Pixel_9_Pro` / `com.appelent.gather` / `gather://`. Reuse the structure and gotchas (cwd-keyed agent-device sessions, `npx agent-device@<pin>` because the T3 wrapper needs an MCP session, language forcing, per-checkout Metro port, dev-menu URL flags `disableOnboarding=1&disableFab=1&disableAutoLaunch=1`). Rewrite the Android half with `adb`/`emulator` | M, risk L |
| 2.5 | Shared dev-client workflow and Device Hub | `d7bd5f8`, `ff15cbc`, `1284b3f`; Device Hub as standard on SDK 57+ | **ALREADY-HAVE**: `expo-device-hub ^0.13.0`, `node-datachannel: true` in `allowBuilds`, `1284b3f`. Gather lists Device Hub under `dependencies`; foundry and the baseline standard put it in `devDependencies` | ALREADY-HAVE. Move to devDependencies | S, risk L |
| 2.6 | EAS config | `eas.json` (preview-internal, `submit.*.ios.ascAppId`), `7b202e2` ("submit production iOS builds to the existing App Store Connect app", version 1.0.0), `deaeb5e` (EAS profile to Clerk instance mapping documented) | Same profile layout. `submit.*.ios` is empty `{}` and has no `ascAppId`. Gather has `SHARP_IGNORE_GLOBAL_LIBVIPS` env per profile; foundry has none | **ADOPT-PATTERN**: set `ascAppId` once the App Store Connect app exists. Document which EAS profile points at which Clerk instance and Convex deployment (foundry learned the hard way that `preview` pointed at the live backend) | S, risk L |
| 2.7 | pnpm workspace hardening for EAS | `pnpm-workspace.yaml`: `supportedArchitectures` (win32/darwin/current × x64/arm64), `packageExtensions` giving `@clerk/expo` its undeclared `@expo/config-plugins`, `patchedDependencies` | Has `virtualStoreDirMaxLength: 60` (same reasoning, better documented), `verifyDepsBeforeRun: false`, `minimumReleaseAge`. Lacks `supportedArchitectures` and the Clerk `packageExtensions` | **ADOPT-PATTERN**, on demand. Add the Clerk extension if EAS fails to load `@clerk/expo`'s config plugin after a bump (affects 4.10.x). `supportedArchitectures` only if sharp or lightningcss binaries go missing on the EAS Mac builder | S, risk L |
| 2.8 | OTA update publish with source maps | `apps/mobile/scripts/publish-update.mjs` (`eas update` then `sentry-expo-upload-sourcemaps dist`, refuses without `SENTRY_AUTH_TOKEN`); `update:publish`, `preview:ios:update` scripts | **ALREADY-HAVE the safe part**: `update:preview`/`update:prod` always pass `--environment` (CLAUDE.md, ADR 0029; better documented). No Sentry on mobile, so no maps step | follows 3.3 (Sentry). The wrapper is the only thing to take | S |
| 2.9 | Permission tightening | `c0277a4`: removed unused `expo-audio`/`expo-media-library`; `android.blockedPermissions` (RECORD_AUDIO, READ/WRITE_EXTERNAL_STORAGE, READ_MEDIA_*); `microphonePermission: false`; `faceIDPermission: false`; usage strings rewritten to what the app does | `app.json` has no `blockedPermissions`; `expo-image-picker` usage strings exist; `expo-secure-store` has Face ID default | **PORT-CODE** the pattern (about 20 lines of `app.json`). Verify against gather's real needs: `expo-share-intent` and image picker may legitimately need photo access | S, risk L. Native config change, so it needs a build and moves the fingerprint |
| 2.10 | Mobile architecture check script | `scripts/check-mobile-architecture.mjs` (+test): feature/ui import boundaries, no `*-copy.ts`, no JSX text literals, no locale branches that choose text | Gather relies on typed `satisfies` message trees and docs. CLAUDE.md admits several registries "fail silently" | **ADOPT-PATTERN**: the "literal text in JSX props/children" check suits gather's "any new string goes in the message tree" rule. Boundary rules are foundry's layout, so skip those | M, risk L |
| 2.11 | Sentry on mobile (RN SDK 8 Expo integration, shake-to-report feedback, privacy scrub) | `504e46f`, `41c3acc`, `9f93e30` (PR #92), `e4d90fe` (feedback reports bypass `beforeSend`, so redact separately). `observability/{privacy,convex,errors}.ts`, `feedback/sentry.ts`, `docs/standards/sentry-monitoring*` | **None on mobile.** Web has `@sentry/tanstackstart-react` 10.64 | **ADOPT-PATTERN** from the developer-tools Sentry standard. Foundry's `privacy.ts` scrub (Bearer/JWT/email/query-param redaction, drop console breadcrumbs, drop `extra`) is reusable verbatim. Gather's household data is more sensitive than workouts; scrub rules need Group names, recipe text, notes, finance values | L, risk M. Native dep (new build); decide sampling and replay masking |
| 2.12 | Release readiness: icons, app version, store submission | `7ae6f77`, `7b202e2`, `docs/runbooks/mobile-releases.md`, `ios-acceptance.md` | Gather has `deploy:preview`/`deploy:prod` scripts, ADR 0029, mobile README | **SKIP** copying. Use foundry's runbook as a checklist when gather nears first submission | – |
| 2.13 | Update-fingerprint evidence (virtual-store path length) | foundry `pnpm-workspace.yaml` comment | **ALREADY-HAVE, better**: gather's comment names ADR 0029 and the 311 of 316 fingerprint sources | ALREADY-HAVE | – |

## 3. Data, caching and Convex patterns

| # | Item | Foundry evidence | Gather today | Verdict | Effort / risk |
|---|---|---|---|---|---|
| 3.1 | Query subscription retention (5 min, max 20 idle) | `ee3287c` (PR #113), `57da096`; `apps/mobile/src/convex/query-cache.tsx`; `convex-helpers` 0.1.120 plus `patches/convex-helpers@0.1.120.patch` (provider `dispose()`, `globalThis.setTimeout`); Biome `noRestrictedImports` banning `useQuery`/`useQueries`/`usePaginatedQuery` from `convex/react`; AppState-aware (0 retention in background); provider keyed by account `scope`; `apps/mobile/scripts/measure-query-cache.mjs`; record `docs/records/2026-10-08-query-subscription-cache` | None. Gather imports `convex/react` directly in 51 mobile files. Gather's `useEnsureUser`/`GroupProvider` use `useConvexAuth` | **PORT-CODE** the provider (~60 lines) and the Biome rule, but take the **canonical text from developer-tools `standards/convex-query-caching.md` v1.2.2**, which is newer than foundry's implementation (its git log adds a sign-out guard, account-identity binding and "preserve cache during auth restoration" after foundry's `ee3287c`). Foundry itself has no copy of that standard file (its Biome message points at a missing `docs/standards/convex-query-caching.md`), so diff `query-cache.tsx` against the standard's examples before porting. Gather-specific: key the provider by `{userId, groupId}` (ambient Group, ADR 0031), because query args already carry `groupId` but a Group switch should still release subscriptions. Paginated queries pass through unretained (page ids change per mount) | M, risk M. Keep the patched `convex-helpers`; recheck on each helper bump. Needs no native rebuild (JS only, OTA-able) |
| 3.2 | Query logging for diagnosis | `db755eb`: `observability/convex.ts` (`EXPO_PUBLIC_DEBUG_QUERIES=1` logs `[convex-query] +/- name`) | None | **ADOPT-PATTERN**, small, alongside 3.1 | S, risk L |
| 3.3 | Account-owned personal-table registry reused by export, reset and delete | `convex/lib/personalData.ts` | **Better**: `groupCascade.ts` | see 1.8, 1.10 | – |
| 3.4 | AI action behind a provider seam, with a per-account daily limit and consent | `7b25491`: `convex/nutritionAi.ts` (`DAILY_ANALYSES = 50`), `nutritionAiUsage` table, `lib/nutritionAi.ts`, `nutrition-ai-consent.tsx`; Anthropic Haiku 5.5; key as Convex-only secret in `env.manifest.ts` | `recipeImport.ts` has an AI fallback with **no usage cap** (grep for `usage|limit|quota` found nothing) and no in-app consent | **ADOPT-PATTERN**: daily per-user (or per-Group) counter plus a one-time consent sheet for the recipe-import and any future label/photo scanning. Do not copy the prompt/grounding code | S–M, risk L |
| 3.5 | Online-first account data and cache retirement | `09b8c1c` (#89), ADR 0014/0015, `docs/records/2026-10-07-online-offline-research.md` | Gather has `AvailabilityProvider`, `ConnectionLostBanner`, `docs/research/mobile-convex-react-native.md` | **SKIP**. Foundry's offline decision is nutrition-specific. Re-read its research note when deciding gather's offline stance | – |
| 3.6 | Convex dependency | foundry `convex ^1.46.0` (resolved 1.46.0), `convex-test ^0.0.61` | `convex ^1.42.3` (resolved 1.42.3), `convex-test ^0.0.54`. `convex-helpers 0.1.120` is compatible with 1.42.1+, so 3.1 does **not** require a Convex bump | **ADOPT-PATTERN**: bump when convenient. foundry regenerated `convex/_generated` for the installed CLI (`4f1b37a`) | S, risk L |
| 3.7 | Sign in with Apple secret signing in Convex (ES256 JWT with WebCrypto) | `convex/lib/appleSignIn.ts` | n/a | see 1.9 | – |

## 4. Web infra

| # | Item | Foundry evidence | Gather today | Verdict | Effort / risk |
|---|---|---|---|---|---|
| 4.1 | Dependency refresh, pinned caret ranges | `5d4072b`: TanStack Start 1.168.61 / Router 1.170.42, Vite 8.3.4, Wrangler 4.149, React 19.3, Biome 2.5.15, Sentry 11.6, zod 4.6.5; dropped unused react-query packages | Many `@tanstack/*` and `@tanstack/ai-*` deps are `"latest"` (resolved: Start 1.168.59, Router 1.170.40). Vite 8.1.3, Wrangler 4.107.1, React 19.2.7 (web) / 19.2.3 (mobile), Biome 2.4.5. Still uses `@tanstack/react-query` + `@convex-dev/react-query` | **ADOPT-PATTERN**: replace `"latest"` with caret ranges so the lockfile is not the only pin. Run `/upgrade-deps`. Check whether gather really uses react-query (`@tanstack/react-router-ssr-query`, `@convex-dev/react-query` are imported) before dropping it | M, risk M |
| 4.2 | Web Sentry: browser, Worker (`@sentry/cloudflare`), SSR 5xx fallback, Convex failure log forwarder | `9f93e30`: `src/instrument.client.ts`, `src/server.ts`, `src/lib/observability/*`, `scripts/convex-sentry*.mjs` | Gather uses `@sentry/tanstackstart-react` 10.64 via `instrument.server.mjs` (Node-style start script) | **SKIP** switching stacks. Borrow `privacy.ts` and the Convex forwarder idea only | S |
| 4.3 | Report-a-problem on web Account | `src/components/account/ReportProblem.tsx` (+test) | None | **ADOPT-PATTERN**, with 2.11 | S |
| 4.4 | `build:development` targets the dev Cloudflare env | `0c80a38`: `CLOUDFLARE_ENV=dev vite build --mode development` | Gather's `build:development` has no `CLOUDFLARE_ENV` | **ADOPT-PATTERN**: check `wrangler.jsonc` dev env block really gets the dev build. One-liner | S, risk L |
| 4.5 | Preview workflow improvements | `8590011`, `28b6246` (build core before provisioning previews); foundry `preview.yml` is 167 lines smaller after dropping registry steps | Gather's `preview.yml` already path-filters web vs mobile changes (smarter). Both build `@*/core` | **ALREADY-HAVE** (gather better on path filtering). Port only "build core before provisioning" if gather's preview ever fails on it | – |
| 4.6 | CI on push to main | foundry `ci.yml` runs on push to main and PR | Gather's `ci.yml` runs on PR only and relies on `deploy.yml` for main | **ALREADY-HAVE**. Deliberate, documented | – |
| 4.7 | PWA service worker / icons | `scripts/generate-sw.mjs`, `7ae6f77` (app icons) | Same script plus `generate-icons.mjs` | **ALREADY-HAVE** | – |
| 4.8 | Web UI baseline hygiene (toasts, `useConfirm`, skeletons, empty and error states) | PR #39 (older, July) | not checked in depth | **SKIP** (out of scope; before the window) | – |

## 5. Dev tooling and agent workflow

| # | Item | Foundry evidence | Gather today | Verdict | Effort / risk |
|---|---|---|---|---|---|
| 5.1 | Docs restructure: `docs/standards` (synced), `contracts`, `adr`, `runbooks`, `records`, `agents` plus `docs/README.md` map; AGENTS.md reduced to routing | `4459b34`, `981a89f`, `e4f94b6` (prune records to cited evidence), `46cfd18`, `d68143a`, `4be8d77` | Gather: `docs/{adr,agents,briefs,migrations,plans,research,review-notes,superpowers}`, large CLAUDE.md | **ADOPT-PATTERN**, selectively. Do the sync from developer-tools (`appelent:guidance`/`developer-tools` skill), not by copy. Gather's CLAUDE.md is ~400 lines of project facts; foundry moved those into runbooks and contracts. Reasonable cleanup, not urgent | M, risk L |
| 5.2 | CLAUDE.md drift in gather | – | `CLAUDE.md` still cites `docs/mobile-interaction.md`, but commit `637414d` ("remove outdated mobile interaction documentation") deleted it in this branch lineage. It also cites `D:\Dev\appelent-packages` and `/appelent:project sync-skills`, but the toolkit split into `developer-tools` and plugin (`d82e3d1` in appelent-packages). `docs/research/mobile-interaction-vocabulary.md` exists | Fix the references in the next CLAUDE.md edit | S |
| 5.3 | Worktree setup | `16d2e06`, `a7e8d28`, `8a5e888`: `scripts/setup-worktree.mjs` (+test, 550 lines; derives per-worktree Convex deployment, expiry, seeding), `docs/runbooks/worktree-setup.md`; `fd11efe`/`4f1b37a` record the **shared dev Convex exception** (worktrees use shared dev Convex unless isolation is asked for) in `CODING_STANDARDS.md` | `t3.json` runs `scripts/copy-env.sh` on worktree create (`f8355ba`). No per-worktree backend | **ADOPT-PATTERN**: only the *written exception* ("worktrees share the dev Convex deployment; destructive tests use a throwaway Clerk user"). Skip `setup-worktree.mjs`, which needs Convex deploy keys and cloud-dev provisioning gather does not use | S, risk L |
| 5.4 | `t3.json` actions | foundry: copy-env (Node, `scripts/copy-worktree-env.mjs`), plus "Start Expo mobile / iOS / Android" actions | gather: copy-env (bash, covers `.env.local`, `.dev.vars`, `apps/mobile/.env.local`) only | **ADOPT-PATTERN**: add three Start-Expo actions (`@gather/mobile start:dev-client`, `ios`, `android`). Gather's copy script is the better one (copies `.dev.vars`; foundry's `.worktreeinclude` lists the same files) | S, risk L |
| 5.5 | `scripts/env.mjs` and manifest tooling | foundry has the toolkit's `scripts/lib/env/*`, `lib/baseline.mjs`, `check-project.mjs`, `workspace.mjs`, `baseline*.mjs`, `env-manifest.test.mjs` copied in; `190f05f` | Gather's `scripts/env.mjs` is 6 lines delegating to `@appelent/dev` 0.2.0 (registry package; latest 0.4.0) | tied to 1.5. If gather keeps the registry, **bump `@appelent/dev`**; if vendoring, copy `scripts/lib/env` | S–M |
| 5.6 | `.claude` | foundry `.claude/settings.json` (wider allow-list: git add/commit/merge with `-C`, pnpm run check/lint/typecheck/test), skills `design-session`, `verify` (has a mobile section, `16b92c9`), `apps/mobile/.claude/skills/run-mobile`, commands `babysit`, `review-session`, `upgrade-deps` | gather: skills `verify` (route to module map; no mobile run section), same three commands, session-start hook installs deps in fresh containers and appends the registry token | **ADOPT-PATTERN**: add the `run-mobile` skill (2.4) and a mobile section to `verify`. The `design-session` skill is design-study tooling and gather has `designs/` plus `.design-sync`, so look at it before duplicating | S–M |
| 5.7 | Agent retro tooling (account-deletion retro `4f1b37a`; audit-fix retro `0a40478`/`c0277a4`/`15721c5`; `docs/runbooks/verification.md`; `render-screen.tsx` helper) | see rows | gather has `.claude/skills/verify` | **ADOPT-PATTERN**: the *gotchas list* in foundry's run-mobile SKILL.md is the valuable output of those retros (repeated labels are ambiguous, keyboard has no dismiss, share sheet closes via "dismiss popup", Metro port collisions across worktrees, sim inherits Mac language) | S |
| 5.8 | Codebase audit fixes (a11y roles on Pressable, dead code removal, index use) | `0a40478` PR #116 | gather ran its own iOS review (`8254477`, 15 bugs) | **SKIP** (feature-specific). Reuse its checklist: Pressable accessibilityRole/state, "no-op retry buttons: Convex resubscribes", messages out of components | – |
| 5.9 | CI additions | `cli.yml` (foundry's CLI), `ci.yml` mobile steps | see 2.3 | – | – |
| 5.10 | `AGENTS.md` | foundry's links standards via a managed `appelent-guidelines` block | gather's `CLAUDE.md` is hand-written, and `~/.claude/CLAUDE.md` says "Read AGENTS.md" | **ADOPT-PATTERN** with 5.1 | – |

## 6. Domain features (likely not reusable)

Listed for completeness; none is a port target.

- **Nutrition module**: NEVO shipped food library generation (`packages/core/scripts/generate-shipped-foods.ts`), diary, combos, goals, Capture Drafts, personal foods and measures, Open Food Facts client, barcode scan, week review. Gather has its own `foods`, `consumption`, `combos` modules. A comparison only matters for the **OFF client** (`1b2f347` bounded request cache, typed failure exits, `0ef5df4` import review): gather's `foodsLookup.ts` / `lib/offFetch.ts` might learn from the bounded cache.
- **AI entry help and label scanning** (`7b25491`, PR #114). Only the limit-and-consent pattern transfers (3.4).
- **Training**: strength sessions, routines, WODs, endurance activities, exercise catalogue and migration, hosted workouts, 1RM, body metrics.
- **Mobile redesign** (`73e39a3` PR #94, `61b349c` …): week overview, library, amount editor. Foundry's design system (`DESIGN_SYSTEM.md`, `apps/mobile/DESIGN_SYSTEM.md`, SwiftUI segmented control, Swift Charts, Gauge ring, inset grouped list, `useScrollGeometryChange` guard for expo < 57.0.22). Gather has its own `theme/tokens`, `docs/research/mobile-styling-and-tokens.md`, `@expo/ui` use. Possible later skim of `4115d89` for `@expo/ui` primitives gather could use, but they need SDK 57.0.22+ (gather is 57.0.24, so fine).
- **Test-data tools in app** (`bd4845a` PR #99, `convex/testData.ts`, contract `test-data.md`): gather's equivalent is the sample-household seed (`loadSampleData`/`resetSampleData`), which is stricter (env-gated, `seedRuns`).
- **Foundry CLI and MCP server** (`cli/`, `docs/runbooks/mcp.md`, PR #37): none needed.
- **Foundry Ops usage snapshot** (open PR #118) and PR #119 (Profile icon tiles): unmerged, ignore.

## 7. Version comparison

Resolved versions come from each `pnpm-lock.yaml`; ranges from `package.json`.

| Package | Foundry range → resolved | Gather range → resolved |
|---|---|---|
| Expo SDK (`expo`) | `~58.0.9` → 58.0.9 | `~57.0.24` → 57.0.24 |
| React Native | `0.88.0-rc.4` (release candidate) | `0.86.3` |
| React (mobile) | 19.3.0 | 19.2.3 |
| React (web) | `^19.3.0` → 19.3.0 | `^19.2.0` → 19.2.7 |
| expo-router | `~58.0.18` | `~57.0.22` |
| Reanimated / Worklets | 4.7.0 / 0.13.0 | `~4.5.1` / 0.10.1 |
| Gesture Handler / Screens | `~3.2.1` / `~4.29.0` | `~2.32.0` / `~4.26.0` |
| `@expo/ui` | `~58.0.16` | `^57.0.19` |
| `expo-updates` | `~58.0.16` | `~57.0.23` |
| `@clerk/expo` (mobile, Core 3) | `^4.10.1` → 4.10.1 | `^4.2.3` → 4.2.3 |
| `@clerk/clerk-react` (web, Core 2) | `^5.61.10` → 5.61.10 | `^5.61.3` → 5.61.3 |
| `convex` | `^1.46.0` → 1.46.0 (web and mobile) | `^1.42.3` → 1.42.3 |
| `convex-helpers` | 0.1.120 (patched) | not installed |
| `convex-test` | `^0.0.61` | `^0.0.54` |
| TanStack Start | `^1.168.61` → 1.168.61 | `latest` → 1.168.59 |
| TanStack Router | `^1.170.42` → 1.170.42 | `latest` → 1.170.40 |
| Vite / Vitest | `^8.3.4` → 8.3.4 / `^4.1.10` | `^8.0.0` → 8.1.3 / `^4.1.5` |
| Wrangler | `^4.149.0` | `^4.70.0` → 4.107.1 |
| TypeScript | `^6.0.2` (mobile `~6.0.3`) | `^6.0.2` (mobile `~6.0.3`) |
| Biome | 2.5.15 | 2.4.5 |
| Sentry | web 11.6.0 (`@sentry/react`, `cloudflare`, `node`); mobile `@sentry/react-native ~8.30.0` | web `@sentry/tanstackstart-react ^10.42` → 10.64.0; mobile none |
| `@appelent/auth` / `i18n` / `dev` | removed (vendored) | 0.1.0 / 0.1.0 / 0.2.0 (registry latest 0.3.0 / 0.3.0 / 0.4.0) |
| `eas-cli` | root devDep `24.12.1` | mobile devDep `^16.32.0` (eas.json `>= 16.0.1`) |
| Jest / RNTL | Jest `^30.5.2`, RNTL `^14.1.0`, jest-expo `~58.0.9` | none |
| pnpm | 11.8.0 | 11.8.0 |
| Node | `>=22.15.0` | CI pins 22 |

Gaps worth acting on regardless of SDK: gather's `eas-cli` (^16.32 in mobile) is far behind foundry's 24.12.1, and gather's
`@clerk/expo` is behind the version that carries the social and email-code APIs foundry used.
Foundry's `useSignInWithApple` and `useSSO` imports come from `@clerk/expo/apple` and
`@clerk/expo/experimental`. Confirm that 4.2.3 exports both before porting 1.1, or bump to 4.10.x.

## 8. Where gather is ahead (flows the other way)

- **Group-scoped deletion cascade as a compile-checked registry**: `convex/lib/groupCascade.ts`
  plus `lib/storedFiles.ts` (`FILE_HOLDERS`). Foundry's `personalData.ts` map is hand-maintained and
  silently misses a new table. A typed registry would let foundry's export, reset and delete never drift.
- **ADR 0029** (JS ships OTA, native does not; fingerprint policy) and the virtual-store-path
  fingerprint explanation. Foundry has the config but no ADR.
- **`deleteSelfEnabled` pre-check** and the "Convex first, Clerk second, `deletedAt` blocks
  re-provisioning" write-up (ADR 0032). Foundry checks the flag, but has no documented reason.
- **Drop / share intent** and the exhaustive `dropTargets` registry (ADR 0028).
- **Seed model**: Catalog (always wins, `seedKey`) versus Sample household (`seedRuns`, date-anchored).
- **PR preview path filter** (skip web preview when only `apps/mobile/` changed).
- **Better `copy-env.sh`** (also copies `.dev.vars`).
- **"One-shot code states its own end condition"** rule, and the breadcrumb, responsive action
  controls, and message-tree-only-in-both-locales conventions.
- **`docs/research/mobile-*.md`** (Clerk Expo, Convex on RN, Router, i18n, interaction vocabulary, styling).

## 9. Suggested order if gather adopts

1. Query retention (3.1, 3.2). JS-only, OTA-able, no native rebuild, biggest felt win. Use developer-tools' standard text.
2. Convex session gate (1.6) after a check of whether `GroupProvider` already covers it.
3. CI covers `apps/mobile` typecheck (2.3). Fix CLAUDE.md drift (5.2).
4. AI usage cap and consent for recipe import (3.4). Privacy page (1.11).
5. Decide 1.5 (vendor vs bump `@appelent/*`), then email-code sign-in (1.3).
6. One native build bundling: social sign-in and Apple revocation (1.1, 1.9), permissions tightening (2.9), `ascAppId` (2.6), Sentry mobile (2.11). Do not split these, each one moves the fingerprint.
7. SDK 58 (2.1) as its own change after 58 is on a stable RN final and `expo-share-intent` is confirmed.
8. Data export (1.10), `run-mobile` Android driver (2.4), mobile Jest (2.2) if wanted.

## 10. Caveats

- I did not run any foundry or gather code. Verdicts rest on reading commits, diffs and files.
- I did not verify `@clerk/expo` 4.2.3's exports or `expo-share-intent` 8.0.1's SDK 58 support. Both are open checks.
- Whether `GroupProvider` already blocks the tree until Convex authenticates (1.6) needs reading its `pending` path.
- Foundry's `docs/standards` versions were compared only by file listing and one file (`convex-query-caching.md` in developer-tools is v1.2.2). I did not diff every standard.
