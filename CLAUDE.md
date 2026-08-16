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
  (prod, top-level config) / `gather-stg` (`stg` env block, what a merge to
  `main` deploys) / `gather-dev` (`dev` env block, manual only — dev proper is
  local).
- **Biome** for lint/format (tab-free, 2-space, single quotes, semicolons as needed).
- **Vitest** + jsdom + Testing Library.
- **Tailwind v4**.
- **`@t3-oss/env-core`** for typed env validation (`src/env.ts`), whose schemas are
  *derived* from `env.manifest.ts` rather than restating a list of names.
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

Plus `env:check`, `env:apply` and `env:generate` — see "Env vars" below.

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

**`env.manifest.ts` is the source of truth.** An entry declares *who reads* a
value — `vite-build`, `build-tooling`, `local-tooling`, `worker-runtime`,
`convex-functions`, `workflow` — and which of `local` / `preview` / `stg` /
`production` need it. A single table in that file derives *where* the value must
be written from (consumer, environment). Nothing else lists variable names:
`src/env.ts` derives its schemas from the manifest, and `.env.example` is
generated. See
`docs/adr/0014-a-variable-declares-its-consumer-not-its-destination.md`.

```
pnpm run env:check                 manifest consistency + .env.example freshness
pnpm run env:check <environment>   compare the manifest with reality
pnpm run env:apply <environment>   write it
pnpm run env:generate              regenerate .env.example
```

**When you add a variable, add it to the manifest in the same change** — there
is nowhere else to add it, which is the point. Two rules the types enforce: a
value the Vite build reads may not be `secret: true` (the build inlines it into
a public bundle), and a `vite-build` name must start with `VITE_` (Vite delivers
nothing else).

**Values** live in `env/<environment>.public.env` (committed — none of it is
confidential, and a fresh clone then needs only the secrets) and
`env/<environment>.secret.env` (never committed). `.env.local` and `.dev.vars`
are *generated* by `env:apply local`; `apply` refuses to overwrite either if it
did not write it.

Three invariants `scripts/env.mjs` holds: it never writes an empty value (a
value missing on this machine is skipped and reported, so `apply production`
from a laptop without the production secrets cannot blank production), it never
deletes without `--prune`, and it never prints a secret.

**What `check` can and cannot prove.** Public values are GitHub *variables* and
Convex returns its values, so those get a real value-diff against the committed
file. Secrets are presence-only — every secret store returns names alone — so
"the right name holding the wrong value" is undetectable by design.

**GitHub scope.** `stg` and `production` are GitHub Environments holding the
same names with different values. `preview.yml` declares no `environment:`, so
it resolves *repo-level* names, which carry a `PREVIEW_` prefix. That prefix is
a safety rule: an environment secret shadows a repo secret of the same name, so
identical names would let a missing production value fall back to preview's.

**Convex deployment vars** (`CLERK_JWT_ISSUER_DOMAIN`, `ANTHROPIC_API_KEY`,
`NOTION_*` / `TODOIST_*`, `ENABLE_SAMPLE_DATA`) are set by `env:apply`, not by
hand. `ENABLE_SAMPLE_DATA` must never be set on production — its absence is what
stops anyone with the deployment URL writing a fake household into the real
database — and the manifest enforces that by not declaring it there at all. Note
staging is a `--type prod` deployment, so the preview-type default does *not*
reach it; "never on production" means the deployment holding real households,
not the type label. Each OAuth provider's app must register the redirect URI
`<app-origin>/integrations/callback`.
## Internationalization

**Current portable-core layout:** `@gather/core` owns the English and Dutch
message trees in `packages/core/src/messages/`, plus Gather's pure locale
helpers. The web's `src/lib/i18n/` owns only the React/web engine wiring. Add
every new Module's metadata in `packages/core/src/modules.ts` and its names and
descriptions in both core message trees; the Node-based core test verifies the
locale trees stay complete and interpolation-compatible.

`@appelent/i18n` supplies the engine; gather owns `src/lib/i18n/` — the
`messages/{en,nl}/` trees, the root-route wiring, `LanguageToggle` (topbar) and
`LanguageSettings` (`/settings`). **English is the source language**: a string is
written in `messages/en/` first, and `messages/nl/` `satisfies` it, so a missing
key fails `pnpm typecheck` and `src/lib/i18n/__tests__/messages.test.ts` catches
what a type cannot (empty strings, drifted `{placeholder}` tokens). See
`docs/adr/0011-the-ui-is-english-at-the-source-and-translations-are-typed-dictionaries.md`
for the chrome-vs-content boundary and the Dutch glossary.

The whole app is translated — shell and every Module. **Any new user-visible
string goes in the message tree, in both locales**; there are no English
literals left in `src/` to copy the old habit from.

Four rules the conversion established, each of which will bite if ignored:

- **Display strings never live in `convex/` or in a plain `lib/` data file.**
  A Module's `label`/`description`, the nutrient names, the meal names and the
  baby-log event names all moved out, keyed by the union the schema defines
  (`ModuleId`, `NutrientKey`, `MealName`, `BabyEventType`). **When you add a
  Module — or a nutrient, or an event type — add its message entries in the same
  change**; `satisfies Record<…>` makes forgetting a compile error.
- **Non-React code takes messages as a trailing parameter** (`navItems`,
  `getRouteContext`, `formatActivityTime`, `formatAge`, `summarizeEvent`) rather
  than importing the context. That is what keeps `lib/` callable from a test with
  no React tree.
- **A validator returns a key, not a sentence** — `buildEventInput` reports
  `'enterVaccineName'` and the form resolves it.
- **Never read a message inside a `useEffect`** whose deps you do not want the
  locale in. Hold a key in state and resolve it at render; Biome's
  `useExhaustiveDependencies` will point at this and adding the dep is usually
  the wrong fix.

Component tests render through `renderWithI18n` from `src/lib/i18n/testing.tsx`;
`useI18n` throws outside `LocaleProvider` rather than falling back.

## A nested page carries its own trail

Every route below a Module's index renders `<Breadcrumbs>`
(`src/components/app/Breadcrumbs.tsx`) with the trail from that index down to
itself — Foods → *Hagelslag* → Edit, and the equivalent for Recipes and the
Baby log. The shell keeps global navigation; the page owns the local hierarchy,
because the page is the only thing that knows which food this is. See
`docs/adr/0013-a-nested-page-carries-its-own-trail.md`.

**When you add a nested route, give it its trail in the same change.** Nothing
enforces this — there is no registry slot to leave visibly empty, and a page
without one renders perfectly well — so this line is the only thing standing
between the app and a set of pages you can get into but not out of.

Three rules that will bite if ignored:

- **A `Crumb`'s `label` is already in the reader's language.** Half of a trail
  is content — a food's name, a recipe's title — which is never translated
  (ADR-0011), so the page resolves the words and `Breadcrumbs` never reaches
  for a message tree.
- **Back points at the parent's address, never `history.back()`.** Build the
  link with `groupPaths` so the Group travels with it (ADR-0002). Where
  somebody came *from* is not the collection the page belongs to.
- **The page you are on is the one step with no `link`.** That is what makes it
  render as `aria-current="page"` instead of as a link to itself.

Collection indexes get no trail, and neither do flat shell pages (Settings,
Account, Groups) — the shell already names those, and a one-step trail is
chrome that says nothing.

## Responsive action controls

Compact add, edit, delete, and refresh controls show only their icon below
Tailwind's desktop breakpoint (`lg`, 1024px), including on tablets. At `lg` and
above, show the icon and its translated visible label. Every icon-only control
still needs its translated `aria-label`. Keep a textual label when it carries
essential state or workflow context, such as a form submission or confirmation.

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

## CI / deploys / PR previews

The default branch is `main`. There has never been a `master`.

- `.github/workflows/ci.yml` — check/typecheck/test/build gate, `pull_request`
  only. `main` is gated by `deploy.yml`'s `checks` job instead, so a merge
  produces one run rather than two.
- `.github/workflows/deploy.yml` — merge to `main` deploys to **staging**
  (`gather-stg` + the `staging` Convex deployment); `workflow_dispatch` from
  `main` deploys to **production**. One `deploy` job parameterised by
  `github.event_name`, targeting the `stg` / `production` GitHub Environment.
  Both build with `pnpm build` — staging exists to exercise the bundle prod
  ships, so only env vars differ. **There is no deployed dev environment**: dev
  is `pnpm dev` against your own `convex dev` deployment. See
  `docs/adr/0013-staging-deploys-on-merge-production-deploys-on-a-click.md`.
- `.github/workflows/preview.yml` — per-PR Convex preview deployment + per-PR
  Cloudflare Worker (`gather-pr-<N>`) + PR comment + teardown on close.
  It also applies the per-PR Worker's secrets after deploying, because a fresh
  `gather-pr-<N>` starts with none — which is why the in-app issue reporter used
  to answer "not configured" on every preview.

**Secrets and variables.** Which value belongs in which scope is declared in
`env.manifest.ts`, not here, and `pnpm run env:apply <environment>` writes them.
Two things are worth knowing without reading it:

- The `stg` and `production` GitHub Environments hold the **same names** with
  different values. `preview.yml` declares no `environment:`, so it resolves
  **repo-level** names, which carry a `PREVIEW_` prefix.
- Public values are GitHub **variables** (`vars.X`), secrets are GitHub
  **secrets** (`secrets.X`). A value the Vite build reads is always public — it
  is inlined into a downloadable bundle — and the manifest's types enforce that.

**An environment secret shadows a repo secret of the same name.** The `PREVIEW_`
prefix exists so that can never matter: with distinct names, a missing
`production` value fails loudly instead of silently falling back to preview's.
Adding an `environment:` key to `preview.yml` would still be wrong — it would
point previews at staging's or prod's Convex deploy key.

The `staging` Convex deployment is created with
`convex deployment create staging --type prod` — **without** `--default`, which
would hand it the project's default-production slot and make a local
`pnpm run deploy:prod` deploy there instead.

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
