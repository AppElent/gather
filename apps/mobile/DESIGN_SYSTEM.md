# Gather mobile design system

Apply the shared [mobile design](../../docs/standards/mobile-design.md) and
[iOS](../../docs/standards/ios-design.md) / [Android](../../docs/standards/android-design.md)
standards, plus [actionable lists](../../docs/standards/lists.md) and
[editors](../../docs/standards/editors.md) when building those interactions.
The decisions below bind them for gather.

The phone owns its look and shares its words ([ADR-0017](../../docs/adr/0017-the-phone-owns-its-look-and-shares-its-words.md)):
`src/theme/` owns typography, neutrals, spacing, radii and glyphs; module tints
and every user-visible word come from `@gather/core`.

## Interaction vocabulary

What a press does, what a swipe does, what buzzes, what appears while things
load. Decided 2026-08-21 from the survey in
[`docs/research/mobile-interaction-vocabulary.md`](../../docs/research/mobile-interaction-vocabulary.md),
which keeps the alternatives and the reasoning. **A new screen follows these
rules; a rule that turns out wrong is changed here, not excepted in a component.**

**Draw only what the platform cannot.** Menus, sheets, tab bars, alerts and
search bars are the system's own, so iOS 26 renders them in Liquid Glass for
free. iOS is the reference and Android the honest port: the same behaviour,
drawn in each platform's idiom (a ripple where iOS fills the row, a snackbar
where iOS stays quiet).

### Touch

- **Press and hold opens the row's context menu, on every screen**, and means
  nothing else (`src/components/NativeContextMenu.tsx`, `@expo/ui`). Everything
  in a menu is also reachable from the row's detail screen.
- **Rearranging is a mode.** A list with a user-controlled order (task lists'
  `order` column) offers *Reorder* in its menu or header; Done leaves it.
- **Swipe right** does the row's main verb — completing a task. A row with no
  natural verb (a recipe) gets no swipe. **Swipe left** reveals a Delete that
  must be tapped; a full swipe left is reserved for Archive, which does not
  exist yet, so the slot stays empty (`src/components/SwipeableRow.tsx`).
- **Press states:** rows fill (iOS) or ripple (Android) — never React Native's
  default `opacity: 0.6`; buttons may dim or scale. Targets under ~44pt get `hitSlop={12}` — `QuickActionSheet` is the
  example to copy.

### Feedback

Haptics go through `src/feedback/haptics.ts`, named after events
(`haptics.itemCompleted()`), never called with a raw intensity at a call site.

| Event | Wrapper | Plays (iOS) |
| --- | --- | --- |
| Toggle, segmented control, picker step | `selectionChanged` | selection |
| Saved / item completed | `itemSaved` / `itemCompleted` | success |
| Validation failed, write rejected | `actionFailed` | error |
| Swipe passes its threshold | `swipeThresholdPassed` | light impact |
| Hold-menu opens | `menuOpened` | medium impact |
| Pull-to-refresh fires | `refreshStarted` | light impact |
| Taps, scrolling, navigation, sheet detents | — | **nothing** |

A haptic is never the only signal: iOS plays nothing in Low Power Mode, with
haptics off, or while the camera or dictation is active.

- **Messages: usually none.** The confirmation is the screen changing. Words
  appear only for Undo and for a failure the person did not cause.
- **Undo or confirm, never both.** Reversible things just happen, with undo
  (complete, unpin, un-share). Permanent things ask first, in an alert that
  names what is destroyed. Deleting in gather is permanent today (hard
  deletes, no `deletedAt`), so destructive actions confirm.
- **Completing puts an item away**, into a collapsed **Completed (n)** section
  at the bottom of its list.

### While you wait

- **Loading:** a skeleton of the eventual layout on first paint
  (`LoadingSkeleton`); nothing when re-querying content already on screen —
  Convex is live; a spinner only inside the control just pressed.
- **Optimistic writes** (`withOptimisticUpdate`) only for small, frequent,
  reversible writes; create new objects inside the update rather than mutating
  existing ones. A failed optimistic write rolls back visibly.
- **Pull to refresh** only where it actually fetches: the Notion- and
  Todoist-backed task lists ([ADR-0021](../../docs/adr/0021-task-backend-capabilities-and-manual-sync.md)).
  Elsewhere `ConnectionLostBanner` is the honest signal.
- **Empty states** are one of three kinds: *nothing yet* (one button that adds
  the first thing), *nothing found* (a way to clear the search or filter, never
  an add button), *nothing here for you* (a placeholder Module, a Group not
  joined: an explanation, no action).

### Chrome

- **Tabs** are the fixed five ([ADR-0018](../../docs/adr/0018-mobile-tabs-are-app-destinations-and-one-of-them-is-a-verb.md));
  `NativeTabs` with `minimizeBehavior="onScrollDown"`, and the Search tab
  carries `role: 'search'` (`src/shell/tabs.ts`). Badges only for something
  that needs counting. The tab bar is already glass; leave it unstyled.
- **Search:** a screen whose job is search uses `Stack.SearchBar` with default
  `placement`. A field that filters a list already on screen is
  `src/components/SearchField.tsx`.
- **Titles:** every screen sets a header `title`, even when nothing draws it
  (VoiceOver and the app switcher read it). Choose by content, defaulting to
  *Pushed* (back button, inline title). *Index*, the root of a tab, uses
  `headerLargeTitle` plus `contentInsetAdjustmentBehavior="automatic"` on a
  scroll view that is **the screen's first subview** — nested one level down it
  silently stops collapsing; make the scroll view and any pinned bar siblings.
  *Detail*, a record recognised by its picture, shows no bar title and pins the
  header and media above a scrolling body.
- **Getting out:** the native back button and edge swipe. No breadcrumbs on the
  phone; the web's rule that back goes to the parent, never to history, still
  holds, so every deep-linkable screen opens cold with a working parent.
- **Sheets** are `src/components/NativeSheet.tsx` around `@expo/ui`'s
  `BottomSheetModal`; the platform owns drag, keyboard, backdrop and dismissal.
- **Glass** (`expo-glass-effect`) only on chrome floating over scrolling
  content, and every layout must read correctly as the plain `View` it becomes
  below iOS 26 and on Android.

### Forms and quick actions

- First field autofocused; `returnKeyType` chains `next` → `done`; the last
  field submits; the primary action is disabled until valid and submitting
  twice saves once. A validator returns a message key, not a sentence.
- Quick action kinds are ADR-0018's: `row` grows a field in the launcher,
  `sheet` swaps its body, `handoff` pushes the Module's own screen.
- **A quick capture returns you where you started.** **A review-and-save lands
  you on what you made** (recipe import), and the form leaves the stack so Back
  cannot reach something that would save a second copy.
