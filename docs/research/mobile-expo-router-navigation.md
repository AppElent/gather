# Expo Router navigation primitives in SDK 57

Research for [#142](https://github.com/AppElent/gather/issues/142), part of the
Wayfinder map [#134](https://github.com/AppElent/gather/issues/134). Feeds
[#145](https://github.com/AppElent/gather/issues/145) (what a Group means on a
phone) and the navigation-shape prototype.

Date: 2026-08-12. Everything below was checked against Expo's own documentation,
the `expo:expo-router` / `expo:expo-project-structure` plugin skills, and — for
the question that decides the shell — the **published `expo-router@57.0.12`
build on npm**, not a secondary write-up. Claims that could not be settled from a
primary source are marked **[unverified]** and listed again in §10.

There is no `docs/research/` convention in this repo yet; this file creates it.
`docs/adr/` records decisions, `docs/review-notes/` records review passes, and
neither is the right home for a reading pass that resolves no decision.

---

## 0. Version ground truth, and why the scaffold's version misleads

| | `apps/mobile` today | SDK 57 target |
| --- | --- | --- |
| `expo` | ~54.0.35 | 57.x (`57.0.12` is `latest` on npm as of today) |
| `expo-router` | ~6.0.24 | 57.x — the router's major now tracks the SDK number |
| React Native | 0.81.5 | 0.86 |
| React | 19.1.0 | 19.2 |

Sources: `apps/mobile/package.json`; `npm view expo dist-tags` / `npm view
expo-router versions`; [Expo SDK 57 changelog](https://expo.dev/changelog/sdk-57)
("SDK 57 upgrades to React Native 0.86 (from 0.85), with React remaining at
version 19.2").

**The router jumped from `6.x` to `55/56/57.x`.** Anything you find written
against "expo-router 6" describes the SDK 54 API, and four things moved between
then and now. Each one will bite a copy-pasted snippet:

- **SDK 55**: `NativeTabs`' `Icon` / `Label` / `Badge` stopped being separate
  imports and became compound children — `<NativeTabs.Trigger.Icon>`,
  `<NativeTabs.Trigger.Label>`, `<NativeTabs.Trigger.Badge>`. Android icons moved
  from `drawable` to `md` (Material Symbols).
  ([native tabs docs](https://docs.expo.dev/router/advanced/native-tabs/); expo-router skill, `references/tabs.md`)
- **SDK 55**: header composition components arrived — `Stack.Title`,
  `Stack.Header`, `Stack.Toolbar` — alongside the older `options` object.
  ([stack docs](https://docs.expo.dev/router/advanced/stack/))
- **SDK 56**: *never import from `@react-navigation/*` directly.* Use
  `expo-router/react-navigation`, which re-exports `/native`, `/core`,
  `/routers` and `/elements`. (expo-router skill, "Library Preferences".) The
  scaffold currently has `@react-navigation/bottom-tabs`, `/elements` and
  `/native` as direct dependencies — those should go on upgrade.
- **SDK 56**: `Drawer` is bundled into `expo-router` and backed by
  `react-native-drawer-layout`; `@react-navigation/drawer` is no longer the
  dependency. ([drawer docs](https://docs.expo.dev/router/advanced/drawer/))

`experiments.typedRoutes` is already `true` in `app.json`, and `scheme: "gather"`
is already declared. Both matter below.

---

## 1. The available shells

### The honest split: native chrome vs. a React drawing of it

This is the distinction the ticket asks for, and it is sharper than it looks.

| Shell | Import | What actually renders | iOS | Android |
| --- | --- | --- | --- | --- |
| **`NativeTabs`** | `expo-router/unstable-native-tabs` | **Real platform tab bar.** UIKit `UITabBarController` on iOS, Material 3 bottom navigation on Android | Liquid Glass on iOS 26+, blur, minimize-on-scroll, search-role tab, SF Symbols | Material 3 bar, Material Symbols, **max 5 tabs** |
| **`Tabs` (JS)** | `expo-router` | **React reimplementation.** React Navigation's bottom-tabs, drawn with `View`/`Pressable` | A convincing UIKit imitation (`tabBarVariant: 'uikit'`) — but it is a drawing | `tabBarVariant: 'material'` |
| **Headless tabs** | `expo-router/ui` | **Nothing at all** — `Tabs`, `TabList`, `TabTrigger`, `TabSlot` are unstyled; you draw the bar | whatever you draw | whatever you draw |
| **`Stack`** | `expo-router` | **Real native stack.** `UINavigationController` on iOS, `Fragment` on Android | push-from-right, edge swipe-back, large titles, native header | push-on-top, Material header |
| **`ExperimentalStack`** | `expo-router` | `react-native-screens/experimental` "gamma" stack. **Alpha** | as Stack | **+ predictive back gesture** |
| **`Drawer`** | `expo-router/drawer` | Hybrid — `react-native-drawer-layout`, animated by Reanimated/Worklets on native, CSS on web | not an iOS idiom | a real Material idiom |
| **Modal** | `Stack.Screen options={{ presentation: 'modal' }}` | native modal presentation | card that slides up, dismiss-by-drag | full-screen-ish |
| **Form sheet** | `presentation: 'formSheet'` + `sheetAllowedDetents` | native sheet | real UIKit sheet with detents and grabber | supported, less idiomatic |

Sources: [native tabs](https://docs.expo.dev/router/advanced/native-tabs/),
[JS tabs](https://docs.expo.dev/router/advanced/tabs/) ("implemented with React
Navigation's bottom tabs"), [custom tabs](https://docs.expo.dev/router/advanced/custom-tabs/),
[stack](https://docs.expo.dev/router/advanced/stack/) ("uses
`UINavigationController` on iOS and `Fragment` on Android… animations and
gestures are handled by the platform"), [experimental stack](https://docs.expo.dev/versions/latest/sdk/router/experimental-stack/),
[drawer](https://docs.expo.dev/router/advanced/drawer/).

### Notes that change what you'd pick

- **`NativeTabs` is alpha and says so.** "Native tabs is in alpha and is
  available in SDK 54 and later. Its API is subject to change." The import path
  is still literally `expo-router/unstable-native-tabs` in SDK 57. That is not a
  reason to avoid it — Expo's own skill says "Always prefer NativeTabs… for the
  best iOS experience" — but it is a reason not to build load-bearing custom
  behaviour on top of it.
- **`NativeTabs` renders no headers.** A real platform tab bar has no title bar
  attached; you nest a `Stack` inside each tab to get one. This is not a quirk,
  it is how iOS is built.
- **`NativeTabs` cannot nest inside `NativeTabs`**, and says so by throwing:
  `"Nesting Native Tabs inside each other is not supported natively. Use JS tabs
  for nesting instead."` (source: `NativeBottomTabsNavigator.tsx`).
- **`ExperimentalStack` is not a v1 candidate.** It supports exactly four screen
  options (`title`, `headerShown`, `headerTransparent`, `headerBackVisible`), has
  no modal / `transparentModal` / `formSheet` presentation, no custom header
  components, and **cannot coexist with a standard `Stack` on Android**. Its one
  draw is Android predictive back. Revisit when it leaves alpha.
- **A `Drawer` is an Android idiom, not an iOS one.** gather's desktop Sidebar
  will want to become a Drawer on a phone; resist it. iOS has no system drawer,
  and a hamburger menu on iOS reads as a web app wearing a costume.

---

## 2. THE question: can a native tab bar be built from runtime data?

**No. Definitively no, on SDK 57, and not "no for now" — it is designed not to.**

The answer has three independent layers, and each one alone would sink it.

### 2.1 Expo says no, in as many words

From the [native tabs docs](https://docs.expo.dev/router/advanced/native-tabs/),
"Known limitations":

> **No support for dynamically adding or removing tabs.** Dynamically adding or
> removing tabs at runtime is not supported. Tabs should be defined statically in
> your layout file and remain consistent throughout the app's lifecycle.

And on the `hidden` prop, which is the obvious workaround:

> Dynamically hiding tabs will remount the navigator and the state will be reset.
> Change the visibility of the tabs only before the navigator is mounted or when
> it is not visible to the user.

The `expo:expo-router` skill states the same rule twice, in `references/tabs.md`:
"Tabs must be static — no dynamic addition/removal at runtime (remounts
navigator, loses state)" and "**Don't hide the tabs when they are visible** —
toggling visibility remounts the navigator; Do it only during the initial
render."

### 2.2 The mechanism, in the shipped code

This is worth knowing precisely, because it explains exactly *what* breaks and
rules out cleverness. From the **published** `expo-router@57.0.12` build,
`build/native-tabs/NativeBottomTabsNavigator.js`:

```js
const visibleTabsKeys = useMemo(
  () => visibleTabs.map((tab) => tab.routeKey).join(';'),
  [visibleTabs]
);
// ...
createElement(NativeTabsView, {
  ...rest,
  key: visibleTabsKeys,      // <-- this
  focusedIndex,
  provenance: provenanceRef.current,
  tabs: visibleTabs,
  onTabChange,
})
```

The entire native tab view is keyed on **the joined list of visible tab route
keys**. React's rule is unforgiving here: change a `key` and the element is
unmounted and a fresh one mounted in its place.

So:

- **Pin a module** → the joined string gains a segment → key changes → the whole
  tab view remounts. Every tab's nested `Stack` resets to its root, every scroll
  position is lost, and the native tab bar re-inflates (a visible flash).
- **Unpin a module** → same.
- **Reorder pins** → the *join order* changes → **same**. Reordering is exactly
  as destructive as adding, which is the non-obvious part.

There is no cheaper path, because the key is computed inside the navigator from
its own children. Nothing a caller can pass avoids it.

### 2.3 The tab universe is fixed by the file system anyway

Even setting the remount aside, a `NativeTabs.Trigger` is not free-form. From
`standard-navigation/useVisibleTabsWithRedirect.ts` in the same package:

```ts
const visibleRoutes = useMemo(
  () => orderRoutesByRouteNames(routes, routeNames).filter((route) => {
    // Every filesystem route is registered in state; only routes declared by a
    // non-hidden trigger become tab items.
    const descriptor = descriptors[route.key];
    return isDeclaredInLayout(descriptor) && descriptor?.options?.hidden !== true;
  }),
  [routes, routeNames, descriptors]
);
```

`routes` comes from the **file tree**. A trigger's `name` selects one of them; it
cannot invent one. So the set of *possible* tabs is whatever route files exist in
that directory, and the layout only chooses a subset of them. A Pin pointing at a
module with no route file is not a tab, it is nothing.

For gather this is survivable — `MODULES` is a closed list of 13, so 13 route
files is a real option — but it means "tabs from data" would always have been
"tabs chosen from a fixed catalogue", never "tabs from data".

### 2.4 …and un-pinning ejects you from the page you are on

The same file:

```ts
useEffect(() => {
  // The focused route can be hidden or have no trigger at all…
  // Redirect to the router's initial tab, falling back to the first visible tab.
  if (isFocused && visibleFocusedTabIndex < 0 && redirectHref != null) {
    router.replace(redirectHref);
  }
}, [isFocused, redirectHref, visibleFocusedTabIndex]);
```

Un-pin Recipes while standing on Recipes and the router `replace`s you onto the
anchor tab. Not a crash — a deliberate, documented eject. But it means "unpin
from the page itself" is a hostile interaction, and this one applies to the JS
`Tabs` and the headless tabs too (they share `useVisibleTabsWithRedirect`).

### 2.5 The trap: it compiles, it renders, and it looks like it works

Triggers are gathered with `Children.toArray(children).filter(...)` (`utils/children.ts`).
`Children.toArray` flattens arrays and fragments — so this:

```tsx
<NativeTabs>
  <NativeTabs.Trigger name="index">…</NativeTabs.Trigger>
  {pins.map((id) => (
    <NativeTabs.Trigger key={id} name={id}>…</NativeTabs.Trigger>
  ))}
  <NativeTabs.Trigger name="all">…</NativeTabs.Trigger>
</NativeTabs>
```

**type-checks and renders a correct tab bar on first paint.** It fails later, on
the first Convex `myPins` update — which, because `useNavigation` reads pins from
a live `useQuery` (`src/components/app/useNavigation.ts`), can be *milliseconds
after mount*, before the user has done anything. The first pins render is
`undefined` → defaults → then the real list arrives → key changes → remount. A
prototype built this way would flash on every cold start and be blamed on
something else entirely.

### 2.6 Why the platforms want it this way

Not an Expo limitation being worked around — a platform convention Expo is
holding you to. Apple's HIG treats the tab bar as the app's stable top-level map;
Expo's docs cite it directly as the reason. Android's Material 3 navigation bar
is capped at 5 destinations for the same reason, which is where the hard
`NativeTabs` limit of 5 tabs on Android comes from.

Worth noticing: `DOCK_SLOTS = 5` in `src/lib/appNavigation.ts` already matches
Android's ceiling exactly. gather's dock arrived at the same number independently.

### 2.7 So what *is* idiomatic?

Ranked, most native first:

1. **A fixed tab set, with Pins expressed inside it.** The tab bar is the app's
   map — Home, All, and at most one or two more — and Pins become the *content*
   of Home: a row of shortcuts, a reorderable list, the first section of the
   screen. This is what iOS apps with per-user favourites actually do (Files,
   Music, Shortcuts). It keeps native chrome and honours "same concepts, native
   controls" — Home / Pins / All all survive as ideas, only their presentation
   moves. It is also the only option where the tab bar never flashes.
2. **A fixed tab set, chosen once per mount, deliberately frozen.** Read pins at
   mount, build tabs, and never rebuild until an event that already covers the
   screen (app cold start; a Group switch presented as a full-screen transition).
   The docs sanction exactly this — "change the visibility of the tabs only
   before the navigator is mounted **or when it is not visible to the user**".
   It gets you real per-person tabs at the cost of "your pin change appears next
   time", which is a strange thing to have to explain to a user. Viable, fragile,
   and it fights the reactive Convex client rather than using it.
3. **Headless tabs (`expo-router/ui`) — a direct port of `MobileDock`.** `TabSlot`
   keys each screen by `descriptor.route.key` (`ui/TabSlot.tsx`), and the JS
   `BottomTabView` does the same — **neither has a navigator-level key**, so a
   changing trigger list costs you the removed screen's state and nothing else.
   Fully dynamic, genuinely fine. The price is that the bar is now a `View` you
   drew: no Liquid Glass, no minimize-on-scroll, no system blur, and you own the
   bottom safe-area inset yourself (§6). On Android this is nearly invisible; on
   the iPhone that accepts this shell, it is the difference between an app and a
   website.
4. **JS `Tabs`.** Same dynamic freedom as (3) with a stock bar you configure
   rather than draw. Middle ground; still not native chrome.

**Recommendation for the prototype**: option 1, with option 3 as the fallback if
Pins-in-Home tests badly. Option 2 should be prototyped only if someone insists
on tabs-as-pins, and should be expected to lose. This is #145's and the
prototype's call, not this ticket's — but the fog is gone: *Pins cannot be native
tabs*, and every remaining shape is a decision about where Pins go instead.

---

## 3. How a Stack composes, and how a header is configured

### The composition

The standard shape, from the expo-router skill and
[common navigation patterns](https://docs.expo.dev/router/basics/common-navigation-patterns/):
**tabs at the top, a `Stack` inside each tab.** Each tab keeps its own history,
its own header, and its own back stack.

```
app/
  _layout.tsx            <NativeTabs />        — no header
  (home)/
    _layout.tsx          <Stack />             — header lives here
    index.tsx
  (all)/
    _layout.tsx          <Stack />
    index.tsx
```

Set `headerShown: false` on the tab layout; let each tab's `Stack` own its
header. A detail route can sit *inside* a tab's stack (back stays in the tab) or
in an outer stack *above* the tabs (back returns to the tab, and the detail
covers the tab bar) — the docs call the second "matching typical iOS behavior"
for things pushed from a list.

Array routes — `(home,all)/info.tsx` — let one file serve as a screen in several
tabs, with `unstable_settings` giving each its own anchor. The layout receives a
`segment` prop to tell which one it is rendering as. This is the tool for
"the same module screen reachable from two tabs" if that ever comes up.

### The header

Two APIs, both current in SDK 57:

```tsx
// options object — works everywhere, including from inside a screen
<Stack.Screen options={{ title: recipe.name, headerLargeTitle: true }} />

// composition components (SDK 55+)
<Stack.Title>Recipes</Stack.Title>
<Stack.Header style={{ backgroundColor: 'lightblue' }} />
<Stack.Toolbar placement="right">
  <Stack.Toolbar.Button icon="plus" onPress={…} />
</Stack.Toolbar>
```

Rendering `<Stack.Screen options={…} />` from inside the screen component is the
supported way to set a header from data the screen loaded — which is what gather
needs for "this recipe's title in the header".

### Mapping gather's Topbar onto this

The web `Topbar` carries: route title, Group name, jump-to search, Ask Gather,
report-issue, `LanguageToggle`, `HeaderUser`. On native it does not survive as
one component.

| Topbar element | Native home |
| --- | --- |
| Route title | `Stack.Title` / `options.title`, per screen. Consider `headerLargeTitle` on collection indexes — very iOS |
| Group name | **Has no header slot.** A native header shows *this screen's* title, not ambient context. See §4 |
| Search | `Stack.SearchBar` (deferred at charting — the power surfaces are out of v1) |
| Actions (Ask, report) | `Stack.Toolbar` — **iOS only** — or `options.headerRight` for cross-platform |
| `LanguageToggle`, `HeaderUser` | a Settings / Account screen, not the header. `@appelent/auth` is React DOM only and does not cross anyway |

Two constraints on `Stack.Toolbar` that will cost time if missed
([toolbar docs](https://docs.expo.dev/router/advanced/stack/), skill
`references/toolbar-and-headers.md`): it is **iOS only**, and every
`Stack.Toolbar.*` child must be a *direct* JSX child of `Stack.Toolbar` —
extracting the buttons into a `<Buttons />` component silently renders nothing.
Extract the whole toolbar or nothing.

### Breadcrumbs (ADR-0013) do not port

The native stack's back button **is** the trail, drawn by the platform, showing
the parent screen's title. ADR-0013's rules survive as *reasoning* — a nested
page belongs to its parent, back points at the parent's address — but
`<Breadcrumbs>` as a rendered component is a desktop-web idiom. Porting it would
put a second, redundant trail under a native one. Flag for the screen tickets.

---

## 4. What a URL means in Expo Router, and what that does to ADR-0002

### The mechanic

Expo Router is file-based: "All pages have a URL path that matches the file's
location in the `src/app` directory"
([core concepts](https://docs.expo.dev/router/basics/core-concepts/)). Dynamic
segments use `[brackets]`; `[...catchAll]` for the rest. `(parenthesised)` folders
group routes without appearing in the path.

On native, that path is **a deep-link target, not an address bar**. The docs are
explicit: "On native mobile apps, URLs function as deep links… (e.g.
`yourapp://home`)". With `scheme: "gather"` already in `app.json`,
`gather://g/jansen-household/recipes` is a working link the moment the route file
exists — no extra wiring, no `Linking` listener
([deep linking](https://docs.expo.dev/linking/into-your-app/): "With Expo Router:
Routing is automatic; skip manual URL handling"). Custom schemes need a
development build, not Expo Go; Expo Go uses `exp://…/--/path`.

Two facts about typed routes that shape call sites, since `typedRoutes` is on
([typed routes](https://docs.expo.dev/router/reference/typed-routes/)):

- Dynamic segments **must** use the object form:
  `href={{ pathname: '/g/[groupSlug]/recipes', params: { groupSlug } }}`.
  A bare `href="/g/[groupSlug]/recipes"` is a type error. This is very close to
  what `groupPaths.ts` already returns (`{ to, params }`), so a native
  `groupPaths` would be a near-mechanical port with `to` renamed `pathname`.
- **No relative paths.** Absolute only; use `useSegments()` if you need to build
  one. `groupPaths.ts` is already absolute-only, so nothing is lost.

### Is `/g/[groupSlug]/…` idiomatic natively?

**As a route tree: yes, it is perfectly ordinary.** A dynamic segment is a
first-class Expo Router concept and nothing about it is web-flavoured.

**As the *source of truth* for which Group you are in: that is the web habit.**
The two are separable, and #145 should treat them separately. Test ADR-0002's
three original reasons against a phone:

| ADR-0002's reason | On a phone |
| --- | --- |
| Two Groups open in two tabs | **Gone.** There are no tabs. One app, one foreground state |
| No link was addressable | **Survives, and gets better.** `gather://g/<slug>/recipes/<id>` is a real shareable link. This is the reason that carries |
| Every query re-derived the active Group instead of it being checked once at the boundary | **Survives**, but is satisfied by *any* single source of truth — a route param or a context — not specifically by the path |

So one reason evaporates, one strengthens, and one is indifferent. That is the
substance #145 has to weigh, and it is not the slam-dunk the web ADR is.

The counter-consideration is that a phone's Group is *ambient*: there is no
address bar showing it, so the slug-in-path buys none of the "noticeability"
ADR-0002 explicitly bought it for ("`/g/jansen-household/recipes/new` tells you
where an imported recipe will land"). On a phone, that safety has to be bought a
different way — a visible Group name in the header or on Home — regardless of
whether the slug is in the path.

### The three shapes #145 will be choosing between

**A — `[groupSlug]` above the tabs.**
`app/(app)/g/[groupSlug]/(tabs)/_layout.tsx`. Closest to the web; deep links land
naturally; `groupPaths.ts` ports almost verbatim. Switching Group means
navigating to a different slug on the same route node.
*Risk*: what a native navigator does when a dynamic segment *above* it changes
params is not something the docs state plainly. React Navigation reuses a screen
for the same route with different params unless `getId` distinguishes them
([stack docs](https://docs.expo.dev/router/advanced/stack/), "Custom Push
Behavior"), so a Group switch may either quietly reuse the tab navigator (leaving
stale per-group state in each tab's stack) or remount it. **[unverified — must be
prototyped]**. Note also that since the tab *set* cannot vary by Group anyway
(§2), nothing is gained by putting the tabs underneath the slug.

**B — Group as app state, tabs at the root.**
`app/(app)/(tabs)/…`, with the current Group in a context, persisted, and a
switcher screen. Deep links are still honoured via a thin
`app/g/[groupSlug]/[...rest].tsx` route that sets the Group and `replace`s onto
the equivalent tabbed route. Most native-feeling: the Group becomes what an
account or workspace is in most iOS apps — a thing you *are in*, not a thing you
*are at*. The cost is a second source of truth and a redirect layer to maintain,
and it drifts from the web app's model in a way that has to be documented.

**C — hybrid.** `[groupSlug]` in the path for content, mirrored into a store the
shell reads. Belt and braces; two things to keep in sync, which
`useNavigation.ts`'s own comment is a warning about ("Two lists that have to
agree eventually stop agreeing").

Not this ticket's decision. But the deep-link half is settled either way: **the
`gather://` scheme makes Group-scoped links work in every shape** — in A because
the path is the route, in B and C because a redirect route can consume it.

---

## 5. The back gesture and the back button

Two real, separate mechanisms, neither of which is the web's `history.back()`.

### iOS: the swipe-back gesture

Backed by `UINavigationController`, so it is the system gesture, not a
reimplementation. Defaults to on. From
[native-stack docs](https://reactnavigation.org/docs/native-stack-navigator/):

- `gestureEnabled` — defaults to `true`; **iOS only**. Setting `false` disables
  swipe-back for that screen.
- `fullScreenGestureEnabled` — swipe from anywhere rather than the left edge.
  Note the doc's caveat: "achieving the default iOS animation isn't possible due
  to platform limitations."
- `gestureDirection: 'vertical'` — for dismissing sheets; implies
  `fullScreenGestureEnabled` and `animation: 'slide_from_bottom'`.
- `headerBackButtonDisplayMode: 'minimal'` — chevron only, no parent title. The
  expo-router skill's example layout uses this by default.
- `headerBackButtonMenuEnabled` — long-press the back button for a jump-up-the-stack
  menu on iOS 14+. Defaults to `true`, free, and worth knowing exists.

**What a shell must opt into: nothing.** The default is correct. What a shell
must be careful *not* to do is break it — a horizontal swipe surface at the left
edge of a screen will fight the system gesture.

### Android: the system back

React Navigation handles hardware/gesture back by default: pop the current
screen, or **exit the app** if there is nothing to pop
([custom back handling](https://reactnavigation.org/docs/custom-android-back-button-handling/)).

Overriding it, when you must (an unsaved form, a dismissible overlay):
`useFocusEffect` + `BackHandler.addEventListener`, returning `true` to consume the
press and `false` to let the default happen. The docs warn explicitly against a
plain `useEffect` / `componentDidMount` for this — "This approach will not work",
because it does not track focus, so a background screen keeps eating back
presses.

**Tab-level back behaviour** is worth knowing: `NativeBottomTabsNavigator.tsx`
sets `const defaultBackBehavior = 'initialRoute'` with the comment "In Jetpack
Compose, the default back behavior is to go back to the initial route." So on
Android, pressing back from the third tab returns to the first tab rather than
exiting. Configurable via `NativeTabs`' `backBehavior` prop.

**Predictive back** (the Android 14+ preview-the-destination animation) is
*only* available via `ExperimentalStack`, gated on
`android.predictiveBackGestureEnabled` in the app config. Given
`ExperimentalStack`'s four-option surface and its inability to coexist with
`Stack` on Android, **this is out for v1.** Write it down as a known gap rather
than discovering it in the acceptance pass.

### The one that will actually bite: back after a deep link

Open `gather://g/jansen-household/recipes/abc123` from cold and the stack has
exactly one screen on it. Back exits the app. The fix is
[`unstable_settings`](https://docs.expo.dev/router/advanced/router-settings/):

```tsx
export const unstable_settings = { anchor: 'index' }  // v4+ name for initialRouteName
```

which synthesises the parent screen beneath the deep-linked one so back has
somewhere to go. **Every stack layout that a deep link can land inside needs
this**, and nothing warns you if it is missing — the app just quits.

### Good news for ADR-0013

ADR-0013 already says: "**Back points at the parent's address, never
`history.back()`.** Where somebody came *from* is not the collection the page
belongs to." That is not merely compatible with the native model — it *is* the
native model. A native stack pops to the screen structurally beneath, and
`unstable_settings.anchor` declares what that is. The web app was already written
against the phone's rule. Nothing to relearn.

Also available: `router.canGoBack()`, `router.dismiss()`, `router.dismissTo('/…')`,
`router.dismissAll()` — the last two matter for closing a multi-step sheet back
to a known place rather than popping an unknown number of times.

---

## 6. Safe areas and edge-to-edge

### The concept, since it has no web counterpart

CSS gives you `env(safe-area-inset-*)` and mostly a viewport that already
excludes the browser chrome. React Native gives you a window that is the **entire
physical screen** — under the notch, under the status bar, under the home
indicator, into the rounded corners. The insets are numbers you are handed; laying
out inside them is your job unless something did it for you.

### What is already done for you

- **`SafeAreaProvider` is already mounted.** Verified in
  `expo-router@57.0.12/build/ExpoRoot.js`: the router wraps children in
  `<SafeAreaProvider initialMetrics={INITIAL_METRICS}>`. So `useSafeAreaInsets()`
  works anywhere in the tree with no setup, and **`apps/mobile` must not add a
  second provider** — the Expo docs confirm: "Expo Router: Automatically handles
  safe areas; no additional setup required."
- **A native `Stack` header insets itself** under the status bar. Nothing to do.
- **`NativeTabs` insets itself** (SDK 55+, so 57 has it): on Android the tab
  content is wrapped in a `SafeAreaView` applying the bottom inset; on iOS the
  first `ScrollView` in a tab gets automatic `contentInsetAdjustmentBehavior`, so
  content scrolls *under* the translucent bar and stops clear of it. Opt out
  per-tab with `disableAutomaticContentInsets` if you want to place things
  yourself.

### What you must do yourself

- **Any screen with no header and no scroll view.** A plain `<View>` at the root
  of a screen starts at y=0, under the status bar.
- **Any bar you drew yourself.** This is the concrete cost of headless/JS tabs
  (§2.7 options 3 and 4): a hand-built dock is `position: absolute; bottom: 0`,
  which on a modern iPhone puts it under the home indicator and on Android under
  the gesture pill. `paddingBottom: insets.bottom` on the bar (rather than
  `SafeAreaView` around it) is the pattern that lets the bar's background bleed
  into the inset while its contents stay clear — which is what the system bars do
  and what makes a bar look native.
- **Anything absolutely positioned**: FABs, toasts, sticky footers.

`useSafeAreaInsets()` returns `{ top, right, bottom, left }` as numbers;
`<SafeAreaView edges={['bottom']}>` from `react-native-safe-area-context` applies
them as padding on chosen edges. Prefer the hook when the background should
extend into the inset, the component when it should not.

### Android edge-to-edge: `edgeToEdgeEnabled` is no longer a choice

`apps/mobile/app.json` sets `android.edgeToEdgeEnabled: true`. That is correct
and also, by now, largely moot:

> All apps targeting Android 16 and running on Android 16 no longer support the
> opt-out of edge-to-edge property… with Expo SDK 54 and React Native 0.81 now
> targeting Android 16, edge-to-edge will be enabled in all Android apps, **and
> cannot be disabled**.
> — [Edge-to-Edge display, now streamlined for Android](https://expo.dev/blog/edge-to-edge-display-now-streamlined-for-android)

SDK 57 / RN 0.86 is well past that line, and the changelog notes RN 0.86 brings
"fixes and improvements to edge-to-edge support on Android". Practical
consequence, from Expo's [system bars](https://docs.expo.dev/develop/user-interface/system-bars/)
page: "With edge-to-edge on Android, you will need to use safe areas to ensure
that content does not overlap with system bars." There is no toggle that saves
you. Insets are the only answer.

Related, and already resolved for us: expo-router removed its
`react-native-is-edge-to-edge` dependency along with the `AutoStatusBar`
component. Status bar styling is `expo-status-bar`'s `<StatusBar style="auto" />`
(the scaffold already depends on it); the Android nav bar is `expo-navigation-bar`.

### The `ScrollView`-must-be-first-child rule

Not a safe-area rule exactly, but it lives in the same family of "invisible
layout contracts", and it bites three separate features:

- `headerLargeTitle` only collapses on scroll if the `ScrollView`/`FlatList` is
  the screen's **direct first child**;
- the iOS 18-and-earlier tab bar only goes opaque at the scroll edge under the
  same condition;
- scroll-to-top on tab re-tap needs it too.

Escape hatch when you must wrap: `collapsable={false}` on the wrapper. And
`FlatList` specifically has limited support — the docs list "Limited FlatList
support — scroll-to-top and minimize-on-scroll unsupported".

---

## 7. Groups and layout routes: signed-in vs signed-out

`(parenthesised)` folders group routes without appearing in the path
([route structure](https://docs.expo.dev/router/basics/core-concepts/)), which is
exactly the tool for separating the welcome screen from the shell.

SDK 57's recommended pattern is `Stack.Protected`
([authentication](https://docs.expo.dev/router/advanced/authentication/)) —
declarative guards rather than redirect effects:

```tsx
// app/_layout.tsx
<Stack>
  <Stack.Protected guard={!!session}>
    <Stack.Screen name="(app)" />
  </Stack.Protected>
  <Stack.Protected guard={!session}>
    <Stack.Screen name="welcome" />
  </Stack.Protected>
</Stack>
```

"All routes are always defined and accessible… use runtime logic to redirect
users away." A user failing a guard is sent to the anchor route or the first
available screen; deep links into protected routes redirect to sign-in
automatically, which is the behaviour gather wants for `gather://g/…` links
arriving while signed out.

A skeleton consistent with everything above, and with the
`expo:expo-project-structure` skill (routes-only under `app/`, screen bodies in
`screens/`, kebab-case filenames):

```
apps/mobile/
  app/
    _layout.tsx              providers + <Stack> with Stack.Protected guards
    welcome.tsx              signed-out
    (app)/
      _layout.tsx            <NativeTabs>  — the shell
      (home)/
        _layout.tsx          <Stack>       — export unstable_settings { anchor: 'index' }
        index.tsx
      (all)/
        _layout.tsx          <Stack>
        index.tsx
        m/[moduleId].tsx     module placeholder
      settings.tsx
    +not-found.tsx
  components/
  screens/
  lib/
```

Three notes:

- **`app/` is routes only.** Both skills say so twice; every file there must
  default-export a component and becomes a route. `components/`, `screens/`,
  `lib/` are siblings. The scaffold's `tsconfig.json` should get a `@/*` alias.
- **Always keep a route matching `/`** so the app is never blank — it may live
  inside a group.
- **Guard on Clerk's signed-in state, not Convex's `isAuthenticated`.** This is
  the same trap recorded for the web app (`clerk-convex-dual-auth-redirect-loop`):
  the Clerk→Convex JWT handshake lags, and guarding on the Convex flag produces a
  flap between the welcome screen and the shell. `Stack.Protected` makes that
  flap a remount rather than a redirect loop, which is quieter but not better.

---

## 8. The viable shell shapes, with trade-offs

Everything above collapses into six candidates. "Pins" means gather's per-person,
per-Group module list (ADR-0005); "native" means real platform chrome.

| # | Shape | Pins live… | Native chrome | Dynamic Pins | Main cost |
| --- | --- | --- | --- | --- | --- |
| **A** | `NativeTabs` (Home · All) + `Stack` per tab | inside Home, as content | ✅ full | ✅ instantly | Pins lose their permanent on-screen presence |
| **B** | `NativeTabs` (Home · 1–2 fixed · All) | inside Home | ✅ full | ✅ | picking the fixed middle tabs is an editorial call, not a user's |
| **C** | `NativeTabs` built from Pins, frozen until remount | as tabs | ✅ full | ⚠️ next launch only | "your change appears later" is unexplainable; fights the reactive client |
| **D** | headless `expo-router/ui` + a ported `MobileDock` | as dock items | ❌ drawn | ✅ | you own the bar, the insets, the animations; least native on the iPhone that accepts this |
| **E** | JS `Tabs` | as tabs | ❌ imitation | ✅ | an imitation tab bar next to a real native stack reads as slightly wrong on iOS |
| **F** | `Stack` only, Home as hub | on Home | ✅ full | ✅ | no persistent bottom navigation; more taps to switch modules |

Notes on the ones that are not obvious:

- **A vs F** differ only in whether All gets a permanent slot. With no module
  built, Home and All render the same content today (the map flags this collision
  explicitly) — so A may be two tabs onto one view in v1, which argues for F now
  and A once modules land. The prototype should try both, since this is cheap.
- **B**'s "fixed middle tabs" could reasonably be `DEFAULT_PINS` minus one —
  `src/lib/pins.ts` already defines `['recipes', 'tasks', 'nutrition']` as what a
  person sees before choosing. That would give a native tab bar of Home · Recipes ·
  Tasks · Nutrition · All: exactly 5, exactly Android's ceiling, exactly
  `DOCK_SLOTS`. It is *not* per-person, which is the whole trade.
- **D** is the honest port of the web's dock, and would look almost identical to
  what exists. It is also the shape most likely to feel like a website on an
  iPhone, which is the one outcome the map's acceptance criterion ("runs on Eric's
  iPhone", accepted there) is designed to catch.

**Divergence in layout is fine; divergence in vocabulary is not** — the map's own
rule. Every shape above keeps Home, Pins, All and Group as words. Only A/B/F keep
native chrome as well.

---

## 9. Things this changes in the port of gather's nav model

Concrete, so the build tickets do not rediscover them:

- **`src/lib/appNavigation.ts` is portable in substance, not in types.**
  `NavDestination = Pick<LinkProps, 'to' | 'params' | 'search' | 'hash'>` is
  TanStack-shaped. Expo Router's equivalent is
  `{ pathname, params }`. `navItems`, `dockNavItems`, `activeNavItemId`,
  `navTargetOf`, `jumpTargets` and `getRouteContext` are otherwise pure functions
  over strings and would move unchanged — the file's no-React-imports discipline
  (ADR-0011) pays off exactly here.
- **`NAV_ACTIVE_OPTIONS` has no counterpart and is not needed.** It exists because
  TanStack's `Link` decides prefix-activeness for itself. Expo Router has no such
  behaviour, and a native tab bar reports its own selection. Drop it; keep
  `activeNavItemId`, which is the real answer and is already the single predicate
  both surfaces use.
- **`dockNavItems`' truncation to `DOCK_SLOTS = 5` survives**, and gains a second
  justification: Android's hard 5-tab ceiling. If the shape ends up native-tabbed,
  this function is what enforces the platform limit.
- **`src/lib/groupPaths.ts` needs a native twin, not a port.** It imports
  `LinkProps` from `@tanstack/react-router` and its `satisfies` clause type-checks
  against a TanStack-generated route tree. The *design* — one place where a Group
  URL is built, ids and paths derived rather than duplicated — is what should
  survive; the mechanism becomes `Href` from Expo's generated types.
- **`useNavigation.ts` ports nearly as-is** (`useLocation` → `usePathname`,
  `useShellGroup` → whatever #145 decides). The reactive `useQuery(api.users.myPins)`
  is the thing that makes §2.5 a live hazard rather than a theoretical one.

---

## 10. Open questions this reading could not settle

1. **What a Group switch does to a tab navigator sitting under `[groupSlug]`.**
   Whether changing a dynamic segment *above* a native tab navigator remounts it,
   reuses it with stale per-tab stacks, or something else. Docs describe `getId`
   for the stack case only. **Must be prototyped**; it is the crux of shape A in §4.
2. **Whether `NativeTabs` on Android hits the 5-tab limit loudly or quietly.**
   Docs state the limit; they do not say whether a 6th trigger throws, is dropped,
   or renders a "More" affordance. Cheap to find out on the emulator.
3. **Whether the SDK 57 `NativeTabs` alpha changes again before v1 lands.** The
   import is still `expo-router/unstable-native-tabs` and the docs still say "its
   API is subject to change". The `main` branch already differs from 57.0.12 in
   this file (the remount key changed from route keys to route names), which is a
   fair signal that it is still moving.
4. **Whether gather wants a `Stack.Toolbar` at all**, given it is iOS-only and the
   daily loop is an Android emulator. A `headerRight` works on both; a toolbar
   looks better on the device that accepts the work. Not a research question — a
   design one for the screen tickets.

---

## Sources

Primary, in the order they were relied on.

**Expo plugin skills** (the map names these the authority on Expo specifics):
- `expo:expo-router` — `SKILL.md`, `references/tabs.md`, `references/route-structure.md`, `references/toolbar-and-headers.md`
- `expo:expo-project-structure` — `SKILL.md`

**Expo documentation**
- [Native tabs](https://docs.expo.dev/router/advanced/native-tabs/) — limitations, dynamic tabs, hidden, roles, safe-area handling
- [Native tabs API reference](https://docs.expo.dev/versions/latest/sdk/router/native-tabs/) — SDK 57 prop surface
- [Tabs (JS)](https://docs.expo.dev/router/advanced/tabs/)
- [Custom tabs](https://docs.expo.dev/router/advanced/custom-tabs/) and [`expo-router/ui` API](https://docs.expo.dev/versions/latest/sdk/router/ui/)
- [Stack](https://docs.expo.dev/router/advanced/stack/)
- [ExperimentalStack](https://docs.expo.dev/versions/latest/sdk/router/experimental-stack/)
- [Drawer](https://docs.expo.dev/router/advanced/drawer/)
- [Core concepts](https://docs.expo.dev/router/basics/core-concepts/) · [Navigation](https://docs.expo.dev/router/basics/navigation/) · [Common navigation patterns](https://docs.expo.dev/router/basics/common-navigation-patterns/)
- [Router settings (`unstable_settings` / anchor)](https://docs.expo.dev/router/advanced/router-settings/)
- [Authentication](https://docs.expo.dev/router/advanced/authentication/)
- [Typed routes](https://docs.expo.dev/router/reference/typed-routes/)
- [Linking into your app](https://docs.expo.dev/linking/into-your-app/)
- [Safe areas](https://docs.expo.dev/develop/user-interface/safe-areas/) · [System bars](https://docs.expo.dev/develop/user-interface/system-bars/)
- [`react-native-safe-area-context`](https://docs.expo.dev/versions/latest/sdk/safe-area-context/)
- [Expo SDK 57 changelog](https://expo.dev/changelog/sdk-57)
- [Edge-to-Edge display, now streamlined for Android](https://expo.dev/blog/edge-to-edge-display-now-streamlined-for-android)

**React Navigation documentation**
- [Native Stack Navigator](https://reactnavigation.org/docs/native-stack-navigator/) — gestures, back button options
- [Custom Android back button handling](https://reactnavigation.org/docs/custom-android-back-button-handling/)

**Source code** — `expo/expo`, `packages/expo-router/src/`, plus the published
`expo-router@57.0.12` build for the claims that decide §2:
- `native-tabs/NativeBottomTabsNavigator.tsx` — the navigator `key`, `defaultBackBehavior`, the nesting error
- `standard-navigation/useVisibleTabsWithRedirect.ts` — layout-declared visibility, the focused-tab redirect
- `utils/children.ts` — `Children.toArray` trigger collection
- `layouts/TabsClient.tsx`, `react-navigation/bottom-tabs/navigators/createBottomTabNavigator.tsx`, `ui/Tabs.tsx`, `ui/TabSlot.tsx` — per-screen keying, i.e. no navigator-level remount
- `build/native-tabs/NativeBottomTabsNavigator.js` (57.0.12) — `key: visibleTabsKeys`
- `build/ExpoRoot.js` (57.0.12) — the automatic `SafeAreaProvider`

**gather** — `src/lib/appNavigation.ts`, `src/lib/groupPaths.ts`,
`src/lib/pins.ts`, `src/lib/modules.ts`, `src/components/app/useNavigation.ts`,
`src/components/app/MobileDock.tsx`, `apps/mobile/{app.json,package.json}`,
ADR-0002, ADR-0005, ADR-0011, ADR-0013.
