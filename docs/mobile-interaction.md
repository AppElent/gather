# How gather mobile behaves

The rules the phone app follows: what a press does, what a swipe does, what
buzzes, what appears while things load. Decided 2026-08-21 from the survey in
[`docs/research/mobile-interaction-vocabulary.md`](research/mobile-interaction-vocabulary.md),
which has the research, the alternatives and the versions behind each rule.

This file is the short version, and it is the one to obey. **When you add a
screen, it follows these rules; when a rule turns out to be wrong, change it
here rather than making an exception in a component.**

## The one idea underneath all of it

**Don't draw what the platform can draw.** iOS already knows how to render a
menu, a sheet, a tab bar, an alert — and on iOS 26 it renders them in Liquid
Glass at no cost. gather's job is to use the system's version, not to build a
convincing copy of it.

Two consequences worth stating, because they are the ones people forget:

- The tab bar is already Liquid Glass, without gather doing anything. Do not
  try to style it; on iOS 26 background props on `NativeTabs` have no effect.
- iOS is the reference and Android is the honest port. Same *behaviour* both
  places, drawn by each platform in its own idiom — a ripple on Android where
  iOS fills the row, a snackbar on Android where iOS stays quiet.

---

## Touch

### Press and hold opens a menu. Always.

Hold any row and you get the system context menu — the screen blurs, the row
lifts, its actions appear. Edit, Delete, Share, whatever that row has.

No screen is exempt and the gesture never means anything else, so it is
predictable everywhere. Built with `@expo/ui`'s `ContextMenu`, which is a real
SwiftUI menu on iOS and a Compose menu on Android.

**Rearranging a list is a mode, not a gesture.** A list whose order people
control — a task list, which already has an `order` column — gets a *Reorder*
item in that menu, or a button in its header. Entering it grows drag handles on
every row; Done leaves it. That is how the hold gesture stays free.

A menu is never the only way to reach something. Everything in it is also on the
row's detail screen.

### Swipe is the shortcut for the one thing you do most

- **Swipe right** does the row's main verb. Completing a task. Nothing at all
  for a row with no natural verb — a recipe in a list is not "done" — because a
  made-up action is worse than no action.
- **Swipe left** reveals a red Delete you have to *tap*. It never fires on a
  full swipe, because a full swipe is something you do by accident while
  scrolling, and gather's deletes are permanent.
- **A full swipe left is reserved for Archive**, and archive does not exist yet
  (see Open questions). When it does, it goes here. Until then the slot stays
  empty on purpose — do not fill it with something else.

Built with `ReanimatedSwipeable` from `react-native-gesture-handler`, which is
already installed.

### Press states and targets

Rows highlight with a background fill on iOS and a ripple on Android. **Not**
`opacity: 0.6` — that is the React Native default and it is wrong on both
platforms. Buttons may use opacity or a slight scale.

Anything smaller than about 44×44pt gets `hitSlop`. `QuickActionSheet` already
does this (`hitSlop={12}`) and is the example to copy.

---

## Feedback

### Haptics

One wrapper, `src/feedback/haptics.ts`, whose functions are named after events —
`haptics.itemCompleted()`, never `impactAsync(Heavy)` at a call site.

| What happened | What plays |
| --- | --- |
| Toggle, segmented control, picker step | `selectionAsync()` |
| Saved, task completed | `notificationAsync(Success)` |
| Validation failed, write rejected | `notificationAsync(Error)` |
| Swipe passes its threshold | `impactAsync(Light)` |
| Hold-menu opens | `impactAsync(Medium)` |
| Sheet snapping to a detent | nothing — the platform does it |
| Pull-to-refresh fires | `impactAsync(Light)` |
| Ordinary taps, scrolling, navigation | **nothing** |

That last row is the important one. Buzzing on every tap is what makes an app
feel cheap.

**A haptic is never the only signal.** iOS plays nothing at all in Low Power
Mode, when the user has turned haptics off, while the camera is open, or during
dictation. If the only way to know something worked is a buzz, it did not work
for those people.

### Messages: usually none

The confirmation is the screen changing. A task you added appears in the list —
nothing needs to say "Task added".

Words appear in exactly two cases:

- **Undo.** "Deleted — Undo" needs somewhere to put the button.
- **A failure you did not cause** — a background sync failing while you are
  elsewhere.

Drawn as a snackbar on Android, which has that convention, and something quieter
on iOS, which does not.

### Undo or confirm — never both

- **Reversible things just happen**, with undo offered: completing, unpinning,
  un-sharing. Asking first would be nagging.
- **Permanent things ask first**, with an alert that names what is going: a
  recipe, a task list, leaving a Group.

Deleting in gather is permanent today — 32 hard `.delete()` calls, and no
`deletedAt` anywhere in the schema. That is why the second rule exists, and it
is what would change if archive ever lands.

An action that confirms *and* offers undo has decided it is dangerous and then
decided it is not. Pick one.

### Completing a task puts it away

A completed task leaves the active list and drops into a collapsed
**Completed (n)** section at the bottom, which expands on tap. Un-completing
restores it — `done` is a boolean, so this costs nothing.

Note this is a change: `convex/tasks.ts` currently sorts completed tasks to the
bottom and leaves them visible.

---

## While you wait

**Loading.** A skeleton of the eventual layout on first paint of a list or
detail screen — it is what stops the layout jumping. Nothing at all when
re-querying something already on screen; Convex is live, and the content you can
see is almost always right. A spinner only inside a control someone just
pressed. Never a full-screen spinner over content that already exists.

**Optimistic writes.** Use Convex's `withOptimisticUpdate` for small, frequent,
reversible writes — completing a task, toggling a pin, adding from the launcher.
Everything else waits for the server. Create new objects inside the update;
mutating existing ones corrupts the client's state.

**When an optimistic write fails, the rollback must be visible.** A checkbox
that silently un-checks itself is worse than a slow one.

**Pull to refresh** appears only where it genuinely fetches — task lists backed
by Notion and Todoist, which sync on demand (ADR-0021). Everywhere else Convex
is already live, and a refresh gesture that does nothing is a lie. Elsewhere,
the connection banner is the honest signal.

**Empty states** come in three kinds, one component with a `kind`:

- *Nothing yet* — one button that adds the first thing.
- *Nothing found* — a way to clear the search or filter, never an add button.
- *Nothing here for you* — a placeholder Module, a Group you have not joined.
  An explanation and no action.

---

## Chrome

**Tabs.** The fixed five (ADR-0018), with `minimizeBehavior="onScrollDown"` so
the bar shrinks as you scroll, and `role="search"` on Search so iOS 26 draws it
as its own capsule. Badges only when something genuinely needs counting.

**Titles.** Large titles on Module index screens; small inline titles on
anything you push into.

**Getting out.** The native back button and the swipe-from-edge gesture. **No
breadcrumbs on the phone** — [ADR-0013](adr/0013-a-nested-page-carries-its-own-trail.md)
is a web rule and does not cross. What does cross is its second half: back goes
to the parent, never to history. Every deep-linkable screen must have a working
parent when opened cold.

**Quick actions.** Kinds are ADR-0018's: `row` grows a field in the launcher,
`sheet` swaps the launcher's body, `handoff` pushes the Module's own screen. One
addition: **a `handoff` returns you where you started.** You pressed Add from
the Baby module; saving a recipe should not leave you standing in Recipes.

**Forms.** First field autofocused. `returnKeyType` chains `next` → `next` →
`done`. The last field submits. The primary button is disabled until valid, and
submitting twice does not save twice. `QuickActionSheet` already does all of
this and is the reference. A validator returns a message key, not a sentence
(ADR-0011).

---

## Dependencies

Adopted: **`@expo/ui`** — context menus and native sheets, inside the Expo
release train, works in Expo Go.

Already installed and now actually used: `expo-haptics`,
`react-native-gesture-handler`, `react-native-reanimated`.

Deliberately not adopted: `@gorhom/bottom-sheet` (nothing here needs a
JavaScript-drawn sheet), `zeego` (only if `@expo/ui`'s menu turns out to lack
the blur-and-lift presentation). Deferred until something actually breaks:
`react-native-keyboard-controller`, and a toast library.

**`expo-glass-effect` only where something needs it.** Glass belongs to chrome
that floats over scrolling content. Cards, tiles and rows are content. And the
tab bar is already glass for free. Below iOS 26 and on Android a `GlassView`
silently becomes a plain `View`, so never build a layout that only reads
correctly with glass.

---

## Open questions

**How the Add launcher is built.** Two candidates: `@expo/ui`'s `BottomSheet`,
which opens over the current screen and has no address, or an `expo-router`
`formSheet`, which is a route with detents and a grabber for free. ADR-0018
requires that pressing Add never navigates, and whether a `formSheet` presented
from the tab press counts as navigating is a question about behaviour, not about
documentation. **Decided on the phone, both built, before either is written
down.** Watch for [expo/expo#47831](https://github.com/expo/expo/issues/47831),
where a sheet containing further navigation renders the wrong background on
iOS 26 — which is the launcher's exact shape.

Either way, the hand-built `Modal` in `QuickActionSheet` retires.

**Archive.** It does not exist: no flag on any table, nothing hidden-but-kept.
Adding it means a column, a filter on every query that reads those rows, a place
to see archived things, and a `docs/migrations/` note — a project, not a UI
change. Tasks are the exception and need nothing: completing already puts a task
away, reversibly.

**Verify the two Apple sources.** The detent and haptics guidance here came from
search excerpts, because the HIG could not be fetched when the survey was
written. Confirm against the real pages before treating them as settled:
[Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets),
[Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics).
