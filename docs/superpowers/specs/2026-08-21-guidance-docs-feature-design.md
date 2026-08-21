# A `guidance` catalog feature for cross-project AI-session guidance docs

Decided 2026-08-21. Follow-up to `docs/mobile-interaction.md` (2026-08-21),
which established the two-file pattern (a short prescriptive "decided" doc
plus a companion research doc) this design generalizes and makes reusable
across AppElent apps.

## Problem

`docs/mobile-interaction.md` + `docs/research/mobile-interaction-vocabulary.md`
worked well for gather's mobile app: a short, obeyed-by-default doc telling
future AI sessions what a press does, what buzzes, what appears while things
load — backed by a research doc with the reasoning and rejected alternatives.

Two more such docs are wanted next: **web interaction** conventions and
**CI/CD** conventions. Beyond that, more areas will come up over time
(testing conventions, error handling/observability, accessibility, ...).

Two problems with just repeating the mobile pattern ad hoc per doc:

1. **No shared mechanism.** Each doc would be authored from scratch in
   gather, with no way to reuse the same rules in another AppElent app
   (all of which share the same TanStack Start + Convex + Clerk +
   Cloudflare Workers stack per the `baseline` catalog feature) without
   copy-pasting and manually keeping copies in sync.
2. **No place to track "what areas exist yet" or "which app has adopted
   which area."** `appelent.json` already does this for code-wiring
   features (`baseline`, `auth`, `i18n`) — guidance docs have no
   equivalent.

## Goals

- A new catalog feature, `guidance`, that lets any AppElent app adopt one
  or more guidance-doc areas (`mobile-interaction`, and later
  `web-interaction`, `ci-cd`, ...), synced from one canonical source.
- Reuse the catalog's existing mechanisms wherever they already fit
  (`FEATURE.md`/`SKILL.md` shape, per-step addressability, the managed-block
  merge pattern, `appelent.json` tracking) rather than inventing new ones.
- A clean split between **generic** content (reusable across every AppElent
  app) and **app-specific** content (this app's own modules, ADRs, file
  paths) — the catalog only ever holds the generic half.
- Retrofit gather's existing `mobile-interaction.md` onto the new mechanism
  without losing any of its current content.

## Non-goals

- Writing the content of `web-interaction.md` or `ci-cd.md` — each is its
  own future brainstorming sub-project (research → decide, same process as
  mobile).
- Building every guidance area anyone might eventually want. Ideas beyond
  the three above go into a single catalog-repo GitHub issue, not into this
  feature's initial scope.
- Changing how `appelent-feature`/`appelent-project` parse or apply
  features. The design deliberately reuses existing parsing (`### N. Title`
  step headings, `{version, steps}` in `appelent.json`) so no tooling
  changes are needed.

## Design

### 1. The `guidance` feature (catalog repo: `AppElent/appelent-packages`)

A new feature folder, `skills/guidance/`, alongside `baseline`, `auth`,
`i18n`, `cli`, `mcp`.

**`skills/guidance/FEATURE.md`** — frontmatter `name: guidance`,
`version: 1`, `description: ...`, **no `package` key** (this feature ships
no npm package). Per `appelent-feature`'s `list` stage rule ("no package,
but `SKILL.md` contains a numbered apply procedure" → `guided`), and
`SKILL.md` will have one, `guidance` lands in the `guided` stage, not
`documented`. Body sections follow the existing FEATURE.md shape (What /
Stack / Architecture / Configuration / Changelog). Stack section documents
the one option apps choose: which areas to adopt.

**`skills/guidance/SKILL.md`** — a `## Task` section with one numbered
step per area, exactly matching baseline's `### N. Title` shape so
`appelent-feature`'s `steps <feature>` parser and `apply <feature>
--step <n>` addressing work unmodified:

```
## Task

### 1. mobile-interaction
### 2. web-interaction   (future)
### 3. ci-cd             (future)
```

Each step's procedure (see "Apply mechanics" below) is the same shape:
copy two files from the catalog into the target app, merge-not-clobber.

**Content files**, colocated with the feature rather than wired into an
app the way i18n's message trees are (there's nothing to generate — the
content itself is the deliverable):

```
skills/guidance/content/mobile-interaction.md          # the decided doc
skills/guidance/content/mobile-interaction-research.md # the research doc
skills/guidance/content/web-interaction.md              # future
skills/guidance/content/web-interaction-research.md     # future
skills/guidance/content/ci-cd.md                        # future
skills/guidance/content/ci-cd-research.md                # future
```

### 2. Apply mechanics (per area, per app)

Running `/appelent:feature apply guidance --step <n>` (or applying fresh,
which per the existing `apply` procedure applies every step not yet
recorded) for area `<area>`:

1. **Decided doc → `docs/<area>.md`.** Copy
   `content/<area>.md`'s body wrapped in the same
   `<!-- appelent-managed:start -->` / `<!-- appelent-managed:end -->`
   markers baseline already stamps into `CLAUDE.md`/`AGENTS.md`. Merge,
   don't clobber: replace only what's between the markers; anything the
   app has written below the closing marker (a local "how this maps to
   our modules" section) survives untouched. If `docs/<area>.md` doesn't
   exist yet, create it with the managed block as its entire content —
   the local section gets added by hand afterward, same as any other
   first-time managed-block stamp.
2. **Research doc → `docs/research/<area>-vocabulary.md`.** Copy
   `content/<area>-research.md` verbatim, unmodified — same "raw copy"
   semantics `sync-skills` already uses. No managed-block wrapping: the
   research doc is a record of how the *generic* rule was arrived at, not
   a place apps add their own material. An app with its own research
   findings that fed into local-only rules keeps those in its own
   separate section of `docs/<area>.md`'s local addendum, or its own doc,
   not in this file.
3. **Record in `appelent.json`**, same shape the `steps` mechanism already
   defines: `"guidance": { "version": <FEATURE.md version>, "steps": [<n>,
   ...] }` — merge into the existing `steps` array if `guidance` is already
   recorded, don't overwrite it.

No other tooling changes: `list`, `status`, `steps`, and `--update` all
already handle a feature recorded with a partial `steps` array.

### 3. Generic vs. app-specific split

The catalog's `content/<area>.md` holds only rules that hold for every
AppElent app on the shared stack — no domain module names (Baby, Recipes,
Tasks), no ADR links, no concrete file paths that are this app's own
layout rather than a stack-wide convention baseline itself mandates.

A rule stays generic if it reads correctly with the specifics replaced by
a placeholder concept: "a haptic is never the only signal" is generic;
"see `src/feedback/haptics.ts`" is not, because a different app may not
name that file the same thing (baseline doesn't currently mandate a
haptics-wrapper path). Where the current `mobile-interaction.md` cites a
concrete example to make a generic rule concrete (e.g. "a task list, which
already has an `order` column"), the generic version keeps the shape of
the example ("a list whose order the user controls") and drops gather's
specific column name.

Each app's `docs/<area>.md` may append a local, non-synced section below
the managed block — e.g. "In gather, the haptics wrapper is
`src/feedback/haptics.ts`", "Baby module screens follow this because...",
links to this app's own ADRs. That section is the app's own responsibility
to maintain; `apply`/`--update` never touches it.

### 4. Retrofitting gather

`docs/mobile-interaction.md` and `docs/research/mobile-interaction-vocabulary.md`
already exist and are already gather's source of truth. The retrofit:

1. In the catalog repo, author `skills/guidance/content/mobile-interaction.md`
   and `content/mobile-interaction-research.md` by extracting the generic
   rules and research from gather's current docs (per the split above).
2. In gather, reorganize `docs/mobile-interaction.md` in place: the
   generic content becomes the managed block (identical text to what step
   1 just produced), and everything gather-specific (Baby module
   references, `ADR-0018`, `convex/tasks.ts`'s current sort behavior, the
   "32 hard `.delete()` calls, no `deletedAt`" schema fact, concrete file
   paths, the "Open questions" section) becomes a local section below the
   closing marker. Same treatment for the research doc, if any of its
   content is gather-specific rather than general iOS/Android research
   (spot-check while doing the split; most of it reads as generic HIG/
   cross-platform research and moves to the catalog wholesale).
3. Add `"guidance": { "version": 1, "steps": [1] }` to gather's
   `appelent.json`.
4. No content is lost in either repo; the file paths in gather don't
   change, so nothing that links to `docs/mobile-interaction.md` breaks.

### 5. What happens after this spec

- `web-interaction` and `ci-cd` each become their own brainstorming
  sub-project later: research the area (mirroring
  `docs/research/mobile-interaction-vocabulary.md`'s process — survey,
  alternatives, sources), decide, write `content/<area>.md` +
  `content/<area>-research.md` in the catalog as step *N* of `guidance`,
  bump `guidance`'s `FEATURE.md` version with a Changelog line, apply to
  gather.
- Everything else that comes up (testing conventions, error handling/
  observability, accessibility, ...) is filed as **one** GitHub issue
  against `AppElent/appelent-packages` proposing to extend `guidance`'s
  area roadmap, per the catalog's existing `issue`/`issues` workflow — not
  built as part of this change.

## Testing / verification

Nothing here is executable code, so "testing" is verification that the
mechanism behaves as designed:

- `pnpm validate:catalog` (catalog repo) passes after the `guidance`
  feature is added, including the plugin-version bump check.
- `/appelent:feature list` (or the equivalent read of `FEATURE.md`
  frontmatter) shows `guidance` at the correct stage with version 1.
- `/appelent:feature steps guidance` lists `1. mobile-interaction`
  correctly, proving the `### N. Title` parsing works unmodified.
- After retrofitting gather: `docs/mobile-interaction.md`'s managed block
  matches `content/mobile-interaction.md` byte-for-byte between the
  markers, the local section below the markers still contains every
  gather-specific fact the original file had (diff against the pre-retrofit
  version to confirm nothing was silently dropped), and gather's
  `appelent.json` records `guidance` correctly.
- A second, no-op `apply guidance --step 1` run on gather changes nothing
  (idempotency, matching baseline's own "merge, don't clobber" guarantee).
