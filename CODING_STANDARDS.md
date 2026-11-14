---
version: 4.2.3
description: Coding rules and task-specific implementation references.
---

# Coding standards

<!-- appelent-standards:start -->
## Shared guidance

Read only what the task needs; never preload every standard.

1. **Every code change:** [general coding](docs/standards/general-coding.md), plus [mobile coding](docs/standards/mobile-coding.md) for native code.
2. **When the task matches a row:** the linked standard.

| Task | Read |
| --- | --- |
| Adding, moving, or naming native files | [Mobile structure](docs/standards/mobile-structure.md) |
| Repository, package manager, formatter, types, tests, CI, or toolkit sync | [Baseline](docs/standards/baseline.md) |
| Top-level folders, workspace packages, or shared code between web, Convex, and mobile | [Repository layout](docs/standards/repo-layout.md) |
| Dependabot or automated dependency PRs | [Dependency updates](docs/standards/dependency-updates.md) |
| Web app stack, UI states, or browser capabilities | [Web baseline](docs/standards/web-baseline.md) |
| Expo setup or native configuration | [Mobile baseline](docs/standards/mobile-baseline.md) |
| Native builds, getting one onto a phone, TestFlight, OTA updates, or releases | [Mobile distribution](docs/standards/mobile-distribution.md) |
| Reporting work as done, verified, or accepted | [Verification](docs/standards/verification.md), then the project's check commands |
| Environment variables, secrets, `env.manifest.ts`, or `env:*` scripts | [Environments](docs/standards/environments.md) |
| Creating, preparing, or cleaning a worktree | [Workspaces](docs/standards/workspaces.md) |
| Authentication | [Auth](docs/standards/auth.md) |
| Convex functions, schema, migrations, seeds, tests, or account deletion and export | [Convex backend](docs/standards/convex.md) |
| Convex query reads, subscription retention, or local read caches | [Convex query caching](docs/standards/convex-query-caching.md) |
| Localization | [i18n](docs/standards/i18n.md) |
| Error reporting and source maps | [Sentry monitoring](docs/standards/sentry-monitoring.md) |
| In-app problem reports | [Issue reporting](docs/standards/issue-reporting.md) |
| Pull-request previews | [Previews](docs/standards/previews.md) |
| Staging or production deploys, deploy workflows, or branch rules | [Deployments](docs/standards/deployments.md) |
| Web manifest, installability, or service worker | [PWA](docs/standards/pwa.md) |
| Application CLI or browser login for it | [App CLI](docs/standards/app-cli.md) |
| MCP server or tools | [MCP](docs/standards/mcp.md) |
| Documentation or instruction changes | [Documentation](docs/standards/documentation.md) |
| Loading an external skill (Expo, Vercel React Native, better-*) | [Specialist skills](docs/standards/specialist-skills.md) |

### Working with standards

- **Conform:** follow standards as written. Rules are required unless marked **Default**. Installed copies are never edited in the project.
- **Improve:** when a standard is wrong, unclear, or missing a rule other projects would share, propose the change upstream with the `developer-tools` skill: a pull request when concrete, an issue when not.
- **Differ:** when this project needs something else, discuss it with the user first; never deviate silently. Record the agreed exception below: rule, scope, replacement, reason.

Project decisions below select implementations and explain deviations from shared defaults.
<!-- appelent-standards:end -->

## Workspaces

| Path | Owns |
| --- | --- |
| `src/` | TanStack Start web app (SSR, Cloudflare Worker); file routes in `src/routes/`, in-app links in `src/lib/links.ts` |
| `convex/` | Shared backend; schema in `convex/schema.ts`, helpers in `convex/lib/`, seed fixtures in `convex/lib/seed/` |
| `apps/mobile/` | Expo app; read [mobile standards](apps/mobile/CODING_STANDARDS.md) before native changes |
| `packages/core/` | `@gather/core`: dependency-free domain code, Module metadata, message trees, photo presets ([ADR-0016](docs/adr/0016-shared-code-crosses-as-a-package-with-no-dependencies.md)) |

One Vitest run covers all four, plus the repo scripts (`vitest.config.ts`
projects `web`, `convex`, `core`, `mobile`, `scripts`); root `pnpm typecheck` covers everything but `docs/standards`.
Run the [project checks](docs/runbooks/verification.md) for every affected target.

## Domain documentation

[GLOSSARY.md](GLOSSARY.md) is the glossary for web, mobile and core: use its terms
in code, hypotheses and issue titles, and record newly resolved terms there. A
rule about behavior goes in a `docs/contracts/` contract, not the glossary.
Read the ADRs in `docs/adr/` for the affected boundary and name any conflict
with an accepted ADR before reopening it.

## Local bindings and exceptions

Gather selects Convex, Clerk, English/Dutch localization, Cloudflare Workers
and EAS. These bindings deviate from or narrow the shared guidance:

| Capability | Binding |
| --- | --- |
| Auth | Web: the sign-in, sign-up and forgot-password forms, profile panel, appearance settings, header user menu and theme sync are app-owned in `src/lib/auth/`, copied from the [auth web examples](docs/standards/auth/examples/web/index.ts). Their copy is still the English it was copied with, except `AppearanceSettings`, which reads the message tree; translating the rest is open. The app owns `src/integrations/clerk/provider.tsx` (plain `ClerkProvider`, `signInUrl`/`signUpUrl` pointed at gather's routes) and the Clerk↔Convex JWT bridge in `src/integrations/convex/provider.tsx`; Convex validates with `CLERK_JWT_ISSUER_DOMAIN`. Web `@clerk/react` and mobile `@clerk/expo` are both Clerk Core 3 ([ADR-0038](docs/adr/0038-both-clients-speak-clerk-core-3.md)). |
| Localization | See [Localization](#localization). |
| Environments | `pnpm env:*` runs the vendored `scripts/env.mjs` against the data-only `env.manifest.ts`, with the shared routing and no overrides. `staging` has no Convex deployment (it is a frontend on production, [ADR-0039](docs/adr/0039-staging-is-a-frontend-on-the-production-backend.md)) and its Worker takes the standard name `gather-staging`. Infisical tiers follow lifetime: web PR previews read Infisical `staging` and so the Clerk development instance, while staging web (on `gather-stg.appelent.nl`), the installed preview app (EAS `preview`, written from `staging`) and production read Infisical `prod` and the production instance. Facts and hazards: [environment](docs/runbooks/environment.md). |
| `appelent.json` | The config the vendored scripts read: `envManifest` and the `workspace` policy. Do not run the retired `/appelent` plugin commands, which regenerate superseded instruction blocks. |
| Worktrees | `t3.json` runs `node scripts/workspace.mjs prepare --editor t3` on worktree creation, which writes `.env.local`, `.dev.vars` and `apps/mobile/.env.local` from Infisical `dev` (`backend.mode: "none"`, so every worktree shares the dev Convex deployment). |
| Test login | **Exception** to the auth standard's `+clerk_test` email-code test login: the shared test user (`PREVIEW_TEST_USER` in `convex/seed.ts`) signs in with a password, so `src/lib/auth/TestLoginButton.tsx` keeps the password flow and shows only when the Clerk key is `pk_test_…` and both `VITE_TEST_USER_*` are set. The phone's equivalent is `EXPO_PUBLIC_TEST_USER_*`, local only. These values are inlined into bundles, so the account must live on the Clerk *test* instance and is never set for production. |
| Convex query caching | Mobile: `retention`, 5 min expiration, 20 idle entries, in `apps/mobile/src/convex/queries.ts` (hooks and bounds) and `QueryCacheProvider.tsx` (mounted by `ConvexSessionGate`, keyed by account). A Group switch releases nothing: Group reads name their Group in their arguments ([ADR-0031](docs/adr/0031-the-current-group-is-ambient-on-web-and-mobile.md)). `convex-helpers` is unpatched, because the starter's lifecycle adapter disposes the registry itself; `QueryCacheProvider.test.tsx` runs that adapter against the real helper, so a helper bump that changes the registry fails CI. `EXPO_PUBLIC_DEBUG_QUERIES=1` logs wire subscriptions in development. Evidence: [record](docs/records/2026-10-18-mobile-query-retention.md). Web: not adopted. |
| Observability | Web: `@sentry/react` in the browser and `@sentry/cloudflare` in the Worker (`src/server.ts`). Phone: `@sentry/react-native`, errors only, in `apps/mobile/src/observability/`. All three share the scrubber in `packages/core/src/sentryPrivacy.ts`. Convex is not covered. Facts: [Sentry runbook](docs/runbooks/sentry.md). |
| PWA | `scripts/generate-sw.mjs` (Workbox) runs after every `vite build`; it predates the [PWA](docs/standards/pwa.md) template. |
| Mobile tests | **Exception** to Jest with jest-expo in [mobile baseline](docs/standards/mobile-baseline.md) and the `Mobile Jest` CI step in [baseline](docs/standards/baseline.md): phone unit tests run in the root Vitest `mobile` project. One runner, config and setup covers web, Convex, core and the phone, and the phone's tests already pass under it; a second runner would add config without adding coverage. |
| Documentation | **Exception** to "one-off work is an issue and its PR" in [documentation](docs/standards/documentation.md): an unfinished data migration keeps a document in `docs/migrations/` until it has run everywhere, because code comments and the [one-shot code](#one-shot-code) rule point at it as the retirement ledger. A finished one becomes a `docs/records/` record when something cites it and is deleted otherwise. |
| Agent workflow | `.claude/skills/verify` is the one project skill (route→Module map). Shared procedures are toolkit skills (`upgrade-dependencies`, `review-app`, `babysit-pr`), never copied into `.claude/commands/`. A fix that is not gather-specific goes back to developer-tools. |
| Formatting | **Exception** to the [baseline](docs/standards/baseline.md) Biome fragment's tabs and double quotes: `biome.json` keeps 2-space indents, single quotes and semicolons as needed, everywhere in the repository. Gather was written in this style; switching rewrites every file and its blame for no behavior change. The fragment's mobile rules are adopted under Gather's names (`Notice`, `src/convex/queries.ts`). Toolkit-owned and verbatim-copied scripts (`scripts/check-mobile-structure.mjs`, `scripts/env.mjs`, …) keep the toolkit's style and are excluded from Biome. |
| Linting | Biome is the only linter, phone included (`biome.json`). The phone's ESLint (`eslint-config-expo`) was removed: CI never ran it, and beyond Biome it reported only React Compiler readiness rules, which do not apply while the compiler is off. Turning the compiler on is when to add them back. The root `linter.enabled` is `false`; the `apps/mobile/**` overrides turn it on, so the phone's import rules run: Convex functions and ids come through `apps/mobile/src/convex/api.ts` ([repo layout](docs/standards/repo-layout.md)), and Convex hooks through `src/convex/queries.ts`. |
| Pre-commit hook | `lefthook.yml` runs `biome check --staged` before a commit, from the [baseline](docs/standards/baseline.md) template; the root `lefthook` dev dependency installs it on `pnpm install`. Skip one commit with `git commit --no-verify` or `LEFTHOOK=0`. |
| React version | Web and phone pin the same exact `react` and `react-dom` (19.3.0, the version Expo SDK 58 bundles), so the workspace holds one React. Bump them together with the Expo SDK. |
| Dependency updates | `.github/dependabot.yml`: cooldown 3 days, the same as `minimumReleaseAge`; besides the Expo, React Native and React family it ignores `@sentry/react-native` (excluded from `expo install`). Alerts and security updates are on. |
| Package manager and CI | `pnpm-workspace.yaml` follows the [baseline template](docs/standards/baseline/templates/pnpm-workspace.yaml) except `verifyDepsBeforeRun: false`, whose reason and retirement condition are in that file. `ci.yml` runs the template's steps, except: no `push` trigger (`deploy.yml` calls it through `workflow_call` before deploying `main`), no separate core typecheck (the root `tsc` covers `packages/core`), no mobile Jest step (see Mobile tests), and the check, typecheck (root and mobile) and Vitest steps run as one `pnpm verify` step, so CI runs the local gate ([verification](docs/runbooks/verification.md)). `pnpm check` runs Biome and `scripts/check-mobile-structure.mjs`. |
| Deploys | `deploy.yml` follows [deployments](docs/standards/deployments.md), except that staging deploys no backend ([ADR-0039](docs/adr/0039-staging-is-a-frontend-on-the-production-backend.md)): staging has no `CONVEX_DEPLOY_KEY`, the job withholds that secret outside production, and only production runs `convex deploy` and the Catalog seed. Its `checks` job calls `ci.yml`. `deploy:dev` (the manual `gather-dev` Worker) builds from local values, because there is no `dev` environment. |

### Deferred toolkit adoption

Synced 2026-11-09 (developer-tools `872db87`). Not yet adopted:

- **Convex backend** ([convex](docs/standards/convex.md)): auth goes through `requireCurrentUser` and `requireIdentity` (`convex/lib/sharing.ts`) and access to a row through `requireInGroup` (`convex/lib/groupAccess.ts`), but most user-facing failures still throw English strings (`new ConvexError('Recipe not found')`), not keyed codes. Calendar and tasting refusals are keyed, through `@gather/core/refusals`; adopt per function when touched. Clients read them through `errorMessage(caught, fallback, refusals?)` (`src/lib/errorMessage.ts`), not the standard's `errorMessage(messages, caught, fallback)`: a keyed refusal reads from `refusals`, a `ConvexError` shows its sentence, and any other `Error` shows its own message, so until every refusal is keyed, unknown server text can reach the UI. Few public functions declare `returns` yet; one gets a validator when its return value changes. The standard's first step, finding public functions with no auth check, is worth its own issue.
- **Deployments defaults:** no `main` ruleset yet.
- **Mobile distribution and baseline 2.4:** no `APP_VARIANT` side-by-side installs (`app.json` is static), no restart prompt for a downloaded update, and no CI publish after the backend deploys. `apps/mobile/scripts/publish-update.mjs` stays in place of the toolkit wrapper. The fingerprint config, the runtime-diff workflow and opt-in CI builds are not added: the fingerprint config changes the runtime once, so every installed build would need a rebuild first.

### Localization

Binds [i18n](docs/standards/i18n.md). `src/lib/i18n/runtime/` is the engine —
the provider and Clerk language sync copied from the
[i18n examples](docs/standards/i18n/examples/index.tsx), with the pure helpers
taken from `@gather/core/i18n`; `src/lib/i18n/` holds the web wiring and the
`renderWithI18n` test helper (`useI18n` throws outside `LocaleProvider`); the
language controls are `LanguageToggle` (topbar) and `LanguageSettings` (`/settings`).
The English and Dutch trees live in `packages/core/src/messages/`; English is
the source and `nl` `satisfies` it, so a missing key fails `pnpm typecheck` and
`packages/core/src/__tests__/core.test.ts` catches empty strings and drifted
`{placeholder}` tokens. The phone composes those trees with its own words in
`apps/mobile/src/i18n/messages/`. The UI is fully translated in both apps: every
new user-visible string goes in both locales. The chrome-vs-content boundary
and the Dutch glossary are [ADR-0011](docs/adr/0011-the-ui-is-english-at-the-source-and-translations-are-typed-dictionaries.md).

The [i18n](docs/standards/i18n.md) rules on backend and data-file text,
validators and effects apply as written. Gather's schema unions are `ModuleId`,
`NutrientKey` and `BabyEventType`: add both locales' entries in the
same change as a new member. Pure modules that take messages as a trailing
parameter include `navItems`, `getRouteContext`, `formatActivityTime`,
`formatAge` and `summarizeBabyEvent`.

### One-shot code

Binds [one-shot code](docs/standards/general-coding.md#one-shot-code). A
migration's retirement record is its entry in `docs/migrations/`; the active
list, commands and retirement conditions are in
[`docs/migrations/README.md`](docs/migrations/README.md).
