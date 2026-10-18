---
version: 4.1.0
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
| Web app stack, UI states, or browser capabilities | [Web baseline](docs/standards/web-baseline.md) |
| Expo setup, native configuration, builds, or releases | [Mobile baseline](docs/standards/mobile-baseline.md) |
| Verification | [Verification](docs/standards/verification.md), then the project's check commands |
| Environment variables and secrets | [Environments](docs/standards/environments.md) |
| Worktrees and isolated backends | [Workspaces](docs/standards/workspaces.md) |
| Authentication | [Auth](docs/standards/auth.md) |
| Convex query reads, subscription retention, or local read caches | [Convex query caching](docs/standards/convex-query-caching.md) |
| Localization | [i18n](docs/standards/i18n.md) |
| Error reporting and source maps | [Sentry monitoring](docs/standards/sentry-monitoring.md) |
| In-app problem reports | [Issue reporting](docs/standards/issue-reporting.md) |
| Pull-request previews | [Previews](docs/standards/previews.md) |
| Web manifest, installability, or service worker | [PWA](docs/standards/pwa.md) |
| Application CLI or browser login for it | [App CLI](docs/standards/app-cli.md) |
| MCP server or tools | [MCP](docs/standards/mcp.md) |
| Documentation or instruction changes | [Documentation](docs/standards/documentation.md) |
| Specialist tasks | [Specialist skills](docs/standards/specialist-skills.md) |

### Working with standards

- **Conform:** follow standards as written. Installed copies are never edited in the project.
- **Improve:** when a standard is wrong, unclear, or missing a rule other projects would share, propose the change upstream with the `developer-tools` skill: a pull request when concrete, an issue when not.
- **Differ:** when this project needs something else, discuss it with the user first; never deviate silently. Record the agreed exception below: rule, scope, replacement, reason.

Project decisions below select implementations and explain deviations from shared defaults.
<!-- appelent-standards:end -->

## Workspaces

| Path | Owns |
| --- | --- |
| `src/` | TanStack Start web app (SSR, Cloudflare Worker); file routes in `src/routes/`, Group addresses in `src/lib/groupPaths.ts` |
| `convex/` | Shared backend; schema in `convex/schema.ts`, helpers in `convex/lib/`, seed fixtures in `convex/lib/seed/` |
| `apps/mobile/` | Expo app; read [mobile standards](apps/mobile/CODING_STANDARDS.md) before native changes |
| `packages/core/` | `@gather/core`: dependency-free domain code, Module metadata, message trees, photo presets ([ADR-0016](docs/adr/0016-shared-code-crosses-as-a-package-with-no-dependencies.md)) |

One Vitest run covers all four (`vitest.config.ts` projects `web`, `convex`,
`core`, `mobile`); root `pnpm typecheck` covers everything but `docs/standards`.
Run the [project checks](docs/runbooks/verification.md) for every affected target.

## Domain documentation

[GLOSSARY.md](GLOSSARY.md) is the glossary for web, mobile and core: use its terms
in code, hypotheses and issue titles, and record newly resolved terms there. A
rule about behavior goes in a `docs/contracts/` contract, not the glossary.
Read the ADRs in `docs/adr/` for the affected boundary and name any conflict
with an accepted ADR before reopening it. Two ADR numbers are shared by two
files each; cite those by filename ([index](docs/README.md#decisions)).

## Local bindings and exceptions

Gather selects Convex, Clerk, English/Dutch localization, Cloudflare Workers
and EAS. These bindings deviate from or narrow the shared guidance:

| Capability | Binding |
| --- | --- |
| `@appelent/*` packages | **Exception** to the "no `@appelent` dependency" rule in [auth](docs/standards/auth.md), [i18n](docs/standards/i18n.md) and [environments](docs/standards/environments.md). Gather still depends on `@appelent/auth`, `@appelent/i18n` and `@appelent/dev` (only `scripts/env-source.mjs` and its test) from the private GitHub Packages registry, so `.npmrc`, `NODE_AUTH_TOKEN` in every workflow, the EAS `eas-build-pre-install` hook and the SessionStart hook stay until the packages are copied into the app. |
| Auth | Web: `@appelent/auth` supplies the sign-in, sign-up and forgot-password forms, profile panel, appearance settings, header user menu and theme sync. The app owns `src/integrations/clerk/provider.tsx` (plain `ClerkProvider`, `signInUrl`/`signUpUrl` pointed at gather's routes) and the Clerk↔Convex JWT bridge in `src/integrations/convex/provider.tsx`; Convex validates with `CLERK_JWT_ISSUER_DOMAIN`. The package's `AppearanceSettings` hardcodes "ArchStudio" in its copy — a package defect that goes with the package. Mobile: `@clerk/expo`, one Clerk generation ahead of the web ([ADR-0014](docs/adr/0014-the-phone-is-a-clerk-generation-ahead-of-the-web.md)). |
| Localization | See [Localization](#localization). |
| Environments | `pnpm env:*` runs the vendored `scripts/env.mjs` against `env.manifest.ts`. Facts and hazards: [environment](docs/runbooks/environment.md). |
| `appelent.json` | Kept as the config the vendored scripts read (`envManifest`). Its `features` block is a frozen legacy ledger: never bump it, and do not run the retired `/appelent` plugin commands, which regenerate superseded instruction blocks. |
| Worktrees | `t3.json` runs `scripts/copy-env.sh` on worktree creation, copying `.env.local`, `.dev.vars` and `apps/mobile/.env.local` from the main checkout; `scripts/workspace.mjs` is installed but not adopted. **Exception** to per-worktree isolated backends: every worktree shares the main checkout's dev Convex deployment, so runtime writes are visible to all of them. |
| Test login | Non-production web builds show `@appelent/auth`'s test-login button when the Clerk key is `pk_test_…` and `VITE_TEST_USER_*` are set; the phone's equivalent is `EXPO_PUBLIC_TEST_USER_*`, local only. These values are inlined into bundles, so the account must live on the Clerk *test* instance and is never set for production. |
| Convex query caching | Not adopted on web or mobile. |
| Observability | `@sentry/tanstackstart-react` is installed and `VITE_SENTRY_*`/`SENTRY_AUTH_TOKEN` are routed, but nothing initialises Sentry: there is no `instrument.server.mjs` (the `start` script imports one) and nothing in `src/router.tsx`. Treat Sentry as absent until it is wired per [Sentry monitoring](docs/standards/sentry-monitoring.md). |
| PWA | `scripts/generate-sw.mjs` (Workbox) runs after every `vite build`; it predates the [PWA](docs/standards/pwa.md) template. |
| Mobile tests | Phone unit tests run in the root Vitest `mobile` project, not Jest with jest-expo as [mobile baseline](docs/standards/mobile-baseline.md) specifies. |
| Documentation | **Exception** to "one-off work is an issue and its PR" in [documentation](docs/standards/documentation.md): an unfinished data migration keeps a document in `docs/migrations/` until it has run everywhere, because code comments and the [one-shot code](#one-shot-code) rule point at it as the retirement ledger. A finished one becomes a `docs/records/` record when something cites it and is deleted otherwise. |
| Agent workflow | `.claude/skills/verify` is the one project skill (route→Module map). `.claude/commands/` holds thin commands: `review-session` invokes the global `custom-review-session` skill, `upgrade-deps` copies the global `custom-upgrade-deps` template, `babysit` is gather's PR policy. A fix that is not gather-specific goes back to the global source. |

### Localization

Binds [i18n](docs/standards/i18n.md). `@appelent/i18n` supplies the engine
(exception above); `src/lib/i18n/` holds the web wiring and the
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
`NutrientKey`, `MealName` and `BabyEventType`: add both locales' entries in the
same change as a new member. Pure modules that take messages as a trailing
parameter include `navItems`, `getRouteContext`, `formatActivityTime`,
`formatAge` and `summarizeEvent`.

### One-shot code

Binds [one-shot code](docs/standards/general-coding.md#one-shot-code). A
migration's retirement record is its entry in `docs/migrations/`; the active
list, commands and retirement conditions are in
[`docs/migrations/README.md`](docs/migrations/README.md).
