# Guidance Catalog Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `guidance` feature to the `AppElent/appelent-packages` catalog that syncs cross-project AI-session guidance docs (starting with `mobile-interaction`) into any AppElent app's `docs/`, then adopt it in gather by retrofitting the existing `docs/mobile-interaction.md`.

**Architecture:** A new catalog feature folder (`skills/guidance/`) with `FEATURE.md` + `SKILL.md`, following the exact shape `baseline`/`i18n` already use (numbered `### N. Title` steps, `appelent.json`'s `{version, steps}` partial-application shape, the `appelent-managed:start/end` merge markers). Step 1's content — the generic decided rules and a distilled generic research note — lives in `skills/guidance/content/`. Gather adopts step 1 by splitting its existing `docs/mobile-interaction.md` into a managed block (byte-identical to the catalog content) plus a local addendum for gather-specific detail; its existing research doc stays untouched (see note below).

**Tech Stack:** Plain Markdown content files; no code, no package, no new tooling. `pnpm validate:catalog` (catalog repo) is the only automated check involved.

**Spec:** `docs/superpowers/specs/2026-08-21-guidance-docs-feature-design.md` (this plan implements it; read both together — the deviation on the research doc, noted there implicitly via "spot-check," is resolved concretely in Task 5 below).

## Global Constraints

- Package manager is pnpm everywhere, per both repos' conventions.
- Catalog repo checkout for this work: `/home/user/appelent-packages` (already cloned, registered, on `main` at the time of writing).
- Managed-block markers are exactly `<!-- appelent-managed:start -->` and `<!-- appelent-managed:end -->` (baseline's existing convention — do not invent new marker text).
- `FEATURE.md` frontmatter must have `name` (matching the folder), a positive-integer `version`, and `description`; body must contain `## What`, `## Stack`, `## Architecture`, `## Configuration`, `## Changelog` sections verbatim (checked by `scripts/validate-catalog.mjs`).
- `SKILL.md` frontmatter must have `name` and `description`, and the body must reference `self-improvement.md` (also checked by `scripts/validate-catalog.mjs`).
- Any commit touching `skills/` or `commands/` in the catalog repo must bump `version` in both `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` to the same value, in the same commit (checked by `scripts/validate-plugin-manifests.mjs`'s `validateVersionBump`, comparing against the `main` merge-base).
- `appelent.json`'s per-feature shape for partial application is `{ "version": <int>, "steps": [<int>, ...] }` — merge into existing `steps` arrays, never overwrite.
- Gather's designated branch for this work is `claude/ai-session-guidance-docs-d8m6sc` (already has the spec commit and an open draft PR, #197). The catalog repo needs its own new branch and its own PR — it is a separate repository with no designated branch of its own.

---

## Task 1: Catalog — generic decided doc for `mobile-interaction`

**Files:**
- Create: `/home/user/appelent-packages/skills/guidance/content/mobile-interaction.md`

**Interfaces:**
- Produces: the exact text later tasks copy verbatim into gather's managed block (Task 5) and that any other app's future `apply guidance --step 1` will copy too. Nothing consumes anything from an earlier task — this is the first task.

- [ ] **Step 1: Create the branch in the catalog repo**

```bash
cd /home/user/appelent-packages
git fetch origin main
git checkout -B claude/guidance-catalog-feature origin/main
```

- [ ] **Step 2: Write the generic decided doc**

Create `skills/guidance/content/mobile-interaction.md` with exactly this content (this is the generic split of gather's current `docs/mobile-interaction.md` — module names, ADR links, and gather's own file paths removed; the removed material is preserved as gather's local addendum in Task 5, not lost):

```markdown
# How a mobile client behaves

The rules an AppElent mobile app follows: what a press does, what a swipe
does, what buzzes, what appears while things load. Short and prescriptive —
obeyed by default. When you add a screen, it follows these rules; when a
rule turns out wrong for a specific app, change it in that app's local
section below this block rather than making a silent exception in a
component.

## The one idea underneath all of it

**Don't draw what the platform can draw.** iOS already knows how to render a
menu, a sheet, a tab bar, an alert — and on iOS 26 it renders them in Liquid
Glass at no cost. The app's job is to use the system's version, not to build
a convincing copy of it.

Two consequences worth stating, because they are the ones people forget:

- The tab bar is already Liquid Glass, without the app doing anything. Do
  not try to style it; on iOS 26 background props on `NativeTabs` have no
  effect.
- iOS is the reference and Android is the honest port. Same *behaviour*
  both places, drawn by each platform in its own idiom — a ripple on
  Android where iOS fills the row, a snackbar on Android where iOS stays
  quiet.

---

## Touch

### Press and hold opens a menu. Always.

Hold any row and you get the system context menu — the screen blurs, the
row lifts, its actions appear. Edit, Delete, Share, whatever that row has.

No screen is exempt and the gesture never means anything else, so it is
predictable everywhere. Built with `@expo/ui`'s `ContextMenu`, which is a
real SwiftUI menu on iOS and a Compose menu on Android.

**Rearranging a list is a mode, not a gesture.** A list whose order the
user controls — one backed by an explicit sort/order field — gets a
*Reorder* item in that menu, or a button in its header. Entering it grows
drag handles on every row; Done leaves it. That is how the hold gesture
stays free.

A menu is never the only way to reach something. Everything in it is also
on the row's detail screen.

### Swipe is the shortcut for the one thing you do most

- **Swipe right** does the row's main verb — completing an item in a list
  that has one. Nothing at all for a row with no natural verb, because a
  made-up action is worse than no action.
- **Swipe left** reveals a red Delete you have to *tap*. It never fires on
  a full swipe, because a full swipe is something you do by accident while
  scrolling — treat every delete as a serious, hard-to-undo action until
  the app's own rules say otherwise.
- **A full swipe left is reserved for Archive**, if the app has (or plans)
  an archive concept. Until archive exists, leave the slot empty rather
  than filling it with something else.

Built with a Reanimated-based swipeable-row component (e.g.
`react-native-gesture-handler`'s `ReanimatedSwipeable`).

### Press states and targets

Rows highlight with a background fill on iOS and a ripple on Android.
**Not** `opacity: 0.6` — that is the React Native default and it is wrong
on both platforms. Buttons may use opacity or a slight scale.

Anything smaller than about 44×44pt gets `hitSlop` (roughly 12pt on each
side is a reasonable default).

---

## Feedback

### Haptics

One wrapper module whose functions are named after events —
`haptics.itemCompleted()`, never `impactAsync(Heavy)` at a call site.

| What happened | What plays |
| --- | --- |
| Toggle, segmented control, picker step | `selectionAsync()` |
| Saved, item completed | `notificationAsync(Success)` |
| Validation failed, write rejected | `notificationAsync(Error)` |
| Swipe passes its threshold | `impactAsync(Light)` |
| Hold-menu opens | `impactAsync(Medium)` |
| Sheet snapping to a detent | nothing — the platform does it |
| Pull-to-refresh fires | `impactAsync(Light)` |
| Ordinary taps, scrolling, navigation | **nothing** |

That last row is the important one. Buzzing on every tap is what makes an
app feel cheap.

**A haptic is never the only signal.** iOS plays nothing at all in Low
Power Mode, when the user has turned haptics off, while the camera is
open, or during dictation. If the only way to know something worked is a
buzz, it did not work for those people.

### Messages: usually none

The confirmation is the screen changing. An item you added appears in the
list — nothing needs to say "Item added."

Words appear in exactly two cases:

- **Undo.** "Deleted — Undo" needs somewhere to put the button.
- **A failure you did not cause** — a background sync failing while you are
  elsewhere.

Drawn as a snackbar on Android, which has that convention, and something
quieter on iOS, which does not.

### Undo or confirm — never both

- **Reversible things just happen**, with undo offered: completing,
  unpinning, un-sharing. Asking first would be nagging.
- **Permanent things ask first**, with an alert that names the specific
  item, list, or membership being destroyed.

An action that confirms *and* offers undo has decided it is dangerous and
then decided it is not. Pick one.

### Completing an item puts it away

A completed item leaves its active list and drops into a collapsed
**Completed (n)** section at the bottom, which expands on tap.
Un-completing restores it.

---

## While you wait

**Loading.** A skeleton of the eventual layout on first paint of a list or
detail screen — it is what stops the layout jumping. Nothing at all when
re-querying something already on screen — Convex is live, and the content
you can see is almost always right. A spinner only inside a control
someone just pressed. Never a full-screen spinner over content that
already exists.

**Optimistic writes.** Use Convex's `withOptimisticUpdate` for small,
frequent, reversible writes — completing an item, toggling a pin, adding
from a launcher. Everything else waits for the server. Create new objects
inside the update; mutating existing ones corrupts the client's state.

**When an optimistic write fails, the rollback must be visible.** A
checkbox that silently un-checks itself is worse than a slow one.

**Pull to refresh** appears only where it genuinely fetches — a list
backed by an external provider that syncs on demand, not on every list
Convex already keeps live. Elsewhere, the connection banner is the honest
signal.

**Empty states** come in three kinds, one component with a `kind`:

- *Nothing yet* — one button that adds the first thing.
- *Nothing found* — a way to clear the search or filter, never an add
  button.
- *Nothing here for you* — a placeholder feature area, a workspace you
  have not joined. An explanation and no action.

---

## Chrome

**Tabs.** Use `minimizeBehavior="onScrollDown"` so the bar shrinks as you
scroll, and `role="search"` on a Search tab so iOS 26 draws it as its own
glass capsule. Badges only when something genuinely needs counting.

**Titles.** Large titles on top-level index screens; small inline titles
on anything you push into.

**Getting out.** The native back button and the swipe-from-edge gesture.
No breadcrumbs on the phone, even if the web app uses them — a
nested-page trail is a web pattern and does not cross to a phone screen.
What does cross is the underlying rule: back goes to the parent, never to
history. Every deep-linkable screen must have a working parent when opened
cold.

**Sheet mechanism.** Use the platform-native sheet component (e.g.
`@expo/ui`'s `BottomSheetModal`) rather than a hand-built JS sheet — it
wins on drag feel, keyboard handling, and matching the system's own sheet
chrome for free.

**Forms.** First field autofocused. `returnKeyType` chains `next` → `next`
→ `done`. The last field submits. The primary button is disabled until
valid, and submitting twice does not save twice. A validator returns a
message key, not a sentence, resolved into the reader's language at the
point it is displayed.

---

## Dependencies

Adopted: **`@expo/ui`** — context menus and native sheets, inside the Expo
release train, works in Expo Go.

Typically already present in an Expo app, and worth putting to use rather
than reaching for alternatives: `expo-haptics`, `react-native-gesture-handler`,
`react-native-reanimated`.

Deliberately not adopted: `@gorhom/bottom-sheet` (nothing here needs a
JavaScript-drawn sheet), `zeego` (only if `@expo/ui`'s menu turns out to
lack the blur-and-lift presentation). Deferred until something actually
breaks: `react-native-keyboard-controller`, and a toast library.

**`expo-glass-effect` only where something needs it.** Glass belongs to
chrome that floats over scrolling content. Cards, tiles and rows are
content. And the tab bar is already glass for free. Below iOS 26 and on
Android a `GlassView` silently becomes a plain `View`, so never build a
layout that only reads correctly with glass.
```

- [ ] **Step 3: Verify no stray gather-only terms remain**

Run:

```bash
cd /home/user/appelent-packages
grep -inE "gather|ADR-00|QuickActionSheet|convex/tasks|src/feedback|src/components/Sheet" skills/guidance/content/mobile-interaction.md
```

Expected: no matches (exit code 1 / empty output). If anything matches, it's a leftover gather-specific reference that needs to move to gather's local addendum instead (Task 5) — remove it here.

- [ ] **Step 4: Commit**

```bash
cd /home/user/appelent-packages
git add skills/guidance/content/mobile-interaction.md
git commit -m "feat(guidance): add generic mobile-interaction decided doc"
```

---

## Task 2: Catalog — distilled generic research note for `mobile-interaction`

**Files:**
- Create: `/home/user/appelent-packages/skills/guidance/content/mobile-interaction-research.md`

**Interfaces:**
- Consumes: nothing from Task 1 directly (independent content), but is applied by the same SKILL.md step (Task 4) and referenced by the same FEATURE.md (Task 3).
- Produces: the research companion doc other apps' `apply guidance --step 1` will copy to `docs/research/mobile-interaction-vocabulary.md`. Gather itself will *not* receive this copy (Task 5 explains why and leaves gather's own research doc untouched).

- [ ] **Step 1: Write the distilled research note**

Create `skills/guidance/content/mobile-interaction-research.md` with exactly this content:

```markdown
# Research behind "How a mobile client behaves"

The external facts and reasoning behind the rules in `mobile-interaction.md`
— not a survey of any specific app's codebase. An app doing its own survey
(the way gather did, in its own `docs/research/mobile-interaction-vocabulary.md`)
should keep that as its own document; this one stays deliberately
app-agnostic.

## Posture: iOS is the reference, Android is the honest port

The app should feel like the OS it is running on, not like a
cross-platform compromise. On iOS 26 that means Liquid Glass chrome,
native sheets with detents, `UIMenu` context menus, and the Taptic
vocabulary users already know. Android gets the same *behaviour* drawn by
Material, not the same pixels — where Material genuinely disagrees with
UIKit (snackbars vs. no snackbars, overflow menus vs. long-press menus,
the back gesture), the Android answer is Material's.

Recompiling against the iOS 26 SDK gives system controls the Liquid Glass
treatment automatically. Expo's Native Tabs documentation states that on
iOS 26 the tab bar derives its background from the content beneath it —
background props have no effect there [Expo — Native tabs]. That is why
the tab bar rule needs no code: it is already glass.

`expo-glass-effect` (bundled with SDK 56+, works in Expo Go) is a separate
story for an app's *own* glass surfaces: iOS 26+ only (falls back to a
plain `View` elsewhere), needs a runtime availability check
(`isGlassEffectAPIAvailable()`), and `opacity: 0` disables the effect
entirely rather than fading it [Expo — GlassEffect]. The design guidance is
mostly a list of don'ts: no `blur`/`opacity`/`background` on a glass view,
no solid fill behind one, no nested glass containers, no second glass
layer on toolbars/tab bars that already have one (WWDC25 §284 and
community write-ups). Reading: glass is chrome that floats over scrolling
content, not content itself — a floating control or two is the honest
scope for most apps.

## Sheets

The HIG's position on the shape itself (excerpt, unverified against the
live page — see "Verification status" below): the system defines `medium`
(≈half height) and `large` detents; a resizable sheet should include a
grabber, which both signals resizability and cycles detents on tap; the
medium detent is for progressive disclosure, and compose-style sheets that
need the room should be large-only [Apple HIG — Sheets, excerpt].

A platform-native sheet component (Expo Router's `formSheet` presentation,
or `@expo/ui`'s `BottomSheet`, both riding on the real
`UISheetPresentationController` / Material bottom sheet) gets this for
free. A hand-built `Modal` + scrim does not: no drag-to-dismiss, no
detents, no native material. That is the whole case for the sheet-mechanism
rule.

## Long press and context menus

`@expo/ui`'s SwiftUI `ContextMenu` produces a real system context menu on
iOS (with the system's preview-and-blur presentation) and a Compose
`DropdownMenu` on Android, adding no native module outside the Expo
release train. The alternative that produces an equally real `UIMenu` —
Zeego, wrapping `react-native-ios-context-menu` — needs a dev client
(routine for any Expo app with a development build already) but is a
second native module stacked on top of another, which is the case against
reaching for it unless `@expo/ui`'s menu turns out not to support the
preview presentation.

The rule that survives whichever option an app picks: a long press is
never the only way to reach an action — everything in a context menu
should also be reachable from the row's detail screen.

## The haptic vocabulary

`expo-haptics`'s API: `impactAsync` (`Light`/`Medium`/`Heavy`/`Rigid`/
`Soft`), `notificationAsync` (`Success`/`Warning`/`Error`),
`selectionAsync()`, and `performAndroidHapticsAsync` for Android-specific
patterns [Expo — Haptics].

Two constraints shape the vocabulary. First, the platform one: iOS
silently plays nothing when Low Power Mode is on, when the user has turned
system haptics off, while the camera is active, or during dictation.
Second, the guidance one — the HIG's line (excerpt) is that haptics
*supplement* visual feedback and that system-defined haptics should be
used consistently so people are not confused [Apple HIG — Playing
haptics, excerpt]. Together: a haptic is never the only signal that
something happened.

## Press states

Every React Native app defaults to `opacity: 0.6` on `Pressable`, and it
is wrong on both platforms: iOS highlights a *row* with a background fill
rather than fading its content, and Android draws a ripple from the touch
point. `react-native-gesture-handler` ships its own `Pressable` with
`android_ripple` support, which matters as soon as a pressable lives
inside something that scrolls or swipes.

## Optimistic writes

Convex's `withOptimisticUpdate` on mutations, with `localStore.getQuery`/
`setQuery` and automatic rollback when the mutation resolves, carries one
hard rule: never mutate objects in the update — new objects only, or the
client's internal state corrupts [Convex — Optimistic updates]. That is
why the rule scopes optimism to writes whose *creation* is what's
optimistic (completing, toggling, adding), not to edits of existing
state.

## Verification status

Fetched and read directly: Expo's GlassEffect, Haptics, UI (`@expo/ui`),
`@expo/ui` BottomSheet, and Native Tabs documentation; Convex's optimistic
updates documentation. Apple's Human Interface Guidelines could not be
fetched in the environment this research was compiled in — the HIG is a
client-rendered site whose data endpoints 404 behind some proxies — so HIG
content here comes from search excerpts, marked `(excerpt)` above.
**Confirm the sheet-detent guidance and the haptics best-practices lines
against the live HIG pages before treating them as settled:**
[Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets),
[Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics).

[Expo — Native tabs]: https://docs.expo.dev/router/advanced/native-tabs/
[Expo — GlassEffect]: https://docs.expo.dev/versions/latest/sdk/glass-effect/
[Expo — Haptics]: https://docs.expo.dev/versions/latest/sdk/haptics/
[Convex — Optimistic updates]: https://docs.convex.dev/client/react/optimistic-updates
```

- [ ] **Step 2: Commit**

```bash
cd /home/user/appelent-packages
git add skills/guidance/content/mobile-interaction-research.md
git commit -m "feat(guidance): add generic mobile-interaction research note"
```

---

## Task 3: Catalog — `FEATURE.md` and `SKILL.md` for the `guidance` feature

**Files:**
- Create: `/home/user/appelent-packages/skills/guidance/FEATURE.md`
- Create: `/home/user/appelent-packages/skills/guidance/SKILL.md`

**Interfaces:**
- Consumes: `content/mobile-interaction.md` and `content/mobile-interaction-research.md` from Tasks 1-2 (referenced by path in `SKILL.md`, not inlined).
- Produces: the feature `appelent-feature list`/`show`/`apply`/`steps` operate on. `SKILL.md`'s step heading `### 1. mobile-interaction` is the exact string later `apply guidance --step 1` addressing and `appelent.json`'s `steps: [1]` refer to.

- [ ] **Step 1: Write `FEATURE.md`**

```markdown
---
name: guidance
version: 1
description: Cross-project AI-session guidance docs (decided rules + research trail) for areas like mobile interaction, synced from one canonical source into each app's docs/
---

# Guidance

## What

Short, prescriptive "decided" docs that tell a future AI session what to do
in a given area — modeled on gather's `docs/mobile-interaction.md` — plus a
companion research doc recording how each rule was arrived at. Each area
(`mobile-interaction`, and later `web-interaction`, `ci-cd`, ...) is
authored once here, generic to every AppElent app on the shared stack, and
applied into an app's `docs/` the same way any other feature is applied.

## Stack

- No package — this feature ships documentation content, not code.
- Options: `areas` — which of this feature's numbered steps (see
  `SKILL.md`) an app has adopted, e.g. `["mobile-interaction"]`. An app
  adopts only the areas relevant to it (a web-only app skips
  `mobile-interaction`).
- Areas available today: `mobile-interaction` (step 1).

## Architecture

See `SKILL.md` — one numbered step per area. Each step copies two files
from this feature's `content/` folder into the target app:
`content/<area>.md` into `docs/<area>.md`, wrapped in
`<!-- appelent-managed:start/end -->` markers so the app can append its
own local, app-specific section below the block without losing it on the
next sync; and `content/<area>-research.md` into
`docs/research/<area>-vocabulary.md`, copied verbatim (no local edits
expected there — an app's own research stays in its own doc; see
`SKILL.md` for what happens when an app already has one predating this
feature).

## Configuration

None — no env vars, no package installs. Applying this feature only writes
files under the target app's `docs/`.

## Changelog

- 1 — initial capture: step 1, `mobile-interaction`, migrated from
  gather's `docs/mobile-interaction.md` (generic rules only — gather's own
  module references, ADR links, and file paths stayed local to that app;
  gather's existing research doc predated this feature and was kept
  as-is rather than replaced by this feature's generic research note).
```

- [ ] **Step 2: Write `SKILL.md`**

```markdown
---
name: guidance
description: Apply one or more cross-project guidance-doc areas (mobile-interaction, and later web-interaction, ci-cd, ...) into an app's docs/, synced from this catalog's canonical content.
---

# guidance

Read `FEATURE.md` first — it explains the split between this feature's
`content/` (generic, catalog-owned) and each app's own local addendum
(app-specific, owned by the app).

## Task

### 1. mobile-interaction

1. Copy `content/mobile-interaction.md`'s body into the target app's
   `docs/mobile-interaction.md`, between
   `<!-- appelent-managed:start -->` / `<!-- appelent-managed:end -->`
   markers. If the file doesn't exist yet, create it with just the
   managed block; the app's own local section is added by hand
   afterward, not by this step. If it already exists, replace only what's
   between the markers — never touch content above or below them.
2. Copy `content/mobile-interaction-research.md` verbatim to the target
   app's `docs/research/mobile-interaction-vocabulary.md`. **If the app
   already has its own research doc there predating this feature** (as
   gather does), do not overwrite it — ask the user how to reconcile
   instead of guessing, since that doc may hold irreplaceable project
   history. It is fine for an app to adopt only the decided-doc half of
   this step.
3. Record in the app's `appelent.json`: merge `"guidance": { "version":
   1, "steps": [1] }` — add `1` to the existing `steps` array if
   `guidance` is already recorded, don't overwrite other steps already
   there.

## Self-improvement

When this skill's work is done, follow the reflection in
`../appelent-feature/references/self-improvement.md` — notice what was
unclear or missing about this skill's steps while working through them,
and offer to file it back to the catalog if anything is worth filing.
```

- [ ] **Step 3: Run the catalog content validator**

```bash
cd /home/user/appelent-packages
node scripts/validate-catalog.mjs
```

Expected: `catalog ok` (exit code 0). If it reports errors about `guidance`, fix `FEATURE.md`/`SKILL.md` per the error message (most likely a missing required section heading or frontmatter field) and re-run.

- [ ] **Step 4: Commit**

```bash
cd /home/user/appelent-packages
git add skills/guidance/FEATURE.md skills/guidance/SKILL.md
git commit -m "feat(guidance): add FEATURE.md and SKILL.md for the guidance catalog feature"
```

---

## Task 4: Catalog — bump plugin manifests and finish validation

**Files:**
- Modify: `/home/user/appelent-packages/.claude-plugin/plugin.json`
- Modify: `/home/user/appelent-packages/.codex-plugin/plugin.json`

**Interfaces:**
- Consumes: nothing new — this task closes out the catalog-side change from Tasks 1-3.
- Produces: nothing consumed by later tasks (gather's adoption in Task 5 reads `content/` files directly from the checkout, not the manifest version).

- [ ] **Step 1: Bump both manifest versions**

Read the current version first:

```bash
cd /home/user/appelent-packages
grep '"version"' .claude-plugin/plugin.json .codex-plugin/plugin.json
```

Expected: both show `"version": "0.1.9"`. Bump to `"0.2.0"` (minor bump — a new skill/feature, per this catalog's own versioning rule) in both files. In `.claude-plugin/plugin.json`, change:

```json
	"version": "0.1.9",
```

to:

```json
	"version": "0.2.0",
```

Make the identical change in `.codex-plugin/plugin.json`.

- [ ] **Step 2: Run the full catalog validation suite**

```bash
cd /home/user/appelent-packages
pnpm validate:catalog
```

Expected: `catalog ok`, `plugin manifests ok`, and both `node --test` files pass (look for `# pass` lines with `# fail 0`). This run's `validateVersionBump` check is what confirms the manifest bump actually took — it diffs the working tree against `origin/main`'s merge-base and fails if `skills/` changed without a version bump.

- [ ] **Step 3: Commit**

```bash
cd /home/user/appelent-packages
git add .claude-plugin/plugin.json .codex-plugin/plugin.json
git commit -m "chore: bump plugin version to 0.2.0 for the guidance feature"
```

- [ ] **Step 4: Push and open a draft PR**

```bash
cd /home/user/appelent-packages
git push -u origin claude/guidance-catalog-feature
```

Then open a draft PR from `claude/guidance-catalog-feature` to `main` in `AppElent/appelent-packages` (title: `feat(guidance): add cross-project guidance-docs catalog feature`; body summarizing Tasks 1-4 — the new `guidance` feature, its `mobile-interaction` step, and the plugin version bump — plus the standard `Generated by Claude Code` footer, following this session's usual GitHub-post attribution convention). Subscribe to the new PR's activity the same way PR #197 in gather was subscribed to, so CI and review feedback on the catalog PR surface the same way.

---

## Task 5: Gather — retrofit `docs/mobile-interaction.md` onto the managed block

**Files:**
- Modify: `/home/user/gather/docs/mobile-interaction.md`

**Interfaces:**
- Consumes: the exact text of `skills/guidance/content/mobile-interaction.md` from Task 1 (the managed block must be byte-identical to it).
- Produces: nothing consumed by later tasks in this repo except that Task 7's `appelent.json` entry describes this file's new sync relationship.

- [ ] **Step 1: Replace the file's full content**

Replace the entire content of `docs/mobile-interaction.md` with:

```markdown
# How gather mobile behaves

The rules the phone app follows: what a press does, what a swipe does, what
buzzes, what appears while things load. Decided 2026-08-21 from the survey in
[`docs/research/mobile-interaction-vocabulary.md`](research/mobile-interaction-vocabulary.md),
which has the research, the alternatives and the versions behind each rule.

This file is the short version, and it is the one to obey. **When you add a
screen, it follows these rules; when a rule turns out to be wrong, change it
here rather than making an exception in a component.**

The block below is shared with every AppElent app that has a mobile client —
it comes from the `guidance` catalog feature
(`skills/guidance/content/mobile-interaction.md` in
[`AppElent/appelent-packages`](https://github.com/AppElent/appelent-packages))
and is kept in sync via `/appelent:feature apply guidance --step 1`. Gather's
own specifics live in "How this maps to gather" below it, which sync never
touches.

<!-- appelent-managed:start -->
## The one idea underneath all of it

**Don't draw what the platform can draw.** iOS already knows how to render a
menu, a sheet, a tab bar, an alert — and on iOS 26 it renders them in Liquid
Glass at no cost. The app's job is to use the system's version, not to build
a convincing copy of it.

Two consequences worth stating, because they are the ones people forget:

- The tab bar is already Liquid Glass, without the app doing anything. Do
  not try to style it; on iOS 26 background props on `NativeTabs` have no
  effect.
- iOS is the reference and Android is the honest port. Same *behaviour*
  both places, drawn by each platform in its own idiom — a ripple on
  Android where iOS fills the row, a snackbar on Android where iOS stays
  quiet.

---

## Touch

### Press and hold opens a menu. Always.

Hold any row and you get the system context menu — the screen blurs, the
row lifts, its actions appear. Edit, Delete, Share, whatever that row has.

No screen is exempt and the gesture never means anything else, so it is
predictable everywhere. Built with `@expo/ui`'s `ContextMenu`, which is a
real SwiftUI menu on iOS and a Compose menu on Android.

**Rearranging a list is a mode, not a gesture.** A list whose order the
user controls — one backed by an explicit sort/order field — gets a
*Reorder* item in that menu, or a button in its header. Entering it grows
drag handles on every row; Done leaves it. That is how the hold gesture
stays free.

A menu is never the only way to reach something. Everything in it is also
on the row's detail screen.

### Swipe is the shortcut for the one thing you do most

- **Swipe right** does the row's main verb — completing an item in a list
  that has one. Nothing at all for a row with no natural verb, because a
  made-up action is worse than no action.
- **Swipe left** reveals a red Delete you have to *tap*. It never fires on
  a full swipe, because a full swipe is something you do by accident while
  scrolling — treat every delete as a serious, hard-to-undo action until
  the app's own rules say otherwise.
- **A full swipe left is reserved for Archive**, if the app has (or plans)
  an archive concept. Until archive exists, leave the slot empty rather
  than filling it with something else.

Built with a Reanimated-based swipeable-row component (e.g.
`react-native-gesture-handler`'s `ReanimatedSwipeable`).

### Press states and targets

Rows highlight with a background fill on iOS and a ripple on Android.
**Not** `opacity: 0.6` — that is the React Native default and it is wrong
on both platforms. Buttons may use opacity or a slight scale.

Anything smaller than about 44×44pt gets `hitSlop` (roughly 12pt on each
side is a reasonable default).

---

## Feedback

### Haptics

One wrapper module whose functions are named after events —
`haptics.itemCompleted()`, never `impactAsync(Heavy)` at a call site.

| What happened | What plays |
| --- | --- |
| Toggle, segmented control, picker step | `selectionAsync()` |
| Saved, item completed | `notificationAsync(Success)` |
| Validation failed, write rejected | `notificationAsync(Error)` |
| Swipe passes its threshold | `impactAsync(Light)` |
| Hold-menu opens | `impactAsync(Medium)` |
| Sheet snapping to a detent | nothing — the platform does it |
| Pull-to-refresh fires | `impactAsync(Light)` |
| Ordinary taps, scrolling, navigation | **nothing** |

That last row is the important one. Buzzing on every tap is what makes an
app feel cheap.

**A haptic is never the only signal.** iOS plays nothing at all in Low
Power Mode, when the user has turned haptics off, while the camera is
open, or during dictation. If the only way to know something worked is a
buzz, it did not work for those people.

### Messages: usually none

The confirmation is the screen changing. An item you added appears in the
list — nothing needs to say "Item added."

Words appear in exactly two cases:

- **Undo.** "Deleted — Undo" needs somewhere to put the button.
- **A failure you did not cause** — a background sync failing while you are
  elsewhere.

Drawn as a snackbar on Android, which has that convention, and something
quieter on iOS, which does not.

### Undo or confirm — never both

- **Reversible things just happen**, with undo offered: completing,
  unpinning, un-sharing. Asking first would be nagging.
- **Permanent things ask first**, with an alert that names the specific
  item, list, or membership being destroyed.

An action that confirms *and* offers undo has decided it is dangerous and
then decided it is not. Pick one.

### Completing an item puts it away

A completed item leaves its active list and drops into a collapsed
**Completed (n)** section at the bottom, which expands on tap.
Un-completing restores it.

---

## While you wait

**Loading.** A skeleton of the eventual layout on first paint of a list or
detail screen — it is what stops the layout jumping. Nothing at all when
re-querying something already on screen — Convex is live, and the content
you can see is almost always right. A spinner only inside a control
someone just pressed. Never a full-screen spinner over content that
already exists.

**Optimistic writes.** Use Convex's `withOptimisticUpdate` for small,
frequent, reversible writes — completing an item, toggling a pin, adding
from a launcher. Everything else waits for the server. Create new objects
inside the update; mutating existing ones corrupts the client's state.

**When an optimistic write fails, the rollback must be visible.** A
checkbox that silently un-checks itself is worse than a slow one.

**Pull to refresh** appears only where it genuinely fetches — a list
backed by an external provider that syncs on demand, not on every list
Convex already keeps live. Elsewhere, the connection banner is the honest
signal.

**Empty states** come in three kinds, one component with a `kind`:

- *Nothing yet* — one button that adds the first thing.
- *Nothing found* — a way to clear the search or filter, never an add
  button.
- *Nothing here for you* — a placeholder feature area, a workspace you
  have not joined. An explanation and no action.

---

## Chrome

**Tabs.** Use `minimizeBehavior="onScrollDown"` so the bar shrinks as you
scroll, and `role="search"` on a Search tab so iOS 26 draws it as its own
glass capsule. Badges only when something genuinely needs counting.

**Titles.** Large titles on top-level index screens; small inline titles
on anything you push into.

**Getting out.** The native back button and the swipe-from-edge gesture.
No breadcrumbs on the phone, even if the web app uses them — a
nested-page trail is a web pattern and does not cross to a phone screen.
What does cross is the underlying rule: back goes to the parent, never to
history. Every deep-linkable screen must have a working parent when opened
cold.

**Sheet mechanism.** Use the platform-native sheet component (e.g.
`@expo/ui`'s `BottomSheetModal`) rather than a hand-built JS sheet — it
wins on drag feel, keyboard handling, and matching the system's own sheet
chrome for free.

**Forms.** First field autofocused. `returnKeyType` chains `next` → `next`
→ `done`. The last field submits. The primary button is disabled until
valid, and submitting twice does not save twice. A validator returns a
message key, not a sentence, resolved into the reader's language at the
point it is displayed.

---

## Dependencies

Adopted: **`@expo/ui`** — context menus and native sheets, inside the Expo
release train, works in Expo Go.

Typically already present in an Expo app, and worth putting to use rather
than reaching for alternatives: `expo-haptics`, `react-native-gesture-handler`,
`react-native-reanimated`.

Deliberately not adopted: `@gorhom/bottom-sheet` (nothing here needs a
JavaScript-drawn sheet), `zeego` (only if `@expo/ui`'s menu turns out to
lack the blur-and-lift presentation). Deferred until something actually
breaks: `react-native-keyboard-controller`, and a toast library.

**`expo-glass-effect` only where something needs it.** Glass belongs to
chrome that floats over scrolling content. Cards, tiles and rows are
content. And the tab bar is already glass for free. Below iOS 26 and on
Android a `GlassView` silently becomes a plain `View`, so never build a
layout that only reads correctly with glass.
<!-- appelent-managed:end -->

## How this maps to gather

Gather-specific detail the generic rules above don't (and shouldn't) spell
out.

**Modules and examples.** Swipe-right completes a task; a recipe in a list
has no natural verb, so it gets no swipe. The "list whose order the user
controls" is gather's task lists, which already have an `order` column.
"A placeholder feature area, a workspace you have not joined" means a
placeholder Module or a Group you have not joined.

**Tabs.** The fixed five (ADR-0018), with Add as a verb tab that opens a
launcher without navigating rather than a sixth screen.

**Quick actions.** Kinds are ADR-0018's: `row` grows a field in the
launcher, `sheet` swaps the launcher's body, `handoff` pushes the Module's
own screen. One addition: **a `handoff` returns you where you started.**
You pressed Add from the Baby module; saving a recipe should not leave you
standing in Recipes.

**Getting out.** [ADR-0013](adr/0013-a-nested-page-carries-its-own-trail.md)
is the web rule the generic block's "even if the web app uses them" refers
to.

**Pull to refresh.** Applies specifically to the Tasks module's Notion- and
Todoist-backed lists ([ADR-0021](adr/0021-task-backend-capabilities-and-manual-sync.md)).

**Haptics wrapper.** `src/feedback/haptics.ts`.

**Deleting in gather is permanent today** — 32 hard `.delete()` calls, and
no `deletedAt` anywhere in the schema. That is why the confirm-vs-undo rule
above leans toward confirmation for gather's destructive actions today, and
it is what would change if archive ever lands.

**Completing a task puts it away.** Note this is a change from gather's
current behavior: `convex/tasks.ts` currently sorts completed tasks to the
bottom and leaves them visible rather than collapsing them.

**Sheet mechanism migration.** `src/components/Sheet.tsx` — the hand-built
JS sheet every sheet in the app currently shares — is the thing that
retires onto `@expo/ui`'s `BottomSheetModal`; its own header already called
this out as not the end state. That swap is tracked as follow-up work, not
done in the same change as this decision.

**Forms.** `QuickActionSheet` already implements the generic form rules
above and is gather's reference implementation; a validator's key resolves
via [ADR-0011](adr/0011-the-ui-is-english-at-the-source-and-translations-are-typed-dictionaries.md)'s
typed dictionaries. `QuickActionSheet` also already does `hitSlop`
correctly (`hitSlop={12}`) and is the example to copy for press targets.

## Open questions

**Archive.** It does not exist: no flag on any table, nothing hidden-but-kept.
Adding it means a column, a filter on every query that reads those rows, a
place to see archived things, and a `docs/migrations/` note — a project, not
a UI change. Tasks are the exception and need nothing: completing already
puts a task away, reversibly.

**Verify the two Apple sources.** The detent and haptics guidance in the
catalog's research doc came from search excerpts, because the HIG could not
be fetched when the survey was written. Confirm against the real pages
before treating them as settled:
[Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets),
[Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics).
```

- [ ] **Step 2: Verify the managed block matches the catalog file byte-for-byte**

```bash
cd /home/user/gather
awk '/<!-- appelent-managed:start -->/{flag=1; next} /<!-- appelent-managed:end -->/{flag=0} flag' docs/mobile-interaction.md > /tmp/gather-managed-block.md
diff /tmp/gather-managed-block.md /home/user/appelent-packages/skills/guidance/content/mobile-interaction.md
```

Expected: no output (the two are identical).

- [ ] **Step 3: Verify no original content was silently dropped**

```bash
cd /home/user/gather
git show HEAD:docs/mobile-interaction.md > /tmp/mobile-interaction-before.md
grep -oE "ADR-00[0-9]+" /tmp/mobile-interaction-before.md | sort -u
grep -oE "ADR-00[0-9]+" docs/mobile-interaction.md | sort -u
```

Expected: both commands print the same set of ADR numbers (`ADR-0011`,
`ADR-0013`, `ADR-0018`, `ADR-0021` — the four the original file cited).
Also manually confirm (read both files side by side) that every fact
called out in this plan's split analysis — the "32 hard `.delete()` calls"
sentence, the `src/feedback/haptics.ts` and `src/components/Sheet.tsx`
paths, the `QuickActionSheet` references, the `convex/tasks.ts` sort
note, and the full "Open questions" section — appears somewhere in the
new file.

- [ ] **Step 4: Commit**

```bash
cd /home/user/gather
git add docs/mobile-interaction.md
git commit -m "docs: retrofit mobile-interaction.md onto the guidance catalog feature"
```

---

## Task 6: Gather — provenance note on the existing research doc

**Files:**
- Modify: `/home/user/gather/docs/research/mobile-interaction-vocabulary.md`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by later tasks — purely a one-line addition explaining why this doc, unlike the decided doc, isn't synced from the catalog.

- [ ] **Step 1: Add a one-line provenance note right after the title**

In `docs/research/mobile-interaction-vocabulary.md`, change:

```markdown
# Interaction vocabulary for the gather mobile app

**This is a survey, not a decision.** It exists so that the decisions can be
```

to:

```markdown
# Interaction vocabulary for the gather mobile app

*This document predates and is not synced by the `guidance` catalog
feature — it's gather's own project-specific survey, not the generic
research note that feature's `mobile-interaction` step would otherwise
copy in. See `docs/mobile-interaction.md`'s intro for how the two relate.*

**This is a survey, not a decision.** It exists so that the decisions can be
```

No other change to this file — every other line stays exactly as it is.

- [ ] **Step 2: Verify nothing else changed**

```bash
cd /home/user/gather
git diff docs/research/mobile-interaction-vocabulary.md
```

Expected: the diff shows only the 5 added lines (the italic provenance note and its surrounding blank lines), nothing else touched.

- [ ] **Step 3: Commit**

```bash
cd /home/user/gather
git add docs/research/mobile-interaction-vocabulary.md
git commit -m "docs: note that mobile-interaction-vocabulary.md is not synced by the guidance feature"
```

---

## Task 7: Gather — record the `guidance` feature in `appelent.json`

**Files:**
- Modify: `/home/user/gather/appelent.json`

**Interfaces:**
- Consumes: nothing.
- Produces: the recorded state `appelent-project`'s `list`/`status` subcommands will read for this feature going forward.

- [ ] **Step 1: Add the `guidance` entry**

Change:

```json
{
  "features": {
    "baseline": { "version": 5, "steps": [6, 9, 14, 15] },
    "auth": { "version": 1 },
    "i18n": { "version": 1, "options": { "locales": ["en", "nl"] } }
  }
}
```

to:

```json
{
  "features": {
    "baseline": { "version": 5, "steps": [6, 9, 14, 15] },
    "auth": { "version": 1 },
    "i18n": { "version": 1, "options": { "locales": ["en", "nl"] } },
    "guidance": { "version": 1, "steps": [1] }
  }
}
```

- [ ] **Step 2: Verify it's valid JSON**

```bash
cd /home/user/gather
node -e "JSON.parse(require('fs').readFileSync('appelent.json', 'utf8')); console.log('valid json')"
```

Expected: `valid json`.

- [ ] **Step 3: Commit**

```bash
cd /home/user/gather
git add appelent.json
git commit -m "chore: record the guidance feature (mobile-interaction, step 1) in appelent.json"
```

---

## Task 8: Gather — push and confirm the existing PR picks up the new commits

**Files:** none (push-only task).

**Interfaces:** none — this closes out the gather side.

- [ ] **Step 1: Push**

```bash
cd /home/user/gather
git push -u origin claude/ai-session-guidance-docs-d8m6sc
```

- [ ] **Step 2: Confirm PR #197 shows the new commits**

Check that pull request `AppElent/gather#197` (already open from the spec commit) now lists 4 commits (spec + Task 5 + Task 6 + Task 7) and that its diff includes `docs/mobile-interaction.md`, `docs/research/mobile-interaction-vocabulary.md`, and `appelent.json`. No new PR is needed — same branch, same PR.

---

## Self-Review Notes

- **Spec coverage:** Design §1 (feature shape) → Task 3. §2 (apply mechanics) → Task 3's `SKILL.md` + Task 5/7 (gather performing that procedure by hand, since there's no running `apply` command in this environment). §3 (generic/specific split) → Tasks 1, 2, 5 embody it; the split decision itself is documented inline in the plan intro and Task 5's local-addendum content. §4 (retrofit gather) → Tasks 5-7. §5 (future areas / backlog issue) → intentionally not a task here; it's post-this-plan work per the spec's non-goals.
- **Known deviation from the spec, resolved here:** the spec assumed gather's research doc would mostly move to the catalog. Having read the actual 569-line file, it doesn't — it's a project-specific survey almost end to end. Task 2 writes a freshly-distilled generic research note instead of extracting one from gather's file, and Task 6 documents why gather's own file stays untouched. This keeps `SKILL.md`'s step 1 procedure (Task 3) honest about handling exactly this case for any future app.
- **Type/name consistency:** the managed-block marker text, the `appelent.json` shape `{ "version": 1, "steps": [1] }`, and the file paths (`docs/mobile-interaction.md`, `docs/research/mobile-interaction-vocabulary.md`) are used identically across Tasks 3, 5, 6, 7.
