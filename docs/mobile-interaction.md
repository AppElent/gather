# How gather mobile behaves

The rules the phone app follows: what a press does, what a swipe does, what
buzzes, what appears while things load. Decided 2026-08-21 from the survey in
[`docs/research/mobile-interaction-vocabulary.md`](research/mobile-interaction-vocabulary.md),
which has the research, the alternatives and the versions behind each rule.

This file is the short version, and it is the one to obey. **When you add a
screen, it follows these rules; when a rule turns out to be wrong, change it
here rather than making an exception in a component.**

The block below started as the shared `guidance` catalog feature in
`AppElent/appelent-packages`. That feature was retired in 0.3.0 — it stamped
docs into apps and versioned them per app, which never fit a catalog whose
contract is "ready-made modules you add to an app", and no app ever adopted
it. This copy is gather's own now: edit it here, there is nothing left to sync
against. Gather's specifics live in "How this maps to gather" below it.

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

**Search.** A screen whose whole job is search gets `Stack.SearchBar`, never
a hand-rolled field. It is UIKit's `UISearchController`, so it pairs with the
`role="search"` capsule above: on iOS 26 the field docks above the keyboard
with its own cancel capsule beside it, and the same declaration renders the
top search bar Android expects. Leave `placement` and `allowToolbarIntegration`
at their defaults — that is what picks bottom or top per platform, and what
degrades correctly below iOS 26. Cancel (leaves search) and clear (empties the
field) are two different controls and the platform draws both.

A field that filters a list already on screen is the other case, and it is
`src/components/SearchField.tsx` — one component, because `clearButtonMode`
is iOS-only and five copies of it left Android with no way to empty a query
that found something.

**Titles.** Every screen gets a native title and lets the platform decide
what it does, based on which of three things the screen is:

- **Index** — the root of a tab. `headerLargeTitle`: starts big and
  shrinks into the bar as content scrolls under it; a screen whose
  content fits simply keeps it big, which costs nothing because there is
  no scrolling to get out of the way of.
- **Pushed** — the default for anything you navigate into: a list, a
  form, a settings sub-page. Back button, small inline title.
- **Detail** — a screen about one record recognized by its picture (a
  photo, a video): no title text in the bar at all. The header, the
  media, and — if the record has them — a local tab strip stay pinned;
  only the body beneath scrolls. The record's real name lives in that
  pinned content, not in the bar.

**Which of the three is decided by content, not by nesting depth.**
Default to Pushed. Promote to Detail only when what's on screen is a
record you'd recognize by its picture — a Recipe with a photo, not a
Food item with none, and not a list of either. There is no other
per-screen judgment to make: once you know which of the three a screen
is, everything else below follows.

Opt out only with a stated reason: a header that has to hold a control
the native one has no slot for, or a sheet, which has no header at all.

A heading drawn as a `<Text>` inside the scroll view is not a title —
normally. It scrolls away and the screen stops saying what it is. **The
one exception is Detail**, where the pinned header keeps the screen
self-identifying regardless of scroll position, so the real title is
free to live in the scrolling body as ordinary content instead of in the
bar.

**Every screen keeps a `title` set on its header, even a Detail screen
that draws nothing from it.** It costs one line, and it's the only thing
VoiceOver and the app-switcher have to name a screen with no visible
title.

**Wiring an Index title takes three things, and then a precondition.**
`headerLargeTitle` on the stack; `headerShown: true` with a `title` on
the screen, if the stack defaults it off; and
`contentInsetAdjustmentBehavior="automatic"` on the scroll view, which is
what names the scroll view the title collapses against. Miss the third
and the title sits big forever.

Then the precondition, which is the one that costs an afternoon: **the
scroll view must be the screen's first subview.** UIKit only honours
`automatic` there. Nested one level down — inside a `<View style={{flex: 1}}>`
wrapping a scroll view and a pinned bar, say — it silently degrades to
`scrollableAxes`, which still adjusts insets, so the screen looks correct
and only the collapse is missing. No warning, nothing to grep for. Make
the scroll view and the pinned bar siblings; `collapsable={false}` on the
wrapper is the escape hatch when you genuinely cannot flatten it.

**Wiring a Detail screen is a fixed region, not a collapse.** The
header, the media, and the optional tab strip are laid out as ordinary
pinned views above a `ScrollView` that holds only the body — nothing in
the pinned region ever moves, so none of the Index screen's scroll-linked
machinery applies. Which component draws the tab strip is deliberately
left open here.

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
own screen.

Two additions, and which one applies depends on what the handoff is for:

- **A quick capture returns you where you started.** You pressed Add from
  the Baby module; saving a task should not leave you standing in Tasks.
- **A review-and-save lands you on what you made.** Where the screen exists
  so that somebody can *check* something before it is written down — a
  recipe import, which arrives partly parsed and partly guessed — the
  finished thing is what you want next, to fix whatever the import got
  wrong. The screen changing is the confirmation, and here it has somewhere
  to change to. Use `replace`, not `push`: the form has done its job and
  Back must not return to something that would save a second copy.

The first rule was the only one until Recipes needed the second. It is
written down here rather than excepted in a component, which is what the
last line of this document asks for.

**Titles.** The All tab and the baby log's main screen both drew their own
headings until 2026-08-21; both are native titles now, and `ChildScreen`'s
`LogBar` is a sibling of its scroll view rather than sharing a wrapper with
it, which is what was suppressing its collapse. `settings/index.tsx` is the
one screen still drawing its own heading — a bigger job than the others,
because its search field would become `headerSearchBarOptions`. Search was
the same job and was done on 2026-08-31: it grew a `search/_layout.tsx` so it
had a header for `Stack.SearchBar` to live in, which is also what got it
`TabSafeArea`.

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

**Sheet mechanism.** `src/components/NativeSheet.tsx` is the shared content
convention around `@expo/ui`'s `BottomSheetModal`. The hand-built `Sheet` is
retired: presentation, drag, keyboard handling, backdrop, and dismissal are
platform-owned.

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
