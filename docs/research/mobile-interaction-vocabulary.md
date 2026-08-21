# Interaction vocabulary for the gather mobile app

*This document predates and is not synced by the `guidance` catalog
feature — it's gather's own project-specific survey, not the generic
research note that feature's `mobile-interaction` step would otherwise
copy in. See `docs/mobile-interaction.md`'s intro for how the two relate.*

**This is a survey, not a decision.** It exists so that the decisions can be
argued about one at a time instead of being made accidentally, one component at
a time, by whoever writes the next screen. Where it recommends, it recommends
with its reasoning exposed, so the decision can disagree with the reasoning
rather than with the conclusion.

The output of the decisions is a short prescriptive guidance file — the rules a
future change obeys — plus, for anything load-bearing, an ADR. Nothing here is
binding yet.

Compiled 2026-08-20. Package versions were read from the npm registry that day,
not recalled. Verification status of every source is recorded in §16, and it is
uneven: Expo's documentation, the Convex documentation and the packages
installed in `apps/mobile/node_modules` were fetched and read; Apple's Human
Interface Guidelines could not be fetched from this environment (the HIG is a
client-rendered site and the data endpoints 404 behind the proxy), so HIG
content here comes from search excerpts and is marked `HIG (excerpt)` wherever
it is used. Treat those lines as needing a confirming read before they become
rules.

---

## 0. Three local facts that make this question gather's, not generic

A generic "how do I do mobile UX" answer gets this wrong three ways.

### The shell is already decided, and it is already native

[ADR-0017](../adr/0017-the-phone-owns-its-look-and-shares-its-words.md) put the
phone's look in a typed token module and handed navigation chrome to
`expo-router`'s `Stack` and `NativeTabs`.
[ADR-0018](../adr/0018-mobile-tabs-are-app-destinations-and-one-of-them-is-a-verb.md)
fixed the five tabs, made Add a verb that opens a launcher without navigating,
and gave each Module's quick action a declared `kind` (`row` / `sheet` /
`handoff`).

So this survey is not free to propose a hand-drawn interaction language. Most of
what follows either rides on a native component gather already renders, or has
to argue explicitly for leaving one.

### Everything below the shell is greenfield — including the parts already installed

`apps/mobile` ships `expo-haptics`, `react-native-gesture-handler` (2.32.0) and
`react-native-reanimated` (4.5.1), and as of today calls **none of them**. A
`grep` for `Haptics`, `reanimated` and `gesture-handler` across `app/` and
`src/` returns nothing. There is no swipe action, no long press, no context
menu, no toast, no skeleton, and no optimistic write anywhere in the app.

That is unusually good news: there is no legacy vocabulary to migrate. The first
rule written is the rule.

The one interaction that does exist is `QuickActionSheet` — a hand-built
`Modal` + scrim + `Pressable` grabber with `opacity: 0.6` press states. It is
the de-facto precedent for "sheet" and for "pressed", and §3 and §5 both have to
say whether it stays that way.

### The verification story is inverted from the ADRs' assumptions

The README and CLAUDE.md are written for a Windows machine driving an Android
emulator, and say plainly that Apple targets do not work from there. But **iOS
is the primary platform** for this app, and the primary device is a real iPhone.

That reshapes the cost of every recommendation below. An iOS-only capability is
not a thing that has to wait for a Mac; it is a thing verified by installing a
dev build on the phone (EAS build, `--profile development`) and driving it by
hand. What it is *not* is a thing `agent-device` can verify on the emulator —
so an iOS-only rule is a rule an agent cannot check, and that is a real cost
that belongs in each decision rather than in a footnote.

---

## 1. Posture: iOS is the reference, Android is the honest port

Taken as given from the brief, recorded here because everything downstream leans
on it:

- **The app should feel like the OS it is running on**, not like a cross-platform
  compromise and not like gather-on-the-web. On iOS 26 that specifically means
  Liquid Glass chrome, native sheets with detents, `UIMenu` context menus, and
  the Taptic vocabulary users already know from Mail and Messages.
- **Todoist and GitHub are the reference apps.** Both are cross-platform apps
  that nonetheless read as native on iOS. Neither invents furniture.
- **Android gets the same behaviour drawn by Material**, not the same pixels.
  Where Material genuinely disagrees with UIKit — snackbars vs. no snackbars,
  overflow menus vs. long-press menus, the back gesture — the Android answer is
  Material's, and the topic says so explicitly rather than pretending the
  platforms agree.

The important consequence: **gather should almost never draw its own chrome.**
Every topic below is scored partly on "does this let the platform draw it".

### What Liquid Glass costs and what it gives

Worth stating once, since it colours §2, §3 and §4.

Most of it is free. Recompiling against the iOS 26 SDK gives system controls the
Liquid Glass treatment automatically, and `NativeTabs` documents that on iOS 26
the tab bar derives its background from the content beneath it — to the point
that **background props have no effect there** ([Expo][expo-nt]). gather's tab
bar is already Liquid Glass, today, without a line of code.

What is *not* free is glass on gather's own surfaces, which needs
`expo-glass-effect` (57.0.1, bundled with SDK 56+, works in Expo Go). Its
constraints are sharp and worth knowing before designing anything around it
([Expo][expo-glass]):

- **iOS 26+ only.** Below that, and on Android, `GlassView` silently falls back
  to a plain `View` — so any layout that only reads correctly *with* glass is a
  layout that breaks on Android and on iPhones a year old.
- **Availability must be checked at runtime.** `isGlassEffectAPIAvailable()`
  exists because some iOS 26 betas crash without it.
- **`opacity: 0` disables the effect entirely.** Fading glass means the
  component's own `glassEffectStyle` animation props, not an opacity animation.

And the design guidance is mostly a list of don'ts: no `blur`, `opacity` or
`background` on a glass view; no solid fill behind one; no `clipShape`; no
nested glass containers; and no second glass layer on toolbars and tab bars,
which already have one. iOS 26 also enforces container corner radii for
concentricity rather than letting an app override them
(WWDC25 §284 + community write-ups — see §16).

**Reading:** glass is chrome that floats over scrolling content. gather's cards,
tiles and rows are content. The honest scope for `expo-glass-effect` in this app
is small — a floating control or two — and "the tab bar already does it for
free" may be the whole answer.

---

# Part A — Chrome and navigation

## 2. Tabs, and the three iOS 26 affordances gather is not using

`NativeTabs` already draws the fixed five. Three documented props are unused and
each is a decision, not a tweak ([Expo][expo-nt]):

| Prop | What it does | Why it matters here |
| --- | --- | --- |
| `minimizeBehavior="onScrollDown"` | The iOS 26 bar shrinks to a pill as you scroll down and returns as you scroll up. Android from SDK 55+. | ADR-0018 explicitly bought the real `UITabBarItem` *in order to get* this behaviour, and then did not turn it on. Long lists — Recipes, Tasks, All — are where the app spends its screen. |
| `role="search"` on the Search trigger | Makes it a real search tab: iOS 26 renders it as a separate glass capsule beside the bar, not a fifth equal item. Needs Xcode 26+. | gather has a Search tab. This is the platform drawing exactly the thing ADR-0018 described. |
| `NativeTabs.Trigger.Badge` | Native count/dot badges. | The only honest home for "3 tasks due today" if Home ever wants to say so from the bar. |

Two limitations to design around: **the tab bar height cannot be measured**, and
there is **no dynamic add/remove of tabs** — both of which the fixed five already
accommodate, which is a point in ADR-0018's favour rather than a problem.

`BottomAccessory` (a real `UITabBarController.bottomAccessory` riding above the
bar) was considered and rejected in ADR-0018 as iOS-26-only. Under an iOS-first
posture that rejection is worth **re-examining, not reversing**: the reason it
lost was that it would need a second control for Android, and that reason has not
changed.

- **Recommendation:** turn on `minimizeBehavior` and `role="search"`; leave
  badges until something needs to count; leave `BottomAccessory` closed.
- **Open:** does `minimizeBehavior` interact badly with the disabled Add slot?
  Unverified, and cheap to check on device.

## 3. Sheets — three mechanisms, and gather currently uses the fourth

This is the largest fork in the document, because gather has four options and is
presently using the worst one.

| Mechanism | What it really is | Detents | Cost |
| --- | --- | --- | --- |
| **`expo-router` `presentation: 'formSheet'`** | A route, presented by `react-native-screens` as a real `UISheetPresentationController` / Material bottom sheet | `sheetAllowedDetents`, `sheetInitialDetentIndex`, `sheetGrabberVisible`, `sheetCornerRadius`, `sheetLargestUndimmedDetentIndex` | Already installed. Sheet content is a route, so it gets deep links and back-navigation for free |
| **`@expo/ui` `BottomSheet`** | SwiftUI `sheet` on iOS, Compose `ModalBottomSheet` on Android, `vaul` on web; API-compatible with gorhom | `snapPoints`, or sizes to content | One new dependency (`@expo/ui` 57.0.12), in Expo Go, no custom handle/backdrop/footer |
| **`@gorhom/bottom-sheet`** | JS-driven on the UI thread via Reanimated worklets | Full control, `BottomSheetFlatList`, keyboard handling | 5.2.14. Most capable, least native. Its own animation curve, not the platform's |
| **hand-built `Modal` + scrim** | what `QuickActionSheet` does today | none | none, and it shows: no drag-to-dismiss, no detents, no native material |

The HIG's position on the shape itself (excerpt): the system defines `medium`
(≈half height) and `large` detents; a resizable sheet should **include a
grabber**, which both signals resizability and cycles detents on tap; the medium
detent exists for progressive disclosure, and compose-style sheets that need the
room should be large-only.

Read against gather's launcher, that is a precise description of what
`QuickActionSheet` is imitating by hand — and of what it gets wrong. A `row`
action that grows a field in place is exactly a medium detent expanding to
large.

Two traps if `formSheet` wins, both real and both recent:

- **No native stack headers and no nested stack navigators inside a form sheet.**
  Headers and actions have to be part of the sheet's own content. gather's
  launcher has a header with a back affordance — that is content here, not
  chrome.
- **[expo/expo#47831](https://github.com/expo/expo/issues/47831)**: a form sheet
  containing a nested `Stack` renders the navigation theme background instead of
  the native sheet material on iOS 26. Directly in the blast radius of "Add
  opens a sheet that can push".

- **Recommendation:** `formSheet` for anything that is a *place* (create,
  edit, filter, a Module's quick flow); `@expo/ui` `BottomSheet` only if a sheet
  must open over the current screen without being a route; `@gorhom` only if
  something needs an interaction the platform sheet cannot express, which
  nothing in gather currently does. The hand-built modal retires either way.
- **Open:** whether the Add launcher itself becomes a `formSheet` route. It is
  the one sheet that ADR-0018 requires *not* to change the route. A sheet
  presented from `(tabs)/add`'s `tabPress` is not the same thing as navigating
  to it, and which of those `formSheet` actually is needs checking on device
  before this is decided.

## 4. Headers, back, and where the trail went

The web app's rule — [ADR-0013](../adr/0013-a-nested-page-carries-its-own-trail.md),
a nested page renders its own breadcrumbs — has no iOS equivalent and should
not get one. iOS's answer to "where am I and how do I get out" is the native
back button with the parent's title, plus the interactive swipe-from-edge
gesture. Android's is the system back gesture. Both come free with
`Stack`; a drawn breadcrumb trail on a 390pt-wide screen is web furniture.

What ADR-0013 *does* carry across is its second rule: **back points at the
parent's address, never at history**. On the phone the navigator already
guarantees that for pushes; the place it can break is a deep link that lands
mid-hierarchy with nothing beneath it.

- **Recommendation:** no breadcrumbs on the phone; native `Stack` headers with
  large titles on Module indexes (`headerLargeTitle`) and inline titles below;
  every deep-linkable screen must have a working parent when opened cold. Write
  the ADR-0013 exception down, since a reader of the web rule will otherwise
  assume it applies.
- **Open:** large titles or not. GitHub uses them, Todoist largely does not.

---

# Part B — Touch vocabulary

## 5. Press states, hit targets, and the thing every RN app gets subtly wrong

Today every pressable in `apps/mobile` uses `opacity: 0.6` while pressed. That
is the React Native default idiom, and it is wrong on both platforms: iOS
highlights a *row* with a background fill rather than fading its content, and
Android draws a ripple from the touch point.

`react-native-gesture-handler` 2.32 — already installed — ships its own
`Pressable` with `android_ripple` support and gesture-system integration, which
matters as soon as a pressable lives inside something that scrolls or swipes.

- **Recommendation:** rows and list items get a background-fill press state on
  iOS and a ripple on Android, expressed once in a shared `Row`/`Pressable`
  wrapper rather than per screen. Buttons keep a subtle opacity or scale.
  Everything below ~44×44pt gets `hitSlop` — `QuickActionSheet` already does
  this correctly with `hitSlop={12}` and is the precedent.
- **Open:** whether the wrapper is a component or a hook returning style.

## 6. Long press and context menus

This is where "feels iOS" is won or lost, and it is the topic with the most
alternatives.

| Option | iOS result | Android result | Dependency |
| --- | --- | --- | --- |
| `onLongPress` + custom popover | drawn by gather | drawn by gather | none |
| **`@expo/ui` SwiftUI `ContextMenu`** | real SwiftUI context menu with the system's preview-and-blur | Compose `DropdownMenu` (separate code path) | `@expo/ui` 57.0.12, in Expo Go |
| `react-native-context-menu-view` (1.21.0) | real `UIMenu` | Android `ContextMenu` | one small native module |
| **Zeego** (3.0.6) | wraps `react-native-ios-context-menu` — real `UIMenu` with previews and submenus | `@react-native-menu/menu` | dev client required — gather has one; last published 2025-03-21 |

The dev-client objection that usually rules Zeego out does not apply here: the
README already treats a development build as the normal way to run this app.
The objection that does apply is freshness — a package last published seventeen
months ago, sitting on top of two other native modules, in an app that upgrades
Expo SDKs.

What the reference apps do, as **observation rather than verified source**:
GitHub leans heavily on long-press context menus over list rows; Todoist uses
long press primarily for drag-to-reorder, with a separate row menu. That is a
genuine fork — long press cannot be both on the same row without one of them
winning after a delay.

- **Recommendation:** `@expo/ui`'s `ContextMenu` first, on the grounds that it
  is the only option that adds no native module outside the Expo release train
  and still produces a real system menu. Reach for Zeego only if the SwiftUI
  component turns out not to support the preview-and-blur presentation that makes
  an iOS context menu feel like one.
- **Open, and important:** what long press *means* in gather. Menu, or reorder?
  Pick one globally; a per-screen answer is how an app stops being predictable.
- **Rule that should survive whatever wins:** a long press is never the only way
  to reach an action. Everything in a context menu is also reachable from the
  detail screen or a swipe.

## 7. Swipe actions on rows

`ReanimatedSwipeable` is present in the installed `react-native-gesture-handler`
2.32 (`src/components/ReanimatedSwipeable/`), alongside the legacy Animated-based
`Swipeable`. New code should use the Reanimated one. Android's own idiom is
Compose's `SwipeToDismissBox`, which behaves the same way from the user's side.

The vocabulary question is not "can we" but "what does a direction mean", and
the answer has to be global. Todoist's is roughly: swipe one way completes,
the other opens scheduling. Mail's is: one way archives, the other flags.
gather's rows are heterogeneous — a task, a recipe, a food, a pinned Module —
and a direction that means "complete" on a task must not mean "delete" on a
recipe.

- **Recommendation:** at most two actions per row, one per direction; the
  destructive one is never the *short* swipe (a full swipe that deletes
  something without confirmation is a bug that ships); the leading direction is
  reserved for the row's primary verb (complete a task, cook a recipe) and the
  trailing one for a menu-ish secondary. Rows that have no meaningful verb get
  no swipe at all rather than a made-up one.
- **Open:** does delete-by-swipe exist in gather, and if so does it go through
  undo (§13) or through confirmation (§9)? These are alternatives, not a
  sequence.

## 8. Pull to refresh

Convex is a live-query backend: lists update themselves without asking. That
makes pull-to-refresh nearly meaningless as a data operation, and *not*
meaningless as a gesture — people pull to reassure themselves, and its absence
reads as staleness.

The exception is real: the Tasks module's external providers (Notion, Todoist)
sync manually per
[ADR-0021](../adr/0021-task-backend-capabilities-and-manual-sync.md). There,
pulling actually does something.

- **Recommendation:** `RefreshControl` wherever a list is backed by an external
  provider that syncs on demand, because there it is honest. Elsewhere, prefer
  the connection banner (§12) over a gesture that pretends to fetch.
- **Open:** whether "honest only" or "everywhere, for consistency" is the better
  answer for a household app whose users will not know which lists are external.

## 9. Destructive actions and confirmation

Three shapes, and the platforms diverge:

- **`Alert`** — a modal with a red destructive button. Correct on iOS for
  irreversible destruction, and correct on Android too.
- **Action sheet** — iOS's idiom for "confirm this destruction that you started
  from a swipe or a menu", where the sheet also names what is being destroyed.
- **Undo** — Material's answer (snackbar with UNDO), and increasingly iOS's for
  anything recoverable.

The rule worth extracting: **confirmation and undo are alternatives.** An app
that confirms *and* then offers undo has decided the action is dangerous and
then decided it is not.

- **Recommendation:** anything recoverable (complete, archive, remove from a
  list) uses undo and no dialogue; anything genuinely irreversible (delete a
  recipe, leave a Group, delete a task list with contents) uses an alert that
  names the object. Nothing uses both.
- **Open:** which of gather's destructive actions are actually recoverable —
  a Convex-level question, not a UI one, and the answer may be "none of them are
  today", which would make undo a backend change rather than a component.

## 10. The haptic vocabulary

`expo-haptics` is installed and unused. Its API ([Expo][expo-haptics]):
`impactAsync` (`Light`/`Medium`/`Heavy`/`Rigid`/`Soft`), `notificationAsync`
(`Success`/`Warning`/`Error`), `selectionAsync()`, and
`performAndroidHapticsAsync` for the ~20 Android-specific patterns.

Two constraints decide the shape of any rule here. First, the platform one:
**iOS silently plays nothing** when Low Power Mode is on, when the user has
turned system haptics off, while the camera is active, or during dictation.
Second, the guidance one — the HIG's line (excerpt) is that haptics *supplement*
visual feedback and that system-defined haptics should be used consistently so
people are not confused. Together they give the only rule that really matters:
**a haptic is never the only signal that something happened.**

A starting vocabulary, offered as a table because that is the form it needs to
end up in:

| Event | Call | Why |
| --- | --- | --- |
| Toggle, segmented control, picker step | `selectionAsync()` | What the system uses for exactly this |
| Quick-add saved, task completed | `notificationAsync(Success)` | An outcome, not a collision |
| Validation failed, mutation rejected | `notificationAsync(Error)` | Pairs with the inline error, never replaces it |
| Swipe action passing its threshold | `impactAsync(Light)` | The one place a haptic is genuinely load-bearing: it is how you know you have gone far enough without watching |
| Long press opening a context menu | `impactAsync(Medium)` | Matches the system's own menu haptic |
| Sheet snapping to a detent | none | The platform sheet already does this |
| Pull-to-refresh firing | `impactAsync(Light)` | Convention |
| Navigation, scrolling, ordinary taps | **none** | This is the overuse that makes an app feel cheap |

- **Recommendation:** adopt the table as-is, in one `src/feedback/haptics.ts`
  wrapper that names events rather than intensities — call sites say
  `haptics.itemCompleted()`, never `impactAsync(Heavy)`. That wrapper is also
  where the Android divergence (`performAndroidHapticsAsync`) lives, and where a
  future "reduce haptics" preference would.
- **Open:** whether `Heavy` is ever right in this app. Probably not.

---

# Part C — Feedback and state

## 11. Loading

Convex queries return `undefined` while loading, which makes "what do we render"
a decision every list makes, and currently makes differently.

The choices are the usual three: a spinner, a skeleton of the eventual layout, or
nothing (render the last known content and let it update). Live queries make the
third viable more often than in a REST app — a cached list is usually correct.

- **Recommendation:** skeletons for first paint of a list or detail screen,
  because they are what stop the layout jumping; nothing at all for a re-query
  where content is already on screen; a spinner only inside a control that the
  user just pressed. No full-screen spinners over content that already exists.
- **Open:** whether skeletons are worth their maintenance in a 13-Module app, or
  whether a quiet placeholder tile is enough.

## 12. Optimistic writes, and the offline story

Convex supports `withOptimisticUpdate` on mutations, with `localStore.getQuery` /
`setQuery`, automatic rollback when the mutation resolves, and one hard rule:
**never mutate objects in the update** — new objects only, or the client's
internal state corrupts ([Convex][convex-opt]).

gather mobile is documented as *connected-only* and already has a
`ConnectionLostBanner` and an `AvailabilityProvider`. That is the right posture
and it makes optimism a UX choice rather than an offline strategy.

- **Recommendation:** optimistic updates for the small, high-frequency, safely
  reversible writes — completing a task, toggling a pin, adding via the
  launcher. Everything else waits for the server and shows its result. Where a
  write fails, the rollback must be accompanied by a visible error; a silently
  reverted checkbox is worse than a slow one.
- **Open:** does the quick-add launcher stay open optimistically (ADR-0018 says
  saving a `row` action leaves the launcher open), and what does it do when that
  optimistic add later fails and the launcher is gone?

## 13. Toasts, snackbars, and the platform disagreement

Android has a first-class answer: the Material snackbar, bottom of the screen,
optionally with UNDO. iOS has never had one; apps that show toasts on iOS are
importing an Android idiom, and the iOS-native equivalents are (a) doing nothing
and letting the list update, (b) an inline banner, or (c) the small system-style
HUD that `burnt` (0.13.0) renders natively.

Under an iOS-first posture this is the topic where "one behaviour, both
platforms" is most tempting and most wrong.

- **Recommendation:** default to **no toast** — the list changing is the
  feedback, plus the haptic from §10. Reserve a transient message for the two
  cases that genuinely need one: an undoable destruction (§9), and a background
  failure the user did not cause. Draw it as a snackbar on Android and as
  something quieter on iOS — an inline banner or `burnt`.
- **Open:** `sonner-native` (0.27.0, actively published) is the ergonomic
  cross-platform toast library and would be one API for both. It is also
  precisely the app-drawn furniture §1 is suspicious of. This is a real
  trade-off and should be decided rather than defaulted.

## 14. Empty states

The app already has `ModulePlaceholder`, `NoGroup`, `GroupPending` and
`SocialSoon`, so it has four empty-ish states and no stated rule. Three kinds
worth distinguishing, because they want different things:

- **Nothing yet** — the collection is empty and the fix is to add something. Gets
  a single primary action that does exactly that. This is where an empty state
  earns its keep.
- **Nothing found** — a search or filter matched nothing. Gets a way to clear the
  filter, never an "add" button that would create the wrong thing.
- **Nothing here for you** — a Module that is a placeholder, or a Group you have
  not joined. Gets an explanation and no action.

- **Recommendation:** one `EmptyState` component with a `kind`, so the three stay
  visually the same and behaviourally distinct, and so the existing four
  components collapse into it rather than multiplying.

## 15. Keyboard, forms, and submission

`QuickActionSheet` gets the fundamentals right already — `KeyboardAvoidingView`
with the iOS `padding` behaviour, `autoFocus` on the first field,
`returnKeyType` chaining `next` → `done`, and submit-on-last-field. That is the
pattern; it just needs stating.

The known weak spot is `KeyboardAvoidingView` itself, which behaves differently
per platform and badly inside sheets. `react-native-keyboard-controller`
(1.22.4, published 2026-08-17) is the current answer and is a native module.

- **Recommendation:** keep `KeyboardAvoidingView` until a sheet actually
  misbehaves, then adopt `react-native-keyboard-controller` app-wide rather than
  per screen. Submission rules: the primary action is disabled until valid
  (already the launcher's behaviour), submitting is idempotent under double-tap,
  and the keyboard's return key does what the on-screen button does.
- **Rule worth carrying from the web:** a validator returns a key, not a
  sentence ([ADR-0011](../adr/0011-the-ui-is-english-at-the-source-and-translations-are-typed-dictionaries.md)).
  Nothing about the phone changes that, and every new string here lands in both
  message trees.

---

## 16. Sources, and what was actually verified

**Fetched and read (primary):**

- [Expo — GlassEffect][expo-glass] · [Expo — Haptics][expo-haptics] ·
  [Expo — UI (`@expo/ui`)][expo-ui] ·
  [Expo — `@expo/ui` BottomSheet][expo-ui-sheet] ·
  [Expo — Native tabs][expo-nt]
- [Convex — Optimistic updates][convex-opt]
- `apps/mobile/node_modules/react-native-gesture-handler@2.32.0` — source read
  directly for `ReanimatedSwipeable`, `Swipeable` (legacy) and `Pressable`
- npm registry, 2026-08-20, for every version number in this document

**Search excerpts only — not fetched, marked `HIG (excerpt)` in the text:**

- [Apple HIG — Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)
  (detents, grabber, progressive disclosure)
- [Apple HIG — Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics)
  (supplement visual feedback; use system-defined haptics consistently)
- Liquid Glass don'ts, drawn from [WWDC25 §284](https://developer.apple.com/videos/play/wwdc2025/284/)
  coverage and community write-ups rather than from the HIG itself

Apple's documentation site could not be fetched from this environment: the HIG
renders client-side and its data endpoints return 404 through the proxy. **Every
HIG-derived line above should be confirmed against the real page before it
becomes a rule**, and the two that most deserve it are the sheet detent guidance
(§3) and the haptics best practices (§10).

**Observation, not source:** everything said about how Todoist and GitHub behave.
Those are recollections of using the apps. They are useful for framing a choice
and are not evidence for one; check them on the phone before citing them in a
decision.

**Not researched, deliberately out of scope:** motion tokens and screen
transitions, shared-element animation, the type and spacing scale, accessibility
beyond touch targets and the haptics/visual pairing rule, and iPad layout.

[expo-glass]: https://docs.expo.dev/versions/latest/sdk/glass-effect/
[expo-haptics]: https://docs.expo.dev/versions/latest/sdk/haptics/
[expo-ui]: https://docs.expo.dev/versions/latest/sdk/ui/
[expo-ui-sheet]: https://docs.expo.dev/versions/latest/sdk/ui/drop-in-replacements/bottomsheet/
[expo-nt]: https://docs.expo.dev/router/advanced/native-tabs/
[convex-opt]: https://docs.convex.dev/client/react/optimistic-updates

---

## 17. The dependency shortlist, if every recommendation above were taken

| Package | Version | For | Verdict |
| --- | --- | --- | --- |
| `expo-haptics` | installed | §10 | already there, just unused |
| `react-native-gesture-handler` | 2.32.0, installed | §5, §7 | already there, just unused |
| `react-native-reanimated` | 4.5.1, installed | §7 | already there, just unused |
| `@expo/ui` | 57.0.12 | §6 context menus, §3 non-route sheets | **add** — Expo release train, Expo Go, no extra native module |
| `expo-glass-effect` | 57.0.1 | §1 | **add only when something needs it**; the tab bar is already glass for free |
| `burnt` *or* `sonner-native` | 0.13.0 / 0.27.0 | §13 | **defer** — decide the toast question first |
| `react-native-keyboard-controller` | 1.22.4 | §15 | **defer** — adopt when `KeyboardAvoidingView` actually breaks |
| `zeego` | 3.0.6 | §6 | **no**, unless `@expo/ui`'s context menu lacks the preview presentation |
| `@gorhom/bottom-sheet` | 5.2.14 | §3 | **no** — nothing in gather needs a JS-drawn sheet |

Net: one dependency added now, one added on demand, three deferred behind a
decision, two rejected.

---

## 18. The decisions this survey is asking for

In rough order of how much else depends on them:

1. **What does a long press mean** — context menu, or drag-to-reorder? (§6)
2. **Does the Add launcher become a `formSheet` route**, given ADR-0018 requires
   it not to change the route? (§3)
3. **Toast or no toast on iOS**, and does that pull in a library? (§13)
4. **Undo or confirm** for each destructive action — which in turn asks whether
   gather's deletes are recoverable at all. (§9, §12)
5. **The haptic table** — adopt as written, or amend? (§10)
6. **Swipe directions**: one global meaning per direction, and whether delete is
   ever one of them. (§7)
7. **`minimizeBehavior` and `role="search"`** — turn on, or leave? (§2)
8. **Pull-to-refresh**: honest-only, or everywhere? (§8)
9. **Large titles** on Module indexes? (§4)
10. **How much of this becomes an ADR** rather than a guidance file. Candidates:
    the long-press meaning, the sheet mechanism, and the "never draw chrome the
    platform can draw" posture itself.
