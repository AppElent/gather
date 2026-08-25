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

## Running and verifying the mobile app

`apps/mobile` is built and driven with two things, neither of them a local script:

- **A development build** — `pnpm --filter @gather/mobile devbuild:android` once,
  then `pnpm --filter @gather/mobile start:dev-client` for every session after.
  Rebuild only on native dependency, `app.json`, or config-plugin changes.
- **[`agent-device`](https://github.com/callstack/agent-device)** for emulator and
  app automation — installed globally, shared by every mobile project. Android app
  id `com.appelent.gather`, scheme `gather://`, AVD `Pixel_9_Pro`, Metro `--kind expo`.

**Verify a mobile change on the device, not with `typecheck` alone.** `open`, then
`press`/`fill`/`scroll --settle` reading the UI diff each action returns, then
`wait text "..."` to assert the end state — a screenshot on its own is not
verification. Command table and the full loop are in `apps/mobile/README.md`.

Selector note: the UI is translated, so `text` selectors are locale-dependent
(`Recepten`, not `Recipes`). Prefer `id` selectors; `testID` maps to Android's
`resource-id`. Apple targets do not work from Windows.

**A JavaScript change ships over the air; a native one needs a build, and says
so itself.** `expo-updates` runs the `fingerprint` runtime-version policy, so
Expo hashes the native dependency set, the config plugins and `app.json` — a
native change moves the hash and installed builds simply never see the update.
Publish with `pnpm --filter @gather/mobile update:preview` / `update:prod`, both
of which pair `--channel` with `--environment`. **Never publish without
`--environment`**: `EXPO_PUBLIC_*` values are inlined into the bundle at publish
time, so a bare `eas update` bakes in the publishing machine's `.env.local` and
points production phones at the dev backends. The app has no update UI by
decision, and nothing under `apps/mobile/src/` imports `expo-updates` — an
update applies silently on the next launch. `expo-updates` is inert in a debug
build, so the dev client cannot verify any of this; a release APK from
`build:preview:android` can. See ADR 0028 and `apps/mobile/README.md`.

## How the phone behaves

`docs/mobile-interaction.md` is the decided interaction vocabulary for
`apps/mobile` — press-and-hold, swipe, haptics, sheets, undo-vs-confirm,
loading, empty states, pull-to-refresh. It is short and prescriptive; the
research and the rejected alternatives are in
`docs/research/mobile-interaction-vocabulary.md`.

**A new mobile screen follows it, and a rule that turns out wrong is changed
there rather than excepted in a component.** The rule underneath all of it:
don't draw what the platform can draw.

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

Phone (`apps/mobile/.env.local` for local runs; EAS environments named
`development` / `preview` / `production` for builds and over-the-air publishes):
`EXPO_PUBLIC_CONVEX_URL`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (both required —
`src/auth/config.ts` and `src/convex/provider.tsx` throw at import without
them), `EXPO_PUBLIC_TEST_USER_EMAIL` / `EXPO_PUBLIC_TEST_USER_PASSWORD`
(optional, the dev-only test-login shortcut; set in no EAS environment, so it
does not appear on cloud builds). Metro **inlines** these at bundle time by
textually substituting `process.env.EXPO_PUBLIC_NAME`, which is why static dot
access is load-bearing at every call site and why `eas update` must always be
given `--environment`.

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

## Photos

Every stored photo is **prepared, never stored as chosen** (ADR-0010), and the
only place a dimension or a JPEG quality may be written down is
`packages/core/src/photoPresets.ts` — one table, shared by the web and the
phone, so two clients cannot answer "how big is a memory photo" differently.
Call sites name a preset and pass nothing else. **Adding a fourth is a change
there, not a new number at a call site.**

Two rules the Memory upload established:

- **A stored file is registered in `convex/lib/storedFiles.ts`.** `FILE_HOLDERS`
  is typed off the schema, so a new `_storage` column fails to compile until it
  is listed — which is what stops a blob being deleted out from under the one
  table nobody registered. Every path that orphans a file calls
  `deleteStoredFile` / `replaceStoredFile` *after* the write that let go.
- **The bytes go up before the row exists.** Convex's upload is a handshake
  that only ends in an id, so the id is passed *into* the mutation and never
  patched on afterwards. A save whose upload failed never became a row. The
  photo is always optional, so "save without it" is the fallback rather than a
  retry queue.
- **On the phone, a local file is read with `expo-file-system`, never with
  `fetch`.** React Native does not implement the `file://` scheme: `fetch(uri)`
  answers a 14-byte body reading "File not found", which then uploads as a
  perfectly valid corrupt image. `File(uri).upload()` also sets the exact
  `Content-Type` Convex insists on — an empty one is a `BadHeader` 400.

`ctx.storage.getUrl` returns an unguessable but unauthenticated URL that does
not expire. That is accepted for avatars, headers and keepsakes; it would not
be for anything a household would mind being readable by whoever holds a link.

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

Outstanding right now: `convex/migrations.ts` → `declineByOmission`, which is
waiting on a production run before it and the `babies.trackedTypes` column can
go (`docs/migrations/0007-baby-tracked-types-become-declines.md`). Run it with
`npx convex run migrations:declineByOmission --prod`.

`src/lib/legacyPaths.ts` was the cautionary case: excellent about why it existed,
silent about when it stopped, and on course to outlive every link it served.

## CI / PR previews

- `.github/workflows/ci.yml` — check/typecheck/test/build gate on push to `main`
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
