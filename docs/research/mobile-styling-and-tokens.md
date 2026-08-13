# Styling and design tokens for the gather mobile shell (Expo SDK 57)

Research for [#141](https://github.com/AppElent/gather/issues/141), part of the
Wayfinder map [#134](https://github.com/AppElent/gather/issues/134). **This is a
survey, not a decision** — the decision is
[#144](https://github.com/AppElent/gather/issues/144). Where this document
recommends, it recommends with its reasoning exposed so the decision ticket can
disagree with the reasoning rather than the conclusion.

First entry in `docs/research/`; the directory did not exist. It sits beside
`docs/adr/` and `docs/migrations/` because it is the same kind of artefact — a
durable note the repo keeps — but it is explicitly *not* an ADR, because nothing
here is decided.

Verified against primary sources on 2026-08-12. Package versions were read from
the npm registry on that date, not recalled.

---

## 0. The two things that make this question specific to gather

Everything below is downstream of two local facts. They are worth stating first,
because a generic "how do I style React Native" answer gets this wrong.

### gather's palette is two palettes, and only one of them is token-shaped

`src/styles.css` has three distinct regions, and they cross to native very
differently:

| Region | Lines | What it is | Crosses? |
| --- | --- | --- | --- |
| `:root` custom properties | 17–104 | ~48 flat name→colour declarations, in three sets: the `--app-*` shell tokens (oklch), the sea/lagoon brand colours (hex + rgba), and a dark override block | **Yes** — this is a design-token file in all but name |
| `--auth-*` bridge | 111–122 | Aliases pointing `@appelent/auth`'s tokens at gather's | **No** — `@appelent/auth` is React DOM only ([#134](https://github.com/AppElent/gather/issues/134)); the package it bridges does not exist on the phone |
| `@layer base` / `@layer components` | 139–687 | ~50 rules: `.shell-card`, `.demo-panel`, `.island-shell`, `.nav-link`, etc. | **Mostly no** — see below |

The third region is where the visual identity actually lives, and it is built out
of web-only primitives. `backdrop-filter: blur(4px)`, three stacked
`radial-gradient()` backgrounds on `body`, `mask-image`, `::before`/`::after`
pseudo-elements, multi-layer inset `box-shadow`, `:hover` transforms, and
`color-mix(in oklab, …)` inside gradient stops. React Native has no
pseudo-elements and no backdrop-filter (`expo-blur` and `expo-glass-effect` are
the native equivalents, and they are components, not style properties). The
`.island-shell` / `.demo-panel` frosted-glass look is not portable as CSS; it is
portable only as an *intent* that gets rebuilt natively.

So the honest unit of sharing is **the `:root` block, not the stylesheet**. About
90 lines of the 699 are genuinely cross-platform. That is still worth having —
it is the part that defines what gather *looks* like — but nobody should plan on
sharing `styles.css`.

One more wrinkle: gather's manual theme override is `:root[data-theme="dark"]`
(line 50) — an **attribute selector on the root element**. The
`prefers-color-scheme` block (line 82) is the system-following path. Native has
the system path (see §2) but not the attribute-selector path; a manual override
has to be re-expressed as an imperative call. That is a mechanism change, not a
capability loss.

### The scaffold is currently the naive shape, and it is the baseline to beat

`apps/mobile/app/index.tsx` is 45 lines and does exactly what a scaffold does:

```tsx
const isDark = useColorScheme() === "dark";
// …
style={isDark ? styles.screenDark : styles.screenLight}
// …
screenLight: { backgroundColor: "#f7f7f8" },
screenDark:  { backgroundColor: "#101114" },
```

Two hardcoded hex values per themed property, a boolean at every call site, and
no shared vocabulary at all. **This is not "the StyleSheet option" — it is the
absence of one.** Every option in §1, including StyleSheet, replaces this. It is
worth naming because "keep StyleSheet" reads as "keep this", and it should not.

---

## 1. The options

Four real candidates for SDK 57. Verified stability and native-code status for
each, because those two facts decide more than ergonomics do.

### Why "does it need native code" is the load-bearing column

Per [#134](https://github.com/AppElent/gather/issues/134): Eric develops on
Windows, so **no iOS binary can be built locally, ever**. The chosen iOS path is
`eas go` — your own Expo Go build, delivered through your own TestFlight. The
daily loop is Android Expo Go on an emulator.

A library with native code cannot run in Expo Go — stock or `eas go`-built —
unless it is in the SDK. Adopting one means every device install becomes an EAS
build, on a machine that cannot produce the iOS half locally. Expo's own
`expo-native-ui` skill puts this first: *"CRITICAL: Always try Expo Go first
before creating custom builds."*

This is not a tiebreaker. For this project it is close to a gate.

### Option A — plain `StyleSheet` + a theme context

Core React Native. No dependency, no build step, no native code.

The `:root` block becomes a TypeScript object — `{ light: {...}, dark: {...} }` —
handed down by a React context, or read through `useColorScheme()`. This is the
"hand-rolled context of plain objects" the ticket asks about, and it is worth
saying plainly: **hand-rolled is not a slur here.** gather's tokens are flat
name→colour pairs with no computation. A `Record<TokenName, string>` per theme
expresses them completely and is type-safe by construction, in a way the CSS
never was.

It also composes with Expo's semantic-colour story. `expo-native-ui` recommends
`Color` from `expo-router` (a type-safe `PlatformColor` wrapper: `Color.ios.label`,
`Color.android.material.*`, `Color.android.dynamic.*`), which resolves on-device
and adapts to light/dark and accessibility settings automatically. Per Expo's
docs, iOS re-resolves on theme change by itself; **on Android you must call
`useColorScheme()` in the rendering component or it will not re-render** — a real
footgun, documented, and worse under React Compiler memoization.

So a token table can be *mixed*: gather's brand colours as literals, chrome
colours as `Color.*` so they match the OS. That is available under every option,
but it is most natural here.

- **Native code:** no. **EAS build to adopt:** no.
- **Stability:** it is React Native.
- **Theming:** whatever you build. Nothing given, nothing in the way.
- **Cost:** every component names tokens by hand; no utility shorthand; layout is
  written out longhand.

### Option B — NativeWind v5 / `react-native-css`

The Tailwind-flavoured option, and the subject of §3. Two packages: `react-native-css`
is the CSS runtime, NativeWind v5 is the thin Tailwind layer on top
(`nativewind@5.0.0-preview.4` declares exactly one dependency and
`peerDependencies: { react-native-css: "^3.0.1" }`).

**Stability — read this carefully, because the Expo skill and npm disagree.**

| Package | npm `latest` | npm `preview` | What the Expo skill pins |
| --- | --- | --- | --- |
| `nativewind` | `4.2.6` | `5.0.0-preview.4` | `5.0.0-preview.2` |
| `react-native-css` | `3.0.7` | — (`nightly` tag exists) | `0.0.0-nightly.5ce6396` |

Two things follow. First, `react-native-css` has **graduated to a stable 3.x**;
the skill's pinned nightly is stale, and `nativewind@preview` now peers against
the stable line. Second, and decisively: **NativeWind v5 itself is still
pre-release.** Its own installation page says, verbatim:

> "This is a pre-release version of Nativewind. It is not intended for production
> use."

NativeWind's *stable* release is v4.2.6, which peers `tailwindcss: ">3.3.0"` —
i.e. Tailwind **v3**, config-file based. gather's web is Tailwind **v4**,
CSS-first (`@import "tailwindcss"`, `@theme`). Choosing stable NativeWind means
choosing a different Tailwind major from the web app, which defeats most of the
reason to want Tailwind here at all. **The shared-vocabulary argument only
applies to the version that is not production-ready.**

- **Native code:** **no.** `react-native-css@3.0.7`'s dependencies are `debug`,
  `colorjs.io`, `comment-json`, `babel-plugin-react-compiler`; its peers are
  `react`, `react-native`, `lightningcss`, `@expo/metro-config`. That is a Metro
  transform plus a JS runtime — no native module, so it runs in Expo Go. **EAS
  build to adopt: no.** (The `colorjs.io` dependency is also *why* oklch and
  `color-mix()` work on native — the colour maths is done in JS.)
- **Setup cost:** `metro.config.js` (`withNativewind`), `postcss.config.mjs`, a
  `global.css`, a pinned `lightningcss@1.30.1` resolution to avoid deserialization
  errors, **and** a hand-written `src/tw/` module wrapping every RN primitive in
  `useCssElement` — because the skill's config sets
  `globalClassNamePolyfill: false`. That last one is ~100 lines of boilerplate
  you own, per the skill's own template.
- **Theming:** the best of the four on paper. `var()` is polyfilled, `@theme`
  registers tokens as utilities, `dark:` is driven by RN's `Appearance` API, and a
  manual override is `Appearance.setColorScheme()`.

### Option C — Unistyles 3

`react-native-unistyles@3.3.0` — **genuinely stable**, and the only option here
whose latest tag is not a pre-release. Its theming model is the most
token-shaped of the four by design: themes are plain JS objects registered once
via `StyleSheet.configure({ themes, breakpoints, settings })`, with
`adaptiveThemes: true` for system-following (mutually exclusive with
`initialTheme` — setting both is an error).

But:

- **Native code: yes.** `peerDependencies` include `react-native-nitro-modules`.
  Unistyles' own FAQ says, verbatim: *"No, Unistyles includes custom native code,
  which means it does not support Expo Go."* **EAS build to adopt: yes** — and
  given the Windows constraint, that means the iOS half of every install goes
  through EAS from day one.
- **New Architecture:** required, which is fine — SDK 57 is New-Arch-only anyway.
  The FAQ: *"Unistyles is tightly integrated with `Fabric`. There are no plans to
  support `Old Architecture`."*
- **Vocabulary sharing with the web:** none. It is a styling engine, not a CSS
  one.

The irony is worth naming: the option with the best token story is the one whose
adoption cost is highest *for this specific machine*.

### Option D — `@expo/ui` native components

`@expo/ui@57.0.10` ships alongside SDK 57 (npm `latest` = `57.0.10`, matching the
SDK). Real SwiftUI on iOS, real Jetpack Compose on Android, from one React tree.
The **universal** layer (`Host`, `Column`, `Row`, `Text`, `Button`, `Switch`,
`List`, `BottomSheet`, `Picker`, `Slider`, `FieldGroup`…) requires SDK 56+, so
SDK 57 qualifies.

This is not really a *styling* option — it is the answer to §5, and it composes
with A, B, or C rather than competing with them. You would use `@expo/ui` for the
controls and one of A/B/C for everything around them.

- **Native code:** the module ships with the SDK. On SDK 56+ Expo's skill says
  `@expo/ui` works in Expo Go with no custom build. **EAS build to adopt: no**
  (on SDK 57).
- **Theming:** the point is that you *do not* theme it. It renders as the OS
  wants. That is a feature for chrome and a problem for brand — you do not get
  sea/lagoon out of a SwiftUI `List`.
- **Caveats:** every tree must be wrapped in `Host`; `List` is explicitly *"not
  suitable for large lists"*; the platform-specific sub-packages
  (`@expo/ui/swift-ui`, `@expo/ui/jetpack-compose`) crash at runtime if imported
  on the wrong platform, and Expo Router does not support platform extensions for
  route files — so any platform split lives in `components/`, never in `app/`.

### The options table

| | **A. StyleSheet + context** | **B. NativeWind v5** | **C. Unistyles 3** | **D. `@expo/ui`** |
| --- | --- | --- | --- | --- |
| **Native code / EAS build to adopt** | **No** | **No** (Metro + JS only) | **Yes** — Nitro Modules, no Expo Go | **No** on SDK 57 (ships with SDK) |
| **Stability on SDK 57** | Core RN | **Pre-release.** Docs: *"not intended for production use"* | **Stable** (3.3.0) | Stable, versioned with the SDK |
| **New Architecture** | Fine | Fine | Required (fine — SDK 57 is New-Arch-only) | Built for it |
| **Token model** | Hand-rolled TS object + context. Type-safe by construction | `@theme` + polyfilled `var()`. Closest to the web's model | Best-in-class: JS theme objects, `adaptiveThemes` | None — inherits the OS palette |
| **Light/dark** | `useColorScheme()`, or `Color.*` from `expo-router` (auto-adapts) | `dark:` via `Appearance`; override via `Appearance.setColorScheme()` | `adaptiveThemes: true`, or `setTheme()` | Automatic, not yours to control |
| **Class names shared with web** | n/a | **Partly — see §3. Tokens cross; layout and `aria-*` do not** | No | No |
| **Setup burden** | ~0 | Metro + PostCSS + `global.css` + pinned `lightningcss` + hand-written `src/tw/` wrappers | Config + a dev build | `Host` wrapper per tree |
| **Native feel** | Whatever you build | Whatever you build | Whatever you build | **Actually native** |
| **Biggest risk** | Verbosity; nothing stops drift | Pre-release churn on the critical path of a first mobile app | The one thing #134's runtime constraint most wants to avoid | Brand identity is not expressible |

### A note on the Expo skills disagreeing with each other

Worth recording, because a future session will hit it. `expo-tailwind-setup` is a
complete guide to putting Tailwind in an Expo app. `expo-native-ui` says, in its
General Styling Rules:

> "CSS and Tailwind are not supported - use inline styles"

Both are current, both are first-party. They are not reconcilable as written;
they are written for different goals. `expo-native-ui` optimises for Apple HIG
fidelity and assumes you want the OS's look. `expo-tailwind-setup` optimises for
universal styling across web and native and assumes you want *your* look. gather
wants some of both, which is why this is a decision and not a lookup.

---

## 2. How each expresses light/dark, and whether anything is token-shaped

Short answer to the ticket's question: **yes, two of them are genuinely
token-shaped, and the hand-rolled version is not the fallback it sounds like.**

- **A** — a `Record<TokenName, string>` per theme, in a context. gather's tokens
  are 48 flat name→colour pairs with no computation, so a plain object expresses
  them *completely*. It is also the only option where a missing token is a
  **compile error** — which is exactly the discipline ADR-0011 already applies to
  message trees (`satisfies Record<…>` makes forgetting a type error). The same
  trick works here, and it is stricter than CSS ever was: `var(--app-typo)`
  silently resolves to nothing; `tokens.appTypo` does not compile.
- **B** — the closest thing to the web's actual mechanism. `var()` is polyfilled
  by `react-native-css`; tokens declared in `@theme` become utilities; `dark:`
  compiles to `@media (prefers-color-scheme: dark)` and is reactive on native.
  Manual override is `Appearance.setColorScheme()` rather than a `data-theme`
  attribute — different mechanism, same user-visible effect. NativeWind's docs
  add a warning worth carrying over: *"Always provide both light and dark mode
  styles. React Native can have issues with conditionally applied styles."*
- **C** — the most deliberate design of the four. Themes are registered once,
  globally, and `adaptiveThemes` handles the system flip without a re-render
  dance.
- **D** — not applicable, and that is the point.

**Orthogonal to all four:** `Color` from `expo-router` gives semantic OS colours
(`Color.ios.label`, `Color.android.dynamic.surface`) that adapt to light/dark and
accessibility settings on-device. Any option can mix these in for chrome while
keeping gather's brand colours as literals. Two caveats from Expo's docs: call
`useColorScheme()` in the component on Android or it will not re-render on theme
change, and never pass `Color`/`PlatformColor` values into Reanimated styles.

---

## 3. The honest cost of the Tailwind-flavoured option

**This is the question the ticket most wanted answered honestly, so here is the
unhedged version: the class names partly carry across. The tokens survive. The
layout does not. The interaction-state variants do not.**

That is a more interesting answer than either "yes" or "no", and the split falls
in a place that matters.

### What react-native-css genuinely supports (this surprised me)

I expected `bg-[color-mix(in_oklch,var(--app-bg)_86%,transparent)]` to be dead on
arrival. It is not. NativeWind v5's Functions & Directives page states that
`var()`, `calc()`, `env()` and **`color-mix()`** are *"polyfilled on native by
react-native-css"*, and the Colors page shows `oklch()` used directly in a
`@theme` block. The `colorjs.io` dependency in `react-native-css@3.0.7` is the
implementation.

So gather's actual colour vocabulary — oklch tokens, `var()` references,
`color-mix()` blends — **crosses**. `env(safe-area-inset-*)` even gains meaning
it never had on the web. That is a real result and I would have got it wrong from
memory.

### What does not cross

Two categories, and both are load-bearing in gather's shell.

**Layout.** NativeWind's own docs: *"`grid` will work on web but not on native
(where React Native only supports flexbox layout)."* And `position: fixed` is not
a React Native position value (RN has `static`/`relative`/`absolute`).

**Attribute-state variants.** The states page documents `hover:`, `focus:`,
`active:`, `disabled:`, `empty:`, `selection:`, `placeholder:`, `ltr:`/`rtl:`,
`group-*` — and **`data-*` selectors**. It does **not** document `aria-*`
variants. `data-[…]` survives; `aria-[…]` does not.

### The actual test: `MobileDock.tsx`

This is the fairest possible case study, because `MobileDock` is *literally the
component the phone is replacing* — the web's own bottom bar. Its two class
strings, utility by utility:

Container — `fixed inset-x-2 bottom-2 z-30 grid gap-1 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-1 md:hidden`

| Survives | Does not |
| --- | --- |
| `inset-x-2` `bottom-2` `z-30` `gap-1` `p-1` `border` | `fixed` — not an RN position value |
| `rounded-[var(--app-radius)]` — `var()` polyfilled | `grid` — RN is flexbox-only |
| `border-[var(--app-border)]` — oklch via `colorjs.io` | `md:hidden` — compiles, but is meaningless: on a phone the dock is unconditional |
| `bg-[var(--app-surface)]` | |

Item — `grid min-h-11 place-items-center rounded-[7px] text-xs text-[var(--app-muted)] no-underline aria-[current=page]:bg-[var(--app-surface-muted)] aria-[current=page]:text-[var(--app-fg)]`

| Survives | Does not |
| --- | --- |
| `min-h-11` `rounded-[7px]` `text-xs` `no-underline` | `grid`, `place-items-center` — grid-only |
| `text-[var(--app-muted)]` | **both `aria-[current=page]:` variants** |

Roughly **five of nineteen utilities fail**, and they are not a random five. The
survivors are the *colours*. The casualties are the *structure* and the *active
state* — which is to say, everything that makes `MobileDock` a navigation bar
rather than a coloured rectangle. The `aria-current` mechanism in particular is
not incidental: the component carries a comment explaining that this bar
*colours itself from `aria-current`* and that `NAV_ACTIVE_OPTIONS` exists to stop
the router setting it by prefix. That whole mechanism is web-specific and gets
rebuilt regardless.

### What this means for the "one codebase, two clients" hope

A paste of a web `className` will not work. It will *partially* work, which is
worse — it will render, look nearly right, and be silently missing its layout and
its active state. There is no compile error and no lint rule; `grid` is a valid
Tailwind class that NativeWind accepts and ignores. NativeWind's design principle
is *"it accepts all classes but only applies styles that are supported on the
current platform"* — excellent behaviour for a universal app, and a silent-failure
mode for a copied class string.

So the fair statement is: **NativeWind would let gather share its *tokens* and its
*colour vocabulary* across clients. It would not let gather share its
*components*, or even reliably its *class strings*.** And sharing tokens is
achievable under Option A too, by exporting the same values as a TypeScript
object — with the added benefit that a typo becomes a compile error.

The vocabulary-sharing argument for NativeWind is real but much narrower than it
first appears, and it is only available on a pre-release package.

---

## 4. Icons

The web's `src/components/app/Icon.tsx` does a runtime lookup —
`(Icons as Record<string, LucideIcon>)[name] ?? Icons.Square` — against
`lucide-react`, and `src/lib/modules.ts` stores each Module's icon as a bare
string typed `// lucide-react icon name`: `ChefHat`, `Apple`, `CalendarHeart`,
`ShoppingCart`, `Refrigerator`, `Wallet`, `Receipt`, `ListChecks`, `Baby`,
`Calendar`, `NotebookPen`, `Grape`, `Wine`. `appNavigation.ts` adds `Home` and
`Grid2X2`. **13 module icons plus 2 navigation icons, all as strings in a file
[#134](https://github.com/AppElent/gather/issues/134) has already committed to
getting onto the phone.**

That reframes the icon question. It is not "what icons should the app use" — it
is "what happens to these fifteen strings".

Three answers, and they differ more than expected.

### `lucide-react-native` — the strings cross unchanged

`lucide-react-native@1.31.0` exists, is the official Lucide package for React
Native, and peers `react-native-svg` (`^12–^15`). `react-native-svg@15.15.5` is
an Expo SDK package — Expo's docs list it as *"Android, iOS, macOS, tvOS, Web,
Included in Expo Go"* — so this is `npx expo install react-native-svg`, **no
native code, no EAS build**.

The consequence is concrete: `Icon.tsx`'s dynamic-lookup shape works verbatim
against `lucide-react-native`, the fifteen strings need no mapping table, and the
glyphs are *identical* to the web's. Same icon, same name, both platforms, one
identifier. Nothing in `src/lib/modules.ts` changes.

Cost: it is not a native idiom. Lucide is a web icon set, and Expo's guidance
(§5) is that native-feeling apps use the platform's own symbols.

### `expo-symbols` — better than its reputation, worse than it looks here

I expected to write "SF Symbols are iOS-only, so this is a non-starter for an
Android-first loop." **That is wrong as of SDK 57**, and it is the second thing
the primary docs corrected. Expo's docs give `expo-symbols` as *"Android, iOS,
tvOS, Web, Included in Expo Go"*, and: *"On iOS and tvOS, it uses SF Symbols. On
Android and web, it uses Material Symbols."* **Android support was added in SDK
57** — the exact SDK [#134](https://github.com/AppElent/gather/issues/134)
targets. It is marked **Beta, subject to breaking changes**.

But cross-platform comes with a string attached that matters a lot here. The
`name` prop takes a bare string **on iOS only**; cross-platform requires the
object form:

```jsx
<SymbolView name={{ ios: 'info.circle', android: 'info', web: 'info' }} />
```

SF Symbol names and Material Symbol names are different vocabularies
(`square.and.arrow.up` vs `share`). So **each of gather's fifteen icons needs two
names, hand-mapped, with no automatic correspondence** — `ChefHat` has no obvious
SF Symbol *or* Material Symbol equivalent, and picking them is a design judgement
made thirteen times.

This answers the ticket's sub-question directly and in the affirmative: **yes,
the platform difference matters, and it matters precisely because the shell is
prototyped on Android and accepted on iOS.** Under `expo-symbols` the daily loop
shows Material glyphs and the acceptance pass shows SF glyphs — *different
pictures for the same concept*. Every icon judgement made on the emulator is
provisional until the iPhone build. That is a genuine hazard for a workflow
that iterates on one platform and accepts on the other, and it is invisible until
the acceptance pass.

### `@expo/vector-icons` — already a dependency, and already deprecated

`apps/mobile` depends on `@expo/vector-icons@^15.0.3`. Expo's own icons guide now
says:

> "`@expo/vector-icons` will be deprecated and is not recommended. [Learn more
> about migrating to `@react-native-vector-icons`]"

So one of the two icon packages already in `apps/mobile`'s `package.json` is on
its way out, and the other (`expo-symbols`) is Beta. Neither is a settled
default. Notably, `@react-native-vector-icons/lucide@13.1.2` exists — a
font-based Lucide — which is a third path to the same names, though a font-based
set does not do Lucide's stroke-width props.

**Also worth flagging as a design smell for a separate ticket:** the Expo skill's
own `expo-native-ui/references/icons.md` says to use `SymbolView` from
`expo-symbols`, while its parent `SKILL.md` Library Preferences says *"`expo-image`
with `source="sf:name"` for SF Symbols, **not** `expo-symbols` or
`@expo/vector-icons`"*. The skill contradicts itself in two files. I have followed
the primary Expo docs over both.

---

## 5. What "native-feeling" costs

The map wants native controls. The answer is: **`@expo/ui` genuinely gets you
there, and it is free on SDK 57 — but it buys chrome, not identity.**

`@expo/ui` renders real SwiftUI and real Jetpack Compose. A `Switch` is the OS's
switch, with the OS's animation and haptics. For a settings screen — theme
toggle, language picker — which is exactly what
[#134](https://github.com/AppElent/gather/issues/134) has in scope, its
`List`/`ListItem`/`FieldGroup`/`Picker`/`Switch` set is close to purpose-built.
No EAS build on SDK 57.

The catch is the one the options table names: **you do not get to theme it.** A
SwiftUI `List` looks like a SwiftUI `List`. Sea and lagoon do not appear in it.
So the shape of the answer is a split, not a choice:

- **Chrome** — navigation, headers, tab bars, settings rows, pickers, sheets —
  wants `@expo/ui`, `expo-router`'s native `Stack`/`NativeTabs`, and semantic
  `Color`. Here, "native-feeling" is nearly free, and hand-styling it is both
  more work *and* a worse result.
- **Identity** — the Home screen, module placeholder cards, the surfaces where
  gather looks like gather — is hand-built primitives under whichever of A/B/C
  wins. No library gives you this; `.island-shell`'s frosted-glass look is
  `expo-blur`/`expo-glass-effect` plus deliberate work.

This lines up with what
[#134](https://github.com/AppElent/gather/issues/134) already settled — *"Same
concepts, native controls. Divergence in layout is fine; divergence in vocabulary
is not."* The vocabulary that must not diverge is the **domain** vocabulary
(Group, Home, Pins, All), not the CSS one. Nothing in §3 threatens that.

Two costs to name honestly, both from Expo's own guidance:

- **The safe-area / ScrollView discipline is not optional.** `expo-native-ui` is
  emphatic: wrap the root in a ScrollView, use
  `contentInsetAdjustmentBehavior="automatic"` rather than `SafeAreaView`, pad via
  `contentContainerStyle`, use a Stack title rather than a page `<Text>` heading.
  These are cheap if done from the first screen and expensive to retrofit.
- **`@expo/ui`'s `TextInput` is not RN's `TextInput`.** Its `value` takes an
  `ObservableState` from `useNativeState`, and `onChangeText` runs as a worklet on
  the UI thread. Different mental model; needs `react-native-worklets` (already a
  dependency of `apps/mobile`).

---

## 6. Recommendation

Offered as input to [#144](https://github.com/AppElent/gather/issues/144), with
the reasoning exposed so it can be argued with.

**Recommended: Option A (StyleSheet + a typed token module) for identity,
`@expo/ui` + `expo-router` native primitives for chrome, and
`lucide-react-native` for icons.**

The reasoning, in the order the facts actually decide it:

1. **Unistyles (C) is out on the runtime constraint, not on merit.** It has the
   best theming design of the four and it is the only stable one. It also needs
   Nitro Modules, which means no Expo Go, which means the iOS half of every
   install goes through EAS from a Windows machine that cannot build iOS locally.
   For a first mobile app whose whole delivery path is Expo-Go-shaped, that is the
   wrong thing to spend the first hard problem on. **If the delivery path ever
   changes — a Mac, or EAS builds becoming routine — C should be reconsidered
   first.** It is the best library here; it is the wrong library for this machine.

2. **NativeWind (B) is out on stability, and its main benefit is smaller than it
   looks.** Its own docs say it is not for production use. Adopting a pre-release
   styling engine as the foundation of a first React Native app means every
   layout confusion has two possible causes. And per §3, what it actually buys is
   shared *tokens* and *colour vocabulary* — not components, not reliably even
   class strings. Option A gets the same token sharing from a TypeScript object,
   with typos becoming compile errors rather than silently-dropped classes.
   **The revisit trigger is explicit: when `nativewind@5` reaches a stable
   `latest` tag.** Everything else about it is good; only its version number is
   the problem.

3. **A's verbosity is real and is the price.** No `className`, no shorthand,
   layout longhand. Mitigated by the shell being small (a dozen screens with no
   module behind them) and by RN's flexbox being a genuinely smaller surface than
   CSS. It is a real cost, honestly stated.

4. **A fits how gather already thinks.** ADR-0011 established that display
   strings are typed dictionaries where `satisfies Record<…>` makes forgetting a
   compile error. A token module is *the same pattern applied to colour* — and
   `src/lib/` is already deliberately React-free and portable. A `tokens.ts`
   beside the message trees is the shape this repo already reaches for. That is
   consistency, not novelty.

5. **Icons: `lucide-react-native`, not `expo-symbols`, despite `expo-symbols`
   being the more native answer.** Three reasons. The fifteen strings in
   `modules.ts`/`appNavigation.ts` cross with **zero** mapping work and produce
   glyphs identical to the web's. `expo-symbols`' Android support is SDK-57-new
   and marked Beta — new surface area on the exact SDK being adopted for the
   first time. And most importantly, `expo-symbols` would make the Android
   prototype and the iOS acceptance build show *different pictures for the same
   concept*, which is a bad property for a workflow that iterates on one platform
   and accepts on the other.
   `apps/mobile`'s deprecated `@expo/vector-icons` should be dropped in the same
   change. `expo-symbols` remains the right answer later, when there is a Mac or
   a routine iOS loop and the two symbol sets can be judged side by side.

**What this recommendation does not settle**, and should not be read as settling:
whether `tokens.ts` lives in `apps/mobile/` or in a shared package. That is the
sharing decision [#134](https://github.com/AppElent/gather/issues/134) already
flags as load-bearing, it has its own ticket, and it is genuinely independent of
which styling engine wins — every option here needs the tokens *somewhere*.

---

## Sources

All fetched or queried 2026-08-12.

**Expo plugin skills** (`claude-plugins-official/expo@1.8.7`, the version
installed in this session):
`skills/expo-tailwind-setup/SKILL.md` ·
`skills/expo-native-ui/SKILL.md` and `references/icons.md` ·
`skills/expo-ui/SKILL.md` and `references/universal.md`, `references/jetpack-compose.md`

**Expo primary docs:**
[SDK 57 changelog](https://expo.dev/changelog/sdk-57) ·
[expo-symbols](https://docs.expo.dev/versions/latest/sdk/symbols/) ·
[Icons guide](https://docs.expo.dev/guides/icons/) ·
[react-native-svg](https://docs.expo.dev/versions/latest/sdk/svg/) ·
[expo-router Color API](https://docs.expo.dev/versions/latest/sdk/router/color/)

**NativeWind v5 docs:**
[Installation](https://www.nativewind.dev/v5/getting-started/installation) ·
[Built on Tailwind CSS](https://www.nativewind.dev/v5/core-concepts/tailwindcss) ·
[Functions & Directives](https://www.nativewind.dev/v5/core-concepts/functions-and-directives) ·
[States & Pseudo-classes](https://www.nativewind.dev/v5/core-concepts/states) ·
[Dark Mode](https://www.nativewind.dev/v5/core-concepts/dark-mode) ·
[Colors](https://www.nativewind.dev/v5/customization/colors)

**Unistyles docs:**
[FAQ](https://www.unistyl.es/v3/other/frequently-asked-questions) ·
[Configuration](https://www.unistyl.es/v3/start/configuration/)

**npm registry** (`npm view`, 2026-08-12): `nativewind` dist-tags and
`5.0.0-preview.4` peers · `react-native-css@3.0.7` deps and peers ·
`react-native-unistyles@3.3.0` peers · `@expo/ui` dist-tags ·
`lucide-react-native@1.31.0` · `@react-native-vector-icons/lucide@13.1.2` ·
`react-native-svg@15.15.5`

**gather repo** (branch `AppElent/mobile-app-v1`): `src/styles.css` ·
`src/components/app/MobileDock.tsx` · `src/components/app/Icon.tsx` ·
`src/components/app/ShellPrimitives.tsx` · `src/lib/modules.ts` ·
`src/lib/appNavigation.ts` · `apps/mobile/app/index.tsx` ·
`apps/mobile/app/_layout.tsx` · `apps/mobile/package.json` · `apps/mobile/app.json`
