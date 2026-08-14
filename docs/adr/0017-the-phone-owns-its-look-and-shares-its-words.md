# The phone owns its look and shares its words

Status: accepted (2026-08-13)

gather's web app is a Tailwind v4 site whose identity lives in CSS custom
properties and a cascade. React Native has neither. The obvious response is to
port the palette across and keep the two clients looking the same; this ADR
records the decision not to.

**`apps/mobile` defines its own visual identity.** The words, the Modules and
the tints that group them are shared and cannot diverge without a compile error.
The palette, the type and the layout are the phone's own answers, and they are
already different from the web's.

## What styles a component

A **typed token module consumed by `StyleSheet`** — option A of the four
[#141](https://github.com/AppElent/gather/issues/141) surveyed. No native code,
so no EAS build is spent to adopt it, and a mistyped token is a compile error
rather than a silently dropped declaration.

The two libraries that lost, lost for reasons that could change:

- **Unistyles 3** has the best theming design of the four and is the only fully
  stable one. It needs Nitro Modules, which means no Expo Go, which means every
  iOS install goes through EAS from a Windows machine that cannot build iOS.
  It is the right library for a different machine.
- **NativeWind v5** would let colour vocabulary cross from the web — `var()`,
  `color-mix()` and `oklch()` are genuinely polyfilled. Its own documentation
  says it is not intended for production use, and #141 measured that **5 of
  `MobileDock`'s 19 utilities fail silently**: `grid`, `fixed`, and both
  `aria-[current=page]:` variants. A class string that transfers 74% of the time
  with no diagnostic is a worse foundation than one that transfers 0% and says so.

Chrome is not hand-styled. `@expo/ui`'s **Universal** components (`Host`,
`List`, `Switch`, `Picker`) render real SwiftUI and real Jetpack Compose from
one code path and ship inside Expo Go, so settings-shaped surfaces are native at
no cost. `expo-router`'s `Stack` and `NativeTabs` own navigation chrome.

**Auth text fields are the exception and stay on React Native's own
`TextInput`.** `@expo/ui`'s input takes an `ObservableState` from
`useNativeState` and runs `onChangeText` as a UI-thread worklet — a second
mental model, landing on the one v1 flow with real state to get wrong, where
[ADR-0014](0014-the-phone-is-a-clerk-generation-ahead-of-the-web.md) already
puts three-step password reset and per-field errors.

**Type is the platform's.** San Francisco on iOS, Roboto on Android; no
`@expo-google-fonts` package, no `expo-font` load, no splash hold. The argument
is not only cost: `@expo/ui` components use the system face whatever else is
loaded, so a custom body face would give Settings one typeface and every other
screen another.

## The identity is the catalogue

The phone ships thirteen Module placeholders and nothing behind them, so those
placeholders **are** the app. Each Module wears the tint of its group — Kitchen,
Money, Home & life, Tasting — which makes the four groups readable at a glance
and makes an app with nothing built still look finished.

The accent follows from it, and is stated as a rule rather than a value:

> **The accent is the colour of what you are looking at. Where you are looking
> at everything, it is ink.**

Screen content and the primary action take the group's tint. **Home, All and
Settings have no group, so they are ink** — and so is the tab bar, always, on
every screen. That last clause is deliberate: driving `NativeTabs`' tint per
route means changing a native prop on the one component
[#142](https://github.com/AppElent/gather/issues/142) found is keyed on its
configuration in ways that remount the tree. The rule reads where it matters and
stays off the fragile surface.

The standing cost, named so nobody is surprised by it: **a fifth Module group is
a design decision, not a registry entry.** It needs a tint that clears contrast
on both grounds.

## Where the tokens live

Split, on [#143](https://github.com/AppElent/gather/issues/143)'s criterion —
*core holds what two clients must agree on and cannot diverge safely*:

| | |
| --- | --- |
| `packages/core/src/moduleTints.ts` | the four group tints, `satisfies Record<ModuleGroup, Tint>` |
| `apps/mobile/src/theme/` | neutrals, radii, the accent rule, the icon map |

The tints go to core so the web can adopt the tinted catalogue later without a
second definition, and because they are keyed by `ModuleGroup`, a union core
already owns — the record sits beside the type that constrains it. Everything
else is a phone-shaped answer the web has its own version of.

**Note what the web's opt-in will cost when it comes.** The web consumes colour
as CSS custom properties through Tailwind arbitrary values, so a TypeScript
object in core is available to it but not usable by it. Adopting the tints means
generating `styles.css` from core — gather already has `scripts/generate-icons.mjs`
and `generate-sw.mjs`, so the shape is familiar — or hand-copying hexes into CSS
and accepting two sources of truth. That generator is deliberately **not** built
now: it would put a build script on the critical path of a running phone for a
benefit no web code has asked for.

Two problems dissolved rather than being solved, worth recording so they are not
rediscovered as open:

- **There is no oklch conversion.** `@react-native/normalize-colors@0.86.2`
  accepts `rgb`/`rgba`/`hsl`/`hsla`/`hwb`/`#hex3|4|6|8` and named colours —
  **not `oklch()`**, which every `--app-*` token is written in. That would have
  been a real cost had the phone ported the web's neutrals. It does not port
  them, so it is not a cost.
- **[#74](https://github.com/AppElent/gather/issues/74) is neither blocked nor
  blocking.** It decides the *web's* primary action; the phone's is the adaptive
  rule above. Neither waits for the other.

## Light and dark, without a cascade

The web's three states — system, light, dark — port exactly, as a mechanism
change rather than a capability loss. `Appearance.setColorScheme()` takes `null`
for system and `'light'`/`'dark'` for an explicit choice, persisted to
`expo-sqlite/kv-store` (synchronous, per
[#140](https://github.com/AppElent/gather/issues/140)) and re-applied at
startup. `app.json` already sets `userInterfaceStyle: "automatic"`, without
which none of it works.

**A component calls `useTokens()` and gets colours, not conditions.** The scheme
is already applied and the accent already resolved to either a group tint or
ink, so no call site branches on theme and no component knows why its accent is
teal. The tint reaches the hook from a context set in exactly one place — the
shared `ModulePlaceholder`, from its own `moduleId`. Thirteen placeholders
behind one component means there is one thing to set and nothing to forget, and
it does not couple to a route shape
[#146](https://github.com/AppElent/gather/issues/146) has not chosen.

`StyleSheet.create` holds layout, which is static; colour is applied inline,
which is the React Native idiom and not a compromise.

## Icons

`lucide-react-native` 1.31.0, which needs `react-native-svg` ^15 — SDK 57
bundles 15.15.4. Glyphs are identical to the web's, so the Module registry's
icon names mean the same picture on both clients.

**The names cross; the lookup does not.** `src/components/app/Icon.tsx` reaches
lucide with `import * as Icons`, and the package is 24.8 MB across 9,131 files.
Metro does not tree-shake by default, so porting that pattern would add roughly
1,500 modules to a bundle
[#136](https://github.com/AppElent/gather/issues/136) measured at 1,392 — paid
on every cold start of the dev loop it just finished tuning.

So `ModuleDef.icon` narrows from `string` to a **thirteen-name union**, and the
phone maps the names to components explicitly under
`satisfies Record<ModuleIconName, LucideIcon>`. Thirteen icons are bundled, and
the runtime cast `Icon.tsx` documents as unavoidable becomes a compile-time
check: a Module declared with a misspelled icon now fails to build in both
clients instead of silently rendering a square in one.

`@expo/vector-icons` (deprecated by Expo) and `expo-symbols` are dropped from
`apps/mobile`. `expo-symbols` would otherwise be tempting — it does render on
Android as of SDK 57 — but it needs per-platform names, which would show
**different pictures for the same concept** on the Android prototype and the iOS
acceptance build. That is a bad property for a workflow that iterates on one
platform and accepts on the other.

## Where the line is

The shell's rule was *divergence in layout is fine; divergence in vocabulary is
not*, which left colour and type undefined. They are defined now, and the rule
is recorded in `CONTEXT.md` as words-versus-look, deliberately without naming a
package — the glossary should not depend on the workspace layout.

The enforcement is the layout, and belongs here instead: **what the two clients
must agree on is in `@gather/core`**, where `dependencies: {}` and a
wildcard-free `exports` map make agreement a fact rather than a habit. Module
names and descriptions, the message trees, the Module groups, their tints and
the icon names are all inside it. Neutrals, accent, radii, type, spacing, layout
and controls are not, and the phone has already exercised that freedom in every
one of them.

So "may these diverge?" has a mechanical answer — is it in core? — and #146 and
#147 inherit it rather than relitigating it.

## What would reopen this

Not an end condition; this is permanent code. But three triggers are worth
naming, because each was a close call decided by a fact that can change:

- **`nativewind@5` reaching a stable `latest` tag.** It was rejected on
  stability, not merit.
- **The delivery path leaving Expo Go** — a Mac, or EAS builds becoming
  routine. Unistyles becomes available, and with it `expo-symbols` and a real
  per-platform icon story.
- **The web adopting the tinted catalogue.** That is the moment the generator
  above stops being premature.
