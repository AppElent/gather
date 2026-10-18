---
type: record
kind: research
description: Read when planning gather's adoption of the developer-tools toolkit; how foundry did it, what in gather is covered / kept / upstreamable / stale, a dry-run result, and a migration plan.
version: 1.0.0
date: 2026-10-18
---

# Onboarding gather onto developer-tools — delta against foundry

Read-only research. Sources: `developer-tools` @ `064d78a` (local checkout; main), `foundry` = `/Users/ericjansen/Developer/workouts` @ `main`, gather worktree `t3-4489e1f8` @ `1284b3f`.
Nothing in any repo was modified except this file. The dry-run in §3 was run against the gather worktree and verified to write nothing (`git status` clean, no `.appelent/` created).

## TL;DR

- Foundry's whole adoption was **~11 commits over 13 days (2026-10-01 → 10-13)**, in three distinct moves: (1) install toolkit + shrink CLAUDE/AGENTS, (2) restructure docs into five typed folders, (3) repeatedly re-sync as developer-tools itself reorganized under it. Its CLAUDE.md went 237 → 9 → 5 lines; AGENTS.md is 10 lines; **all project-specific rules live in `CODING_STANDARDS.md` below the managed block, `docs/contracts/`, `docs/runbooks/`, `docs/adr/`**.
- Gather's CLAUDE.md is a different animal: only ~15 % is "how to run things" (covered by config/standards). ~60 % are **gather-specific invariants** (registries that fail typecheck, Drop, seed, photos, group cascade) that must be *kept* but re-homed; ~10 % is **stale or wrong** (§2.1 list); ~15 % is **generic and upstreamable**.
- The sync dry-run against gather: **124 files, 1 conflict** (`scripts/env.mjs`, the thin `@appelent/dev/env` wrapper — exactly what foundry hit; it parked it as `scripts/env-legacy.mjs`). Everything else is ADD; `AGENTS.md`/`CLAUDE.md` get a managed block appended; `CODING_STANDARDS.md` / `DESIGN_SYSTEM.md` are created (gather has neither).
- `appelent.json` is **not retired**: the *toolkit's own scripts* (`env.mjs`, `workspace.mjs`) still read it for `envManifest` and `workspace`. Only its `features`/`guidance`/`baseline` step ledger is legacy. The `appelent` Claude plugin (`/appelent:*`, `appelent-managed` blocks, `guidance` feature) is superseded by developer-tools for everything gather uses.
- Biggest hidden coupling: the standards say "no `@appelent/*` runtime dependency". Gather still depends on `@appelent/auth`, `@appelent/i18n`, `@appelent/dev` via a private GitHub Packages registry (`.npmrc`, `NODE_AUTH_TOKEN` in 3 workflows + SessionStart hook). Foundry dropped these **in a separate commit** (`5d4072b`) *after* docs adoption. Recommend gather do the same — docs adoption first, package drop as its own PR.

---

## 1. How foundry onboarded

### 1.1 What the sync installed (foundry `.appelent/devtools.json`)

Receipt `schemaVersion 1, scope project, ref main, commit 3247bb3…` (stale vs current dev-tools main `064d78a`; PRs #13–#19 have landed since: complexity cost, i18n single catalog, auth web examples, convex-query-caching, Expo Router traps). Tracks:

| Class | Paths | Ownership |
| --- | --- | --- |
| Scripts | `scripts/{baseline,baseline-web,baseline-mobile,check-project,env,workspace,sync-devtools}.mjs`, `scripts/lib/{baseline.mjs,env/*,project/*,workspace/*}` | toolkit-owned; never hand-edit |
| Standards | `docs/standards/*.md` (+ `examples/`, `templates/`), incl. `documentation.md`, `baseline.md`, `baseline/toolkit.md` … | toolkit-owned |
| Doc templates | `docs/{adr,contracts,records,runbooks,standards}/.template.md` | toolkit-owned; docs *created from* them are app-owned |
| Managed blocks | `CODING_STANDARDS.md`, `DESIGN_SYSTEM.md` (`<!-- appelent-standards:start/end -->`); `AGENTS.md`, `CLAUDE.md` (`<!-- appelent-guidelines:start/end -->`) | block toolkit-owned; everything outside the block project-owned |

Skills are **not** part of the sync (`npx skills add …/developer-tools/tree/main/skills`), by design (`validateManifest` rejects `.claude|.agents/skills` destinations).

### 1.2 Resulting structure (foundry today)

- `CLAUDE.md` (5 lines): `Read [AGENTS.md](AGENTS.md).` inside the managed block. Nothing else.
- `AGENTS.md` (10 lines): managed block (read `CODING_STANDARDS.md`; UI → `DESIGN_SYSTEM.md`) + three hand-written routing bullets: domain terms → `GLOSSARY.md`, product behavior → `docs/contracts/`, ops → `docs/runbooks/`, docs → `docs/README.md`.
- `CODING_STANDARDS.md` (~60 lines): managed block (task→standard routing table + "Conform / Improve / Differ") then **project-owned**: *Workspaces* table (path → owns), *Domain documentation* (glossary + ADRs), **Local bindings and exceptions** table (Auth, Localization, CLI, Environments, Worktrees [shared-dev-Convex exception], Test login, Convex query caching, Observability), each = rule, scope, replacement, reason.
- `DESIGN_SYSTEM.md` (~35 lines): managed block + project web/native identity and which components bind to the shared interaction contracts.
- `apps/mobile/CODING_STANDARDS.md` / `DESIGN_SYSTEM.md`: nested project-owned bindings for the mobile workspace (structure bindings, enforcement script `check:mobile-architecture`).
- `docs/README.md` is the **only index**; five typed folders, each with a managed `.template.md` and mandatory frontmatter (`type`, `description` = reader trigger, `version`):
  `standards/` (managed) · `contracts/` (9 files: intended behavior per area) · `adr/` (11, immutable) · `runbooks/` (13: project facts for repeatable tasks) · `records/` (frozen dated evidence, only if a contract/ADR cites it) · plus `agents/` (pointers engineering skills look up by path; `domain.md` is one line pointing at CODING_STANDARDS).
- Where project rules went: invariants → ADR/contract; commands/accounts/names/hazards → runbook (`verification.md` is the binding of `standards/verification.md`; `environment.md`, `worktree-setup.md`, `mobile-releases.md`, `sentry.md`…); the old `.claude/skills/verify/SKILL.md` collapsed from 227 → 1-line pointer to `docs/runbooks/verification.md`; `.claude/commands/upgrade-deps.md` kept (26 lines) and points at `runbooks/dependency-upgrades.md`.
- `README.md` took over setup/commands; the old CLAUDE "Commands" and "Environment Variables" sections went to README + `runbooks/environment.md`; "Architecture" → CODING_STANDARDS *Workspaces* table; "Key Conventions" → standards (Biome/Tailwind/forms) or deleted (config states them).

### 1.3 Commit sequence (foundry)

| SHA | Date | What | Gotchas |
| --- | --- | --- | --- |
| `47910bb` / `89d4583` | 07-09 / 07-14 | Old world: `appelent` plugin mirror, then "feature catalog" (`appelent.json` created) | `.claude/skills/add-cli`, `add-i18n` etc. deleted in favour of plugin |
| `7120e38` | 07-16 | last `appelent.json`/baseline step stamp (step 16 UI hygiene + `appelent-managed` block) | UI-hygiene checklist lived in CLAUDE.md managed block; later became `standards/web-baseline.md` |
| `66a30ef` | 10-01 | **First sync** (`docs: centralize project guidance and archive historical plans`, 149 files). Installed `.appelent/devtools.json`, scripts, `docs/features/*` + `docs/guidelines/shared/*` (old distribution paths), CODING/DESIGN_SYSTEM. CLAUDE.md 237→9. Moved executed plans/specs/review notes to `docs/archive/`. | **`scripts/env.mjs` conflict** with the thin `@appelent/dev/env` wrapper: foundry renamed the old file `scripts/env-legacy.mjs`, repointed `pnpm env:*` at it, let sync install the new `env.mjs`. |
| `981a89f` | 10-08 | Restructure agent guidance: `docs/guidelines/project/*` → root `CODING_STANDARDS.md`/`DESIGN_SYSTEM.md` + `apps/mobile/*`; `docs/sentry.md`+`runbooks/mobile-sentry.md` → `runbooks/sentry.md`; `.claude/skills/verify` 115→ shorter; `design-session` skill thinned | Project-owned guideline files (`project-coding.md`, `app.md`) are *preserved by sync* — you must move their decisions into root files yourself (`standards/baseline/toolkit.md`). |
| `4459b34` | 10-13 | **Adopt the documentation standard** (dev-tools#1): `product/`→`contracts/`, `verification/`+`research/`+`archive/`→dated `records/`, frontmatter everywhere, per-folder indexes→`docs/README.md`, `CONTEXT.md`→`GLOSSARY.md`; deleted executed plans, a broken canvas, uncited evidence assets (377 files, −13.6k lines). | The rename `CONTEXT.md`→`GLOSSARY.md` is a **standard requirement** (`documentation.md` owners table, `general-coding.md`); gather uses `CONTEXT.md` and engineering skills (`docs/agents/domain.md`) read `CONTEXT.md` by path — see §5 risks. |
| `46cfd18` | 10-13 | Sync standards: `docs/features/*/FEATURE.md` → `docs/standards/*.md`; **`docs/guidelines/shared/` removed** (retired path; sync deletes it) | Receipt entries for retired `docs/features`/`docs/guidelines/shared` must be allowed so old receipts load — the sync script still special-cases them (`allowed()`), then removes the files. Links in runbooks/contracts had to be repointed by hand. |
| `4be8d77` `e65ffc8` `d68143a` | 10-13 | Incremental syncs (mobile-structure standard; skill rename `tools-developer`→`developer-tools`; app-cli/mcp/pwa/specialist-skills standards; `docs/features/` fully removed) | Each sync = 1 commit "sync … standards" touching only `.appelent/devtools.json`, root standards blocks, `docs/standards/`. Cheap once adopted. |
| `e4f94b6` | 10-13 | **Prune records to cited evidence**: 9 `.mp4`s and 12 spec/review records deleted; pending acceptance → GitHub issues | Follows `documentation.md` v3 "records only as cited evidence; pending acceptance are issues" (dev-tools#12). |
| `7ee14c5` | 10-13 | sync complexity-cost rule | — |
| `5d4072b` | 10-13 | **Drop `@appelent/*` packages**: copied auth/i18n/cli runtimes into app code (`src/lib/auth`, `src/lib/i18n/runtime`, `cli/runtime`; mobile keeps `i18n/core.ts` copy), switched `env:*` to `scripts/env.mjs`, removed `.npmrc`, `NODE_AUTH_TOKEN` steps (ci/cli/preview), EAS pre-install hook, cooldown exemption | Done *last* and separately; includes porting package tests into the app. |
| `c72e826` etc. | later | `appelent.json` left untouched (last change `70a227f`, 09-22) | See §4. |

Process notes: the Co-Authored-By trailers show the docs standard + sync were driven by an agent against a **local `--source`** dev-tools checkout (commit `4459b34` body: "Toolkit synced from local developer-tools"), before dev-tools PRs merged. No foundry PR numbers appear in history (commits land on `main` directly); upstream work was dev-tools PRs #1–#12.

### 1.4 Foundry gotchas to carry over

1. `scripts/env.mjs` conflict → park legacy wrapper, keep `pnpm env:*` working, repoint later.
2. Sync does not move your docs or fix your links: rename/relink is manual and must happen in the same commit as the move (documentation.md: "Moving a document moves its incoming links").
3. `appelent.json` `workspace` object is still read by `workspace.mjs`; foundry's `scripts/setup-worktree.mjs` still owns worktrees (documented as an exception in CODING_STANDARDS).
4. Foundry documents **binding exceptions in-table** (e.g. "Test login … legacy exception", shared-dev-Convex deployment) rather than prose — copy that pattern.
5. Foundry's receipt is 3 dev-tools PRs behind; the next sync there will surface `convex-query-caching`, auth web examples, `i18n` single-catalog rule. Expect the same for gather's first sync *if* run from GitHub rather than `--source` (GitHub installs only pushed commits).

---

## 2. Gather mapping

Labels: **COVERED** (→ delete/replace with pointer), **KEEP** (→ new home), **UPSTREAM** (generic, candidate dev-tools PR), **STALE** (evidence).

### 2.1 STALE findings (act regardless of migration)

| # | CLAUDE.md claim | Evidence |
| --- | --- | --- |
| S1 | `docs/mobile-interaction.md` "is the decided interaction vocabulary" (L94–104) | File deleted in `637414d` (2026-09-02, "remove outdated mobile interaction documentation"); `ls docs/mobile-interaction.md` → missing. Still cited by CLAUDE.md, ADR-0015/0017/0018/0028, `docs/plans/2026-09-12-mobile-calendar.md`, `designs/group-search/README.md`, the research doc. |
| S2 | `.claude/skills/review-app` and `review-session` are project-local copies of the plugin's (L386–400) | `.claude/skills/` contains only `verify`. `review-session` exists only as a 16-line command that invokes the *global* `custom-review-session` skill. Also cites `D:\Dev\appelent-packages` (Windows path; machine is now macOS) and "Apple targets do not work from Windows". |
| S3 | `@t3-oss/env-core` / `src/env.ts` "currently minimal — not yet wired" (L22–23) | `src/env.ts` derives schemas from `env.manifest.ts` (`schemaFor`, commit `bc423f7`). |
| S4 | `seed` / `deploy:*` run `seedCatalog` only (L53–58) | `package.json`: `seed` and both deploys also run `seed:seedTastingCatalog`. |
| S5 | "Outstanding right now: `declineByOmission`" only (L367–370) | `docs/migrations/README.md` lists **three** active migrations (0005, 0006, 0007). |
| S6 | Convex function inventory (L9–14) and `Dependency status` file list (L29–41) | Hand-copied lists of ~25 files; `convex/` has dozens more (tastings, money, notes, calendar, baby …). Config/source states this; `documentation.md`: "delete … facts that config or source already states". |
| S7 | i18n: "gather owns `src/lib/i18n/` — the `messages/{en,nl}/` trees … `messages.test.ts`" (L281–288) | `src/lib/i18n/` has no `messages/` dir and no `__tests__/`; trees are in `packages/core/src/messages/` (L274–279 of the same section says so — section contradicts itself). `LanguageToggle`/`LanguageSettings` not verified. |
| S8 | verify skill: "Module metadata … lives in `src/lib/modules.ts`" | `src/lib/modules.ts` doesn't exist; it's `packages/core/src/modules.ts` (CLAUDE.md L276 says that). |
| S9 | ADR index (`docs/adr/README.md`) | Missing **0034**; two ADRs share number **0013** (`a-nested-page-carries-its-own-trail`, `staging-deploys-on-merge…`) and two share **0014** (`phone-is-a-clerk-generation-ahead`, `a-variable-declares-its-consumer…`); index lists only one of each. Duplicate numbers violate the template's "number after the highest". |
| S10 | "Known limitation: `AppearanceSettings` hardcodes 'ArchStudio'" (L43–45) | True today (`node_modules/@appelent/auth/dist/index.js:85`), but disappears if the auth runtime is copied (dev-tools `auth/examples/web/AppearanceSettings.tsx` is app-owned). Pure package-defect note → delete on adoption. |
| S11 | `docs/agents/domain.md` template text | References `CONTEXT-MAP.md` multi-context tutorial boilerplate; foundry replaced with 1-line pointer. |
| S12 | "Env vars" `NODE_AUTH_TOKEN` (preview) | Valid today (private registry) but retires with `@appelent/*` removal (foundry `5d4072b`). |

### 2.2 CLAUDE.md, section by section (431 lines)

| Lines | Section | Label | Disposition |
| --- | --- | --- | --- |
| 1–25 | Intro + stack bullets | **COVERED/STALE** | Stack facts live in `package.json`, `wrangler.jsonc`, `biome.json` (S3, S6). Keep one-line project description in README (already there). Tooling rules → `standards/baseline.md` (pnpm/Biome), `web-baseline.md` (Tailwind/Vitest/TanStack), `sentry-monitoring.md`. Worker names → `wrangler.jsonc`. Delete. |
| 27–45 | Dependency status (`@appelent/auth`) | **KEEP → rewrite / STALE (S10)** | Becomes a row in CODING_STANDARDS *Local bindings*: "Auth: `@appelent/auth` package (until copied) + app-owned ClerkProvider/Convex bridge; `--auth-*` token overrides in `src/styles.css`". Vs `standards/auth.md` (already says app owns provisioning/navigation; web examples app-owned). After package drop → bindings row only. |
| 47–58 | Scripts | **COVERED** | `package.json` is the source. Keep the *one* non-derivable fact (Convex has no post-deploy hook outside previews, so `seed*` runs in `deploy:*`) in `docs/runbooks/deploy.md` (new) or `environment.md`. |
| 60–92 | Running & verifying mobile app (dev build, agent-device, OTA/fingerprint, `--environment`) | **Split** | (a) Project facts (`com.appelent.gather`, `gather://`, `Pixel_9_Pro`, `--kind expo`, `devbuild:android`, `update:preview/prod`) → KEEP in `docs/runbooks/mobile-verification.md` + `mobile-releases.md` (binding `standards/verification.md`, `mobile-baseline.md`). (b) "Verify on device not typecheck" → COVERED by `verification.md` + `mobile-design.md` Verify. (c) `agent-device` loop (press/fill/`wait text`, id over text selectors, locale-dependent text) → **UPSTREAM** to `verification.md`/a skill (no dev-tools mention of agent-device: `grep` empty). (d) "Never `eas update` without `--environment`; EXPO_PUBLIC inlined at publish" → **UPSTREAM** to `mobile-baseline.md` (it covers the OTA guard but not this hazard; also `environments.md` L63). (e) Fingerprint/ADR-0029 → KEEP as ADR-0029 (exists). |
| 94–104 | How the phone behaves | **STALE (S1) + COVERED** | Target file is gone. Generic content → `mobile-design.md`, `ios-design.md`, `android-design.md`, `lists.md` (press-and-hold/swipe/selection), `editors.md` (sheets), `general-design.md`. Remaining gather-specific vocabulary (haptics, undo-vs-confirm, pull-to-refresh) → `apps/mobile/DESIGN_SYSTEM.md` (project-owned, as foundry has) distilled from `docs/research/mobile-interaction-vocabulary.md`; the rule "don't draw what the platform can draw" is already in `mobile-baseline.md` ("native navigation and platform controls"). Fix dangling links in ADRs/plans in the same commit. |
| 106–130 | Sharing into the app (Drop) | **KEEP** | `dropTargets.ts` exhaustive-record registry + "host rules preselect and never restrict" + "Drop is native surface / fingerprint / cannot be driven by agent-device" → ADR-0028 already holds the decision; put the *checklist* into `docs/runbooks/add-a-module.md` (see below) and the `gather://` Drop harness verification procedure into `runbooks/mobile-verification.md`. Gather-specific; not upstreamable. |
| 132–164 | Seed data | **KEEP** | ADR-0004 exists. Move "when you add a Module add seed contribution" → `add-a-module.md`; Catalog vs Sample mechanics (`seedKey`, `seedRuns`, cascade-on-reset) → `docs/contracts/seed-data.md` (behavior contract); `PREVIEW_TEST_USER` / `--preview-run` takes no args hazard → `docs/runbooks/previews.md` (binding `standards/previews.md`, which has the workflow template and "seed function must be safe for a disposable backend"). |
| 166–214 | Env vars | **COVERED + KEEP hazards** | Routing/Infisical/targets/`env:check` → `standards/environments.md` + `env.manifest.ts` + ADR-0014(variable). Var *lists* → `env.manifest.ts`/`.env.example` (source states them) → delete lists. Keep in `docs/runbooks/environment.md`: target mapping (`local→dev`, `preview/stg→staging`, `production→prod`), `/gather` overrides root, **`ENABLE_SAMPLE_DATA` must never be set on prod**, Notion/Todoist redirect URI `<origin>/integrations/callback`, "preview Convex backends don't inherit dev/prod env → `convex env default set --type preview`". Metro inlines `EXPO_PUBLIC_*` → UPSTREAM (above). |
| 216–245 | Photos | **KEEP (+UPSTREAM)** | ADR-0010 exists. `photoPresets.ts` single table, `FILE_HOLDERS` typed-off-schema registry, "bytes go up before the row exists", `deleteStoredFile` after write → `docs/contracts/stored-files.md` (+ one row in `add-a-module.md`: "new `_storage` column ⇒ list in `FILE_HOLDERS`"). RN "read local file with `expo-file-system`, not `fetch`; `File(uri).upload()` sets Content-Type" → **UPSTREAM** `mobile-coding.md`/`mobile-baseline.md` (generic RN+Convex trap, includes 14-byte-body evidence). Unauthenticated non-expiring `storage.getUrl` risk statement → contract. Note: list has 3 bullets under "Two rules" (miscount). |
| 247–270 | Deleting a Group / account | **KEEP** | ADR-0032/0030 exist. `groupCascade.ts` derived-from-schema registry, 3 hand-listed child tables, Convex-first/Clerk-second, `users.deletedAt`, `deleteSelfEnabled` (Clerk Dashboard "Delete self") → `docs/contracts/account-deletion.md` (behavior) + row in `add-a-module.md` ("new `groupId` table ⇒ `groupCascade.ts` entry"). No dev-tools standard on account deletion (grep: none). Candidate later UPSTREAM to `auth.md` (generic "Clerk delete-self flag must be checked before purge") — low priority. |
| 272–314 | Internationalization | **COVERED + KEEP + UPSTREAM** | COVERED by `standards/i18n.md`: English source + `satisfies`, one catalog / data-only messages (v2.0.0; verify gather conforms — it may have `Record<Locale,…>` leaks; foundry enforces via `check:mobile-architecture`), pure modules take messages as args, test utils example (`renderWithI18n` ≈ `examples/test-utils.ts`). KEEP gather-specific: tree lives in `@gather/core`, Module label/description + `NutrientKey`/`MealName`/`BabyEventType` keyed `satisfies Record<…>` ("add messages in same change") → `add-a-module.md` + CODING_STANDARDS bindings row "Localization"; Dutch glossary stays in ADR-0011. UPSTREAM candidates → `i18n.md`: (1) "a validator returns a key, not a sentence"; (2) "never read a message inside a `useEffect` whose deps shouldn't contain locale — hold a key in state"; (3) "display strings never in backend/plain data files; key tables by schema union with `satisfies Record`". |
| 316–344 | Nested page carries its trail (Breadcrumbs) | **KEEP + UPSTREAM** | ADR-0013 (trail) exists. "When you add a nested route, give it its trail" → checklist in `add-a-module.md` + `docs/contracts/navigation.md`. Generic rules (back = parent address, never `history.back()`; page itself has no link / `aria-current="page"`; labels already localized) → **UPSTREAM** `web-design.md` (it has nothing on breadcrumbs: grep empty). |
| 346–352 | Responsive action controls | **UPSTREAM** | Icon-only below `lg` (1024px), icon+label at `lg`, always translated `aria-label`. `web-design.md` / `general-design.md` have no equivalent (grep for icon-only/breakpoint empty; `aria-label` only in `web-baseline` UI-state notes). Until merged: `DESIGN_SYSTEM.md` project decision. |
| 354–373 | One-shot code states its end condition | **UPSTREAM** | Generic and valuable: not in `general-coding.md`/`documentation.md` (grep empty). Target `general-coding.md` (new "One-shot code" subsection). Project residue ("Outstanding: …") is STALE (S5) → belongs only in `docs/migrations/README.md`. `legacyPaths.ts` anecdote → drop. NB `documentation.md` says one-off work is "an issue and its PR, not a runbook" which conflicts with gather's `docs/migrations/` convention (§2.3). |
| 375–384 | CI / PR previews | **COVERED** | `standards/previews.md` (template `previews/templates/preview.yml`, same-repo PRs only, seed on fresh backend) + `standards/baseline.md` (CI gates). Keep gather facts (secret names, Clerk *test* instance rule for inlined test-user creds) in `runbooks/previews.md`. |
| 386–400 | Claude Code workflow layer | **STALE (S2) / COVERED** | Replaced by `npx skills add …developer-tools…` (review-app, upgrade-dependencies, workflow-*), and by `documentation.md` owners table. Delete section; remove `.claude/commands/upgrade-deps.md` copy in favour of `runbooks/dependency-upgrades.md` + shared skill (foundry kept a thin command). `verify` skill → 1-line pointer to `runbooks/verification.md` (foundry pattern). |
| 402–417 | Agent skills (issue tracker, triage, domain) | **KEEP (shrink)** | Keep `docs/agents/*` as path-lookup pointers (foundry pattern); drop CLAUDE.md section; AGENTS.md has one bullet. |
| 419–431 | Appelent Managed Project block | **STALE/superseded** | `appelent` plugin catalog replaced by developer-tools (§4). Remove in the same change that installs the managed blocks. |

Also in `AGENTS.md` (40 lines): "Upgrading dependencies" (**COVERED** by `upgrade-dependencies` skill + runbook), "Running and verifying the mobile app" (duplicate of CLAUDE.md L60–78 — **delete one**), `appelent-managed` block (**STALE**).

### 2.3 docs/ subfolders and top-level files

| Path | Size | Label | Disposition (foundry analogue) |
| --- | --- | --- | --- |
| `CODING_STANDARDS.md`, `DESIGN_SYSTEM.md` | absent | — | Created by sync. Fill project section: Workspaces table (`src/`, `convex/`, `apps/mobile/`, `packages/core/`), *Local bindings and exceptions* (Auth, Localization, Env, Worktrees [t3.json/`copy-env.sh` vs `workspace.mjs`], Test login, Sentry, Query caching, PWA `generate-sw.mjs`). `DESIGN_SYSTEM.md`: sea/lagoon palette, `.rm-panel`, responsive action controls, Breadcrumbs, link to `apps/mobile/DESIGN_SYSTEM.md`. |
| `AGENTS.md` (40 l) | | **KEEP, rewrite** | → ~12 lines: managed block + routing bullets (glossary, contracts, runbooks, docs map, "adding a Module → runbook"). |
| `CONTEXT.md` (581 l) | | **KEEP** | Domain glossary + "Standing rules" (L532+). `documentation.md` mandates `GLOSSARY.md`; foundry renamed (`4459b34`). Rename → also update `docs/agents/domain.md`, ADR index "Key implementation references" (`CONTEXT.md` ×6), CLAUDE.md, `docs/adr/*`, `convex` comments. **Split "Standing rules"** (L532–581) into contracts/ADRs — they are behavior rules, not vocabulary. 581 lines is ~3× foundry's glossary; consider trimming. |
| `README.md` (165 l) | | **KEEP** | Add docs map pointer; remove "See CLAUDE.md for the full architecture and conventions" (L7); drop `NODE_AUTH_TOKEN` setup if packages dropped. |
| `docs/adr/` (38 files incl. index) | | **KEEP** | Add frontmatter (`type: decision`, `status`, `date`, `version`) — gather uses `Status: accepted (date)` prose. Fix S9 duplicates (renumber is not allowed for accepted ADRs; foundry says "gaps are intentional" — pick next free numbers for the *newer* duplicate and fix inbound links, or document as known). Delete `adr/README.md` index (single index = `docs/README.md`; foundry removed its adr README in `4459b34`). **Candidate supersession**: ADR-0014(variable) vs `standards/environments.md` — decision is gather's manifest design; keep, but its mechanics overlap the standard, so mark partly superseded only after sync verifies gather's `env.manifest.ts` against the installed `lib/env` engine (`env:check` parity). ADR-0013(staging deploys on merge) overlaps `previews.md`/CI → keep (it's a trade-off). |
| `docs/agents/` | 3 | **KEEP (shrink)** | `domain.md` → one line pointing at CODING_STANDARDS (foundry). `issue-tracker.md`/`triage-labels.md` stay (skills read by path); note dev-tools `issue-reporting.md` dropped "issue tracking" in PR #3 — these are the engineering-skill convention, separate. |
| `docs/briefs/` | 5 | **STALE → records or delete** | Prototype session coordination ledgers (`tasks-prototype-result.md` etc.). Per `documentation.md`: keep a record only if a contract/ADR cites it. Check ADR-0034 (notes/tasks/calendar separate modules) cites them → if yes convert to `docs/records/YYYY-MM-DD-*.md` with frontmatter; else delete (git keeps). Foundry deleted `docs/product/*` briefs after distilling into contracts. |
| `docs/migrations/` | 8 | **KEEP active / delete done** | Foundry rule: one-off work = issue + PR; runbook only while needed. 0001–0004 (done) → delete unless an ADR cites (ADR-0022 cites 0007 only; `convex/maintenance.test.ts` cites 0003/0005/0006 in comments). 0005–0007 active → convert to `docs/runbooks/` (foundry pattern: `exercise-migration.md`, `nutrition-account-migration.md` = runbooks) or GitHub issues. **Caution:** `convex/migrations.ts` header and CLAUDE.md "One-shot code" rule point at `docs/migrations/` as the retirement ledger → relink in same commit. README retirement table is excellent; carry it into a single `runbooks/migrations.md`. |
| `docs/plans/` | 3 | **STALE** | Executed plan/handoffs (mobile calendar 550 l, progress, redesign). `documentation.md`: "Plans, specs, and reviews live in the issue or PR"; foundry deleted executed plans (`4459b34`). Check each against merged code → delete executed; move lasting behavior to a contract (`contracts/calendar.md`). |
| `docs/research/` | 6 (~3.6k l) | **KEEP selectively → records** | Mobile Clerk/Convex/i18n/router/styling/interaction research. Becomes `docs/records/YYYY-MM-DD-*.md` **only if cited** (ADRs 0014/0017 cite them). Uncited → delete. `mobile-i18n-react-native.md` and `mobile-clerk-expo.md` likely superseded by `standards/i18n.md`/`auth.md` (both cover native) → candidates to delete or mine for UPSTREAM facts. `mobile-interaction-vocabulary.md` is the only record of S1's content → keep until `apps/mobile/DESIGN_SYSTEM.md` absorbs it. |
| `docs/review-notes/` | 1 (309 l) | **STALE** | `review-2026-08-02-1312.md`, pre-restyling PR #27 review session with `D:/Dev` path. Delete (foundry deleted its review notes in `e4f94b6`). |
| `docs/superpowers/` | 27 | **STALE** | Plans/specs from the superpowers workflow (2026-06 → 08). Foundry archived then deleted equivalents (`66a30ef` archive → `4459b34`/`e4f94b6` removal). Includes `guidance-docs-feature` plan/spec for the retired `guidance` catalog feature (obsolete). Delete all; any still-load-bearing behavior → contracts. Also `.superpowers/sdd` dir at repo root. |
| `docs/mobile-settings-backlog.md` | 1 | **STALE** | Self-declared "Nothing here is decided". Backlog → GitHub issue; delete. |
| *(no `contracts/`, `runbooks/`, `records/`, `standards/`)* | | **ADD** | New: `contracts/` (seed-data, stored-files, account-deletion, navigation, modules/…, drop-sharing), `runbooks/` (add-a-module, environment, mobile-verification, mobile-releases, previews, deploy, migrations, dependency-upgrades), `records/` (cited research only). |
| Other root: `.cursorrules` (115 l), `.claudeignore`, `.design-sync/*`, `.worktreeinclude`, `t3.json`, `scripts/copy-env.sh` | | **Review** | `.cursorrules` is a second agent-instructions copy (violates documentation.md "one owner") → shrink to pointer. `.worktreeinclude` + `t3.json copy-env.sh` overlap `workspaces.md` (`workspace.mjs prepare --editor t3`) — decide per foundry's documented exception pattern. |

### 2.4 `add-a-module.md` — the single highest-value KEEP

CLAUDE.md distributes "when you add a Module/route/column, also …" across 7 sections; CLAUDE.md itself says four of these *fail silently* and are "kept honest only by a line in this file". Consolidate into one runbook (`type: runbook`, "Read when adding a Module, a nested route, a stored-file column, or a groupId table") with a table:

| Registry | Fails typecheck? | Where |
| --- | --- | --- |
| `apps/mobile/src/drop/dropTargets.ts` (`Record<ModuleId,…>`) | **yes** | ADR-0028 |
| `convex/lib/groupCascade.ts` (derived from `groupId` tables) | **yes** | ADR-0032 |
| `convex/lib/storedFiles.ts` `FILE_HOLDERS` (typed off schema) | **yes** | ADR-0010 |
| Module messages in core trees (`satisfies Record<ModuleId…>`) | **yes** | ADR-0011 |
| `moduleDestination.ts`, seed contribution (`lib/seed/`), `<Breadcrumbs>` trail, `quickActions.ts` | **no — silent** | this runbook only |

Also list `packages/core/src/modules.ts`. This is gather-only knowledge; not upstreamable, and it follows foundry's runbook definition ("project facts for a repeatable task"). Optional follow-up: a gather `check:architecture` script (foundry has `check:mobile-architecture` pattern from `standards/mobile-structure.md` example) so the four silent ones stop being prose.

---

## 3. Dry-run simulation

**Safety check.** `sync()` in `scripts/sync-devtools.mjs`: the `--dry-run` branch returns at L249 (`if (options.dryRun) { log('Preview only…'); return; }`) *before* `withLock`/`atomic`/`rm`. All pre-return code is `inspect()` (lstat+readFile) and, for `--source`, local reads. No network (`--source` avoids `gh`). So `--dry-run --source` is side-effect free. Verified: `git status --short` empty after; no `.appelent/` directory.

Command run (from the gather worktree, no copy needed):

```sh
node /Users/ericjansen/Developer/developer-tools/scripts/sync-devtools.mjs \
  --dry-run --source /Users/ericjansen/Developer/developer-tools --path .
```

Full output: `/tmp/gather-dryrun.txt` (129 lines). Summary:

- `Source: AppElent/developer-tools@local; 124 distributed files`.
- **ADD** 123: five `.template.md`; 86 files under `docs/standards/` (standards + examples/templates) (app-cli, auth/web, convex-query-caching, environments, i18n, mobile-baseline, mobile-structure, previews, pwa, sentry, web-baseline, workspaces); `scripts/{baseline*,check-project,workspace,sync-devtools}.mjs` and `scripts/lib/{baseline,env/*,project/*,workspace/*}`; root `CODING_STANDARDS.md`, `DESIGN_SYSTEM.md`.
- **UPDATE** 3: `AGENTS.md` (managed block appended after the existing `appelent-managed` block — different markers, so no conflict), `CLAUDE.md` (block appended), and **`scripts/env.mjs`**.
- **CONFLICT** 1: `scripts/env.mjs` — gather's version is the 5-line `@appelent/dev/env` wrapper, no receipt exists, content ≠ distributed → "preserve and reconcile". Exit code 1, nothing written. (Same as foundry `66a30ef`.) Note `scripts/generate-sw.mjs` (gather) vs `standards/pwa/templates/generate-sw.mjs` (lands under `docs/standards/`, no clash).
- Not conflicts but worth noting: gather already has `package.json` scripts `env:check|apply|generate|plan` → `node scripts/env.mjs …`; after resolving, these work unchanged against the vendored engine (dev-tools `env.mjs` is a drop-in with `--path`). `env.manifest.ts` imports nothing from `@appelent/dev` (`grep -rn "@appelent/dev"` hits only `package.json` L79 and `scripts/env.mjs`), so the manifest should load; **must be verified with `node scripts/env.mjs check`** (loader uses Node type-stripping; `env.manifest.ts` must use `import type`, erasable types only — `env.manifest.ts` is 652 lines, risk is real).
- `appelent.json` is read by `scripts/lib/project/manifest.mjs` `validateManifest`; gather's (`features.{baseline,auth,i18n,guidance}`) validates (features need positive-int `version`; unknown names allowed). No change required.

**To resolve the conflict (foundry method):** `git mv scripts/env.mjs scripts/env-legacy.mjs`; repoint the 4 `env:*` scripts at it; run sync; `pnpm env:check`; then switch scripts back and delete `env-legacy.mjs` (foundry did the switch-back in `5d4072b`, bundled with package removal).

---

## 4. appelent.json / `appelent` plugin vs developer-tools

Evidence:

- developer-tools `docs/proposals/toolkit-simplification.md` §2: intent is to "remove the requirement to install an AppElent plugin or published developer CLI"; the sync README lists the "legacy guideline bundle exporter, platform catalog, skill catalog … adjacent CLI launcher" as **retired**. `baseline.md` §Migration: "Replace `appelent recipe … baseline.config`… Preserve prior recipe receipts and feature records as historical evidence… Do not infer that old numbered steps are all complete." `web-baseline.md` L51 maps the old 16 steps to standards.
- `standards/workspaces.md`: "Retain the existing `appelent.json` workspace object and `env.manifest.ts` during extraction… **Legacy `features` metadata is accepted for compatibility but does not drive a new capability engine.**" Code: `scripts/lib/project/manifest.mjs` (`MANIFEST_FILE = "appelent.json"`) is still the config file of `env.mjs`/`workspace.mjs` (`envManifest`, `workspace`, `targets`, `guidelines`).
- Foundry kept `appelent.json` verbatim (`{envManifest, features:{baseline v6 steps[6,14,15,16], auth, cli, mcp, i18n}}`), last changed 2026-09-22 (`70a227f`); `docs/README.md` at `66a30ef` calls it: "`appelent.json`'s existing feature versions are legacy adoption records, not evidence that the new runtime migrations passed."
- The `guidance` feature in gather's `appelent.json` is dead: `1a8c271` states "guidance catalog feature was removed in appelent-packages 0.3.0"; the file it governed is deleted (S1).

**Verdict.** *Overlap, with a clear winner*: developer-tools supersedes the plugin for standards, templates, scripts, skills; `appelent.json` survives **as the config file** the vendored scripts read, with its `features` ledger frozen as history. The `appelent-managed` CLAUDE/AGENTS block and `/appelent:*` slash commands should stop being used (they can regenerate stale blocks).

**Recommendation for gather:** keep `appelent.json`; delete the `guidance` entry (dead); freeze the `features` block (don't bump); add nothing. Optionally add a `workspace` object only when adopting `workspace.mjs`. Remove `appelent-managed` blocks from CLAUDE.md/AGENTS.md. Don't run `/appelent` updates again. If ever desired, a dev-tools issue could rename the config (the file name is the lingering `appelent` coupling) — outside scope.

---

## 5. Proposed migration plan for gather

Principles from foundry: land docs adoption separately from runtime/package migration; sync from a *pushed* dev-tools main (not `--source`) so the receipt's `commit` is real; commit the sync alone ("docs: sync developer-tools standards"); move docs and relink in the same commit.

**PR 0 — safe cleanups (no toolkit yet, ~½ day).** Fix stale facts that mislead agents today: S1 (dangling `mobile-interaction.md` links in 8 files), S2, S3, S4, S5, S7, S8, S9 (ADR index + duplicate numbers), delete `docs/review-notes/`, `docs/mobile-settings-backlog.md`. Pure docs; no risk.

**PR 1 — install toolkit (≈1 commit, mechanical).**
1. Copy `scripts/sync-devtools.mjs` from dev-tools main (reviewed) into `scripts/`.
2. Park `scripts/env.mjs` → `scripts/env-legacy.mjs`; repoint `env:*` scripts.
3. `node scripts/sync-devtools.mjs --dry-run` (expect 0 conflicts) then real run from GitHub main; `--check` offline.
4. `node scripts/env.mjs check` + `plan local --only file` to verify the vendored engine against `env.manifest.ts` (fix `import type` issues if the Node loader rejects). Then switch `env:*` back, delete `env-legacy.mjs`.
5. `node scripts/check-project.mjs`; install skills: `npx skills add https://github.com/AppElent/developer-tools/tree/main/skills --skill '*' -a claude-code codex`.
6. Remove `appelent-managed` blocks; delete `guidance` from `appelent.json`.

**PR 2 — shrink agent files + project standards (~1 day).**
- `CLAUDE.md` → 3 lines (`Read [AGENTS.md](AGENTS.md).` in managed block). `AGENTS.md` → ~12–15 lines (managed block + routing bullets + "adding a Module/route/column → `docs/runbooks/add-a-module.md`"). `.cursorrules` → pointer.
- Fill `CODING_STANDARDS.md` project section (~70–90 lines: Workspaces, Domain docs, bindings/exceptions table) and `DESIGN_SYSTEM.md` (~40 lines). Add `apps/mobile/{CODING_STANDARDS,DESIGN_SYSTEM}.md` (~40 + ~60 lines, absorbing mobile-interaction vocabulary).
- Write runbooks: `add-a-module`, `environment`, `mobile-verification`, `mobile-releases`, `previews`, `deploy`, `verification`, `dependency-upgrades`, `migrations`; contracts: `seed-data`, `stored-files`, `account-deletion`, `navigation`, `drop`, and a module contract per active module as capacity allows. Move CLAUDE.md L106–345 content accordingly (§2.2). `.claude/skills/verify` → 1-line pointer.
- **Resulting sizes:** CLAUDE.md 431 → **3 lines**; AGENTS.md 40 → ~14; CODING_STANDARDS.md ~110 (≈45 managed + ~70 project); DESIGN_SYSTEM.md ~35 (managed) + project ~30. The ~230 lines of KEEP content land in ~10 runbooks/contracts of 40–120 lines each (loaded on demand, not on every session). Net always-loaded context ≈ 3 + 14 lines vs 431 + 40 today.

**PR 3 — doc restructure (the `4459b34` analogue; large diff, review by folder).**
- `docs/README.md` as sole index (delete `docs/adr/README.md`); frontmatter on every ADR/runbook/contract.
- `CONTEXT.md` → `GLOSSARY.md` + split "Standing rules"; update `docs/agents/domain.md` and all links. **Coordinate with the engineering-skills that read `CONTEXT.md` by path** (domain.md says "CONTEXT.md … read these"); foundry's `docs/agents/domain.md` now points at CODING_STANDARDS, which is the lookup indirection that makes the rename safe.
- Delete: `docs/superpowers/` (27), `docs/plans/` (3), `docs/briefs/` (5, unless cited), `docs/research/` uncited, completed `docs/migrations/0001–0004`; convert active migrations to runbooks; relink `convex/migrations.ts` header and `maintenance.test.ts` comments.
- ~8.9k lines of docs → expected ~2.5–3k.

**PR 4 — separate: drop `@appelent/{auth,i18n,dev}`** (foundry `5d4072b` analogue). Copy dev-tools `auth/examples/web/*` and `i18n/examples/*` into app-owned dirs, redirect imports (`src/routes/*`, `Topbar.tsx`, `src/lib/i18n/*`, `styles.css` token import, mocks in `-sign-in.test.tsx`), port package tests, remove `.npmrc` registry line, `NODE_AUTH_TOKEN` from `ci.yml`/`preview.yml`(×2)/`deploy.yml`(×2), SessionStart hook step (a), README setup paragraph, `package.json` L79 `@appelent/dev`. Resolves S10/S12 and the `AppearanceSettings` "ArchStudio" bug as a side effect. Do `i18n` carefully: gather's SSR locale code (`server.ts`) already hand-rolls part of `createGetSsrLocale`.

**PR 5 — upstream PRs to developer-tools** (small, one per standard; use `developer-tools` / `capture-guidance` skills):
1. `general-coding.md`: one-shot code states its end condition.
2. `web-design.md`: responsive action controls (icon-only < lg); breadcrumbs/back-is-an-address.
3. `i18n.md`: validators return keys; no message reads in effects; schema-union-keyed message tables.
4. `mobile-baseline.md`: `eas update` always with `--environment`; `EXPO_PUBLIC_*` inlined at publish; RN local-file upload via `expo-file-system` not `fetch`.
5. `verification.md` or a skill: `agent-device` verification loop and id selectors.

### Risks

| Risk | Mitigation |
| --- | --- |
| **Private-package coupling**: docs adoption works with packages present, but `i18n.md`/`auth.md` say "no @appelent dependency"; leaving them creates a documented deviation | Record the deviation in CODING_STANDARDS bindings until PR 4; do PR 4 before declaring adoption complete |
| `scripts/env.mjs` swap changes live env flows (`env:apply` routes to GitHub/Convex/Workers/EAS) | Run `check`/`plan --only file` only; never `apply` remote during PR 1; keep legacy wrapper until parity proven; `env.manifest.ts` (652 l) must satisfy Node type-stripping |
| `CONTEXT.md` rename breaks skills/ADR links/comments in `convex/` | Do rename with ripgrep-driven relink in one commit; keep `docs/agents/domain.md` pointing at the new name |
| Deleting `docs/migrations/` loses retirement ledger referenced by code comments, tests and the "one-shot code" rule | Keep active entries as runbooks, relink code comments, upstream the end-condition rule so it lives in a standard |
| Agent sessions currently rely on CLAUDE.md invariants; shrinking to 3 lines silently drops the "fail silently" checklist | Land `add-a-module.md` and the AGENTS.md trigger *in the same PR* as the shrink; consider a `check:architecture` script |
| Mass deletion (superpowers/plans/research) removes still-useful rationale | Conform to foundry's rule — keep only what a contract/ADR cites; git history retains the rest; list deletions in the PR for review |
| Duplicate ADR numbers (0013, 0014) | Decide numbering fix first (new numbers for the later-added duplicates) and update inbound links; do not edit accepted ADR substance |
| Sync from `--source` records `commit: local`, no pinned revision | Push dev-tools main first (it is `064d78a`; verify pushed) and sync without `--source` |
| `.cursorrules`, `t3.json copy-env.sh`, `.worktreeinclude` vs `workspace.mjs` overlap | Treat like foundry: document the exception in CODING_STANDARDS, adopt `workspace.mjs` later |
| Windows-era assumptions (`D:\Dev…`, `.claude/hooks/session-start.mjs` "cross-platform Windows local") | Audit while shrinking; machine is macOS now |

---

## 10-line summary

1. Foundry adopted via ~11 commits (10-01 → 10-13): first sync `66a30ef`, doc-standard restructure `4459b34`, repeated cheap re-syncs, package drop `5d4072b` last.
2. Sync installs 124 files: `docs/standards/**`, five `.template.md`, `scripts/**`, plus managed blocks in `AGENTS.md`/`CLAUDE.md`/`CODING_STANDARDS.md`/`DESIGN_SYSTEM.md`; skills are separate.
3. Foundry's CLAUDE.md is 5 lines, AGENTS.md 10; project rules live below the managed block in `CODING_STANDARDS.md`, plus `docs/{contracts,runbooks,adr,records}`.
4. Dry-run on gather is provably write-free and shows 123 ADD, 3 UPDATE, **1 conflict (`scripts/env.mjs`, the `@appelent/dev` wrapper)** — foundry resolved it by parking `env-legacy.mjs`.
5. Gather's CLAUDE.md: ~15 % covered by standards/config, ~60 % KEEP (re-home to runbooks/contracts/ADRs — notably a consolidated `add-a-module.md`), ~15 % upstreamable, ~10 % stale.
6. 12 stale items found, e.g. the deleted `docs/mobile-interaction.md` still cited in 8 files, nonexistent review-app skills, duplicate ADR numbers 0013/0014, wrong `src/env.ts`/seed/migration claims.
7. Upstream candidates: end-condition for one-shot code, responsive icon-only controls + breadcrumbs, i18n key-not-sentence/useEffect rules, `eas update --environment` + RN `fetch(file://)` trap, agent-device loop.
8. `appelent.json` stays (vendored `env.mjs`/`workspace.mjs` still read it); its `features`/`guidance` ledger is legacy; the `appelent` plugin and `appelent-managed` blocks are superseded.
9. Plan: PR0 stale cleanup → PR1 install + env swap → PR2 shrink CLAUDE.md 431→3 lines (AGENTS ~14) + runbooks → PR3 doc restructure/`GLOSSARY.md` → PR4 drop `@appelent/*` → PR5 upstream PRs.
10. Top risks: private-package coupling, live env-flow swap, `CONTEXT.md` rename vs skills, losing the silent-registry checklist, migration-ledger references in `convex/`.
