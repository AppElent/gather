# gather

A household-management app (Recipes, Tasks, groups, and a growing set of placeholder
modules — meal planner, groceries, pantry, finances, bills, calendar, notes,
cheeses, wines) built on the standard AppElent stack:

- **TanStack React Start + Router** (file-based routing, `tsr generate`), SSR, Vite.
- **Convex** backend (`convex/`) — functions: `recipes.ts`, `groups.ts`, `users.ts`,
  `recipeImport.ts`, `recipeNutrition.ts`, `foods.ts`, `foodsLookup.ts`, `consumption.ts`,
  `taskLists.ts`, `tasks.ts`, `integrations.ts`, `lib/sharing.ts`, `lib/nutrition.ts`,
  `lib/offMapping.ts`, `lib/offFetch.ts`, `lib/consumption.ts`, `lib/taskAccess.ts`, `lib/storedFiles.ts`,
  `lib/taskProviders/` (adapter pattern for Notion/Todoist), `seed.ts` +
  `lib/seed/` (see "Seed data" below). Schema in `convex/schema.ts`.
- **Clerk** auth (`@clerk/clerk-react`), JWT-bridged to Convex via `CLERK_JWT_ISSUER_DOMAIN`
  (Convex deployment env var, set with `convex env set` — not committed anywhere).
- **Cloudflare Workers** deploy via `wrangler.jsonc` — worker name `gather`
  (prod) / `gather-dev` (dev env block).
- **Biome** for lint/format (tab-free, 2-space, single quotes, semicolons as needed).
- **Vitest** + jsdom + Testing Library.
- **Tailwind v4**.
- **`@t3-oss/env-core`** for typed env validation (`src/env.ts`, currently minimal —
  not yet wired to the Clerk/Convex/Sentry vars actually in use).
- **Sentry** (`@sentry/tanstackstart-react`, wired via `instrument.server.mjs`).
- **Package manager: pnpm, always.**

## Dependency status

`@appelent/auth` is integrated: sign-in/sign-up/forgot-password forms, the account
profile panel, appearance settings, header user menu, and theme sync all come from
the shared package (see `src/routes/__root.tsx`, `src/routes/sign-in.tsx`,
`src/routes/sign-up.tsx`, `src/routes/forgot-password.tsx`,
`src/routes/_app/account.tsx`, `src/routes/_app/settings.tsx`,
`src/components/app/Topbar.tsx`). Per the package's own design, this app still owns
`src/integrations/clerk/provider.tsx` (plain `ClerkProvider`, with `signInUrl`/
`signUpUrl` pointed at gather's routes) and the Clerk↔Convex JWT bridge in
`src/integrations/convex/provider.tsx` — `@appelent/auth` does not export either of
those. `src/styles.css` overrides the package's `--auth-*` tokens to match gather's
sea/lagoon palette, and defines `.rm-panel`/`.rm-label` (used by `ProfilePanel`/
`AppearanceSettings` but not shipped in `tokens.css`) to match the app's
`.demo-panel`/`.demo-section-title` card styling.

Known limitation (not fixable from gather): `AppearanceSettings`'s copy hardcodes
"Choose how ArchStudio looks." regardless of `useAuthConfig().appName` — a bug in
the shared package itself, out of scope here.

## Scripts

Standard baseline set (`pnpm run <script>`): `dev`, `dev:all` (Convex once + Vite),
`dev:watch` (Convex watch + Vite via `concurrently`), `generate-routes`, `build`,
`build:development`, `preview`, `typecheck`, `test`, `format`, `lint`, `lint:fix`,
`check`, `cf-typegen`, `deploy` (= `deploy:prod`), `deploy:dev`, `deploy:prod`,
`seed` (Catalog only, safe anywhere), `seed:sample` (rebuilds the Sample
household on the dev deployment around the shared Clerk test user).

`deploy:dev` and `deploy:prod` both run `convex run seed:seedCatalog` between
the Convex deploy and the build — Convex has no post-deploy hook outside
previews, so that step is the only deterministic place for it.

## Seed data

Two mechanisms with deliberately opposite rules, kept as two plain functions in
`convex/seed.ts`. Fixtures and logic live in `convex/lib/seed/`; only
`convex/seed.ts` exports callable functions. See
`docs/adr/0004-catalog-entries-are-read-only-and-the-seed-always-wins.md`.

- **Catalog** (`seedCatalog`, `lib/seed/catalogFoods.ts`) — reference data the
  app needs to work, in every environment including production. Reconciled by
  `seedKey`; the seed always wins, retired fixtures are deleted, and rows
  without a `seedKey` are user-created and never touched. Catalog rows are
  read-only in the app, enforced in `foods.update` as well as the UI.
- **Sample household** (`seedPreview` / `loadSampleData`,
  `lib/seed/sampleHousehold.ts`) — fake content for dev and preview only. Wiped
  and recreated on every run, tracked in the `seedRuns` table, with every date
  anchored to the run rather than hardcoded. Handwritten fixtures; `faker` is
  only for padding lists out to test volume. Reset also cascades through
  containment — a task you added to a seeded list, or the baby's lazily-created
  lists — because deleting only the recorded rows would leave those unreachable
  rather than intact. Content the sample Group merely *contains a reference to*
  survives: a recipe a real person owns is un-shared, not deleted, and the
  owner's previous default Group is restored.

**When you add a Module, add its seed contribution in the same change** — a
Catalog fixture if it needs reference data, and Sample household fixtures so
previews stay representative. There is no registry slot to leave visibly empty,
so this rule is the only thing keeping previews useful as Modules land.

The preview seed runs via `--preview-run seed:seedPreview` in
`.github/workflows/preview.yml` and hardcodes the Clerk test user's subject
(`--preview-run` takes no arguments). If that Clerk test user is ever
recreated, update `PREVIEW_TEST_USER` in `convex/seed.ts` or previews will seed
a household nobody can sign into.

## Env vars

Client (`.env.local`, see `.env.example` for the full documented list):
`VITE_CLERK_PUBLISHABLE_KEY`, `VITE_TEST_USER_EMAIL`, `VITE_TEST_USER_PASSWORD`
(the latter two enable `@appelent/auth`'s dev-only test-login button when the
Clerk key is `pk_test_...`), `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`,
`VITE_SENTRY_DSN`, `VITE_SENTRY_ORG`, `VITE_SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`,
`VITE_ENABLE_SAMPLE_DATA` (shows the Sample data panel in `/settings`; implied
by `import.meta.env.DEV`, set explicitly for previews in `preview.yml`, never
set for a production build).

Convex deployment (server-side, set via `convex env set` / `convex env default set`,
never in a committed file): `CLERK_JWT_ISSUER_DOMAIN` — set on dev, prod, and as the
default for preview deployments (PR previews create a fresh Convex backend per PR
that doesn't inherit dev/prod env vars). `ANTHROPIC_API_KEY` — powers the recipe
URL-import action's AI fallback; optional (JSON-LD-only imports work without it, and
recipes without matching JSON-LD simply fail to import if it's unset).
`NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` and `TODOIST_CLIENT_ID` /
`TODOIST_CLIENT_SECRET` — OAuth credentials for the Tasks module's external
list providers; optional (without them, connecting that provider fails with a
clear "not configured" error and local lists work normally). Each provider's
OAuth app must register the redirect URI `<app-origin>/integrations/callback`
(e.g. `http://localhost:3000/integrations/callback` for dev).
`ENABLE_SAMPLE_DATA` — must be `'true'` for the publicly-callable
`seed.loadSampleData` / `seed.resetSampleData` mutations to run at all. Set it
on dev and as a preview-type default (`convex env default set --type preview`);
**never on production**, where its absence is what stops anyone with the
deployment URL from writing a fake household into the real database. The
internal `seedCatalog` / `seedPreview` entrypoints do not consult it.

## One-shot code states its own end condition

Migration mutations, backfills and compatibility shims are written to run against
a data shape and then be dead — but they sit in `convex/` and `src/` looking
exactly like live code, with tests that go on passing whether or not the shape
still exists anywhere. So each one says, where it lives, what would retire it:

- **Migration code** is deleted when its document in `docs/migrations/` records
  that it has been run everywhere, or that something else has superseded it.
- **A compatibility shim** names the date or the event after which it goes.
- Code with no end condition does not get to be one-shot code. It is just code,
  and it will be maintained forever.

`src/lib/legacyPaths.ts` was the cautionary case: excellent about why it existed,
silent about when it stopped, and on course to outlive every link it served.

## CI / PR previews

- `.github/workflows/ci.yml` — check/typecheck/test/build gate on push to `master`
  and on PRs.
- `.github/workflows/preview.yml` — per-PR Convex preview deployment + per-PR
  Cloudflare Worker (`gather-pr-<N>`) + PR comment + teardown on close.
  `PREVIEW_CLERK_PUBLISHABLE_KEY`, `VITE_TEST_USER_EMAIL` / `VITE_TEST_USER_PASSWORD`
  (build-time only — they light up `@appelent/auth`'s test-login button on the
  preview, and are inlined into the client bundle, so the test user must live on
  the Clerk *test* instance), optionally `NODE_AUTH_TOKEN`.

## Claude Code workflow layer

`.claude/skills/review-app` and `.claude/skills/review-session` are project-local
copies of the `appelent` plugin's bundled `skills/review-app`/`skills/review-session`
(catalog repo `D:\Dev\appelent-packages`, https://github.com/AppElent/appelent-packages)
— **the plugin's copies are the source of truth**; refresh either with
`/appelent:project sync-skills <name>`. `.claude/commands/upgrade-deps.md` and
`.claude/commands/review-session.md` are still project-local copies of the global
`~/.claude/commands/custom-upgrade-deps.md` / `custom-review-session.md` templates
(no catalog equivalent for these two yet) — the global copies remain the source of
truth for them. In all cases, a non-project-specific fix made locally should be
ported back to whichever source copy it traces to, not left to drift.
`.claude/skills/verify/SKILL.md` is the one exception: it's project-specific by
design (gather's actual route→module map) and has no source-of-truth counterpart
at all.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (`AppElent/gather`), driven via the `gh` CLI.
See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its name.
See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root.
See `docs/agents/domain.md`.

<!-- appelent-managed:start -->

## Appelent Managed Project

This is an Appelent-managed app. Opted-in features and their options are
recorded in `appelent.json`. Feature definitions live in the `appelent`
plugin (locally installed) or https://github.com/AppElent/appelent-packages
(`skills/<feature>/FEATURE.md`).

Before adding functionality that could apply to multiple apps, check the
feature catalog first. To add or update a feature, use `/appelent`.

<!-- appelent-managed:end -->
