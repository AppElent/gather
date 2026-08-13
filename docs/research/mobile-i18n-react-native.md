# Does `@appelent/i18n` run without a DOM, and how do the message trees reach the phone?

Research for [#140](https://github.com/AppElent/gather/issues/140), part of the mobile
shell map ([#134](https://github.com/AppElent/gather/issues/134)). Feeds the sharing
decision ([#143](https://github.com/AppElent/gather/issues/143)), which rules on *how*
this crosses the workspace boundary — this note only establishes *what* can cross.

Sources are the installed package (`@appelent/i18n@0.1.0`), its source repo
(`D:\Dev\appelent-packages\packages\i18n`), gather's own `src/lib/i18n/`, and — only
for the native substitutions — Expo's and FormatJS's own documentation.

> **Note on where the package was read.** This worktree has no `node_modules`. The
> installed `dist/` was read from `D:\Dev\gather\node_modules\@appelent\i18n`, whose
> `package.json` reports `0.1.0` — the same version this worktree's `pnpm-lock.yaml`
> pins (`@appelent/i18n@0.1.0`, integrity `sha512-5luhxfz0mREoAs9…`). The dist was then
> checked line-for-line against `D:\Dev\appelent-packages\packages\i18n\src\index.tsx`
> and matches. Every claim below is quoted from source, not from a build artifact
> alone.

---

## Verdict on DOM-freedom

**The engine is not DOM-free, but the DOM usage is small, precisely located, and
sits entirely in three functions that a native app would replace anyway.** Nothing
about it is structural.

Critically: **the DOM calls are in the package's *main* entry (`.`), not quarantined
in a web-specific entry point.** There is no `@appelent/i18n/web` to avoid. But
importing the main entry is harmless — every DOM touch is inside a function body,
so nothing runs at import time.

`packages/i18n/src/index.tsx` — the whole of `createI18n` — contains exactly four DOM
references:

| Line | Code | Reached from |
| --- | --- | --- |
| 35 | `document.cookie.split("; ")` | `readLangCookie()` |
| 47 | `navigator.language` | `readClientLocale()` |
| 69 | `document.cookie = \`${cookieName}=${next}; …\`` | `setLocale()` |
| 70 | `document.documentElement.lang = next` | `setLocale()` |

Mapped onto the five exported members:

| Export | DOM? | Native verdict |
| --- | --- | --- |
| `LocaleProvider` | **No, at render.** `useState(initialLocale)` + a context provider (index.tsx:58–81). | **Renders fine on RN as-is** — but the `setLocale` it hands down does not. |
| `useI18n` | No — `useContext` + a throw (index.tsx:83–89). | **Portable as-is.** |
| `useMessages` | No — `useI18n().messages` (index.tsx:91–93). | **Portable as-is.** |
| `readClientLocale` | **Yes** — `document.cookie` and `navigator.language`. | Must be replaced. |
| `hasExplicitLocaleChoice` | **Yes** — `document.cookie`. | Must be replaced. |
| `setLocale` (on the context value) | **Yes** — `document.cookie` and `document.documentElement.lang`. | Must be replaced. |
| `fmt`, `isLocale`, `resolveLocale` (re-exported from `core.ts`) | **No.** Pure string/array functions. | **Portable as-is.** |
| `plural` (re-exported from `core.ts`) | No DOM — but `Intl.PluralRules` is **missing on Hermes** and it is unguarded. | **Not portable.** Reimplemented natively; see finding 4. |

`src/core.ts` is worth calling out separately: it is 56 lines of pure TypeScript with
**zero imports**. `isLocale`, `resolveLocale`, `fmt` and `plural` touch no global except
`Intl`. `resolveLocale` is especially reusable on native — it takes the cookie value and
the Accept-Language string as *parameters* (core.ts:12–17), so a native caller can feed
it a stored preference and an `expo-localization` language tag without changing a line:

```ts
export function resolveLocale<L extends string>(
	locales: readonly L[],
	fallback: L,
	cookieValue: string | undefined,
	acceptLanguage: string | undefined,
): L
```

The two parameters are named for the web, but they are just "an explicit choice" and
"a preference list". On native they become "the value read from storage" and
"`getLocales()[0].languageTag`". The comma-splitting loop (core.ts:22–32) handles a
single tag correctly, and it already matches `en-US` against `en` via
`tag.startsWith(\`${locale}-\`)` — which is exactly the shape `languageTag` returns.

**A caveat on `document` in Hermes.** On the web, `typeof document !== 'undefined'`
guards are common because `document` exists as a global name. In React Native there is
no `document` global at all, so `document.cookie` raises a `ReferenceError`, not a
`TypeError` on `undefined`. This means the failure is loud and immediate the first time
someone taps a language button — which is the good outcome, not a silent wrong-locale
render.

### What this rules out

`createI18n` cannot be used unmodified on native, because its `setLocale` is baked in
and there is **no injection point**. `I18nConfig` (index.tsx:12–18) accepts exactly
`locales`, `fallback`, `cookieName`, `messages`. There is no `storage`, no
`detectLocale`, no `onLocaleChange`. The DOM is hardcoded, not a default.

That leaves three options for #143 to choose between:

1. **Reimplement the provider natively** (~40 lines: `createContext`, `useState`, a
   `setLocale` that writes to native storage) and import only `core.ts`'s pure
   functions from the package. Cheapest, no upstream change, and the native provider is
   genuinely different anyway (async storage hydration has no web counterpart).
2. **Add a storage/detection port to `@appelent/i18n` upstream** — e.g. an optional
   `adapter: { read(): string | undefined; write(v: string): void }` defaulting to the
   cookie implementation. Correct long-term, but it is a change to a shared package for
   one consumer, and the native side needs an *async* read anyway, which the current
   synchronous `readClientLocale` signature cannot express.
3. **Ship a `@appelent/i18n/native` entry.** Same work as (2) with a worse blast radius.

Option (1) is what the evidence points at. It is also what gather already did once for
the same package, for the same kind of reason — `src/lib/i18n/server.ts` declines
`createGetSsrLocale` and writes the server fn locally, documented at length in that file
and in ADR-0011's "One thing the shared package cannot do for us".

### Two other package-level facts worth knowing

- **`react-dom` is a *non-optional* peer dependency** (`package.json` `peerDependencies`),
  as are `react` and `@tanstack/react-start`. Only `@clerk/clerk-react` and `vitest` are
  marked optional in `peerDependenciesMeta`. The package never imports `react-dom` (the
  built `index.js` imports only `react` and `react/jsx-runtime`), so this is a
  declaration bug rather than a real coupling — but pnpm will warn on an unmet peer if
  `apps/mobile` depends on the package directly. In practice `apps/mobile` already has
  `react-dom` 19.1.0 (inherited from the `react-native-web` template the map wants
  stripped), so this will not bite today and *will* bite the day that dependency goes.
  Worth an upstream issue against `appelent-packages` regardless of which option #143
  picks.
- **`@appelent/i18n/server` and `/clerk-sync` are hard-web.** `server.ts` imports
  `@tanstack/react-start/server` (`getCookie`, `getRequestHeader`) — meaningless on a
  phone. `clerk-sync.tsx` imports `@clerk/clerk-react`, which the map already records as
  React-DOM-only. Neither entry crosses. Both are separate export paths, so neither is
  pulled in by importing `.`.

---

## Answer: the message trees are plain data, and they are *completely* portable

This is the single most important finding, and it is stronger than the ticket hoped for.

**Every single import across all 20 message files in `src/lib/i18n/messages/` is an
`import type`.** Verified by grepping every import statement in the tree; there are no
value imports except the two barrel files (`en/index.ts`, `nl/index.ts`) importing their
own siblings.

`messages/en/modules.ts` — the file the placeholders need — is the clearest case:

```ts
import type { ModuleGroup, ModuleId } from '../../../modules'
```

Type-only. `messages/nl/modules.ts` likewise imports only types, from `../en/modules`.
The rest of both files is object literals of string constants closed with
`satisfies Record<ModuleId, { label: string; description: string }>`.

Three facts compound to make this a guarantee rather than an observation:

1. **`verbatimModuleSyntax: true` in the root `tsconfig.json`.** Under that flag TypeScript
   requires type-only imports to be written `import type` and drops them verbatim from
   emit. A value import cannot hide inside one.
2. **Babel's TypeScript transform (what Metro uses) strips `import type` declarations
   unconditionally.** So the trees survive the RN bundler without a special
   configuration.
3. **`satisfies` is a type-level operator.** It emits nothing.

At runtime, therefore, `messages/en/modules.ts` evaluates to two frozen-in-practice
object literals and a third that references them — no React, no DOM, no TanStack, no
Convex, no `Intl`. It would run in a Hermes bundle, a Node script, or a Cloudflare
Worker unchanged.

**The type-only reach into `convex/` does matter for one thing, though: paths.** Three
English files reach across the repo root:

| File | Type-only import |
| --- | --- |
| `messages/en/baby.ts` | `../../../../../convex/lib/babyEvents` (`BabyEventType`) |
| `messages/en/nutrients.ts` | `../../../../../convex/lib/nutrition` |
| `messages/en/nutrition.ts` | `../../../../../convex/lib/consumption` |

These cost nothing at runtime, but they are five-deep relative paths anchored to the
repo root. **Any move of `messages/` into a `packages/*` directory breaks all three at
typecheck time**, and `modules.ts`'s `../../../modules` with them. That is a real, small,
concrete input to #143: the trees are runtime-portable but not *path*-portable, and
whoever moves them moves `src/lib/modules.ts` and the relevant `convex/lib/` types — or
adds a tsconfig path mapping — in the same change.

`apps/mobile/tsconfig.json` extends `expo/tsconfig.base` and defines no `paths`, so
today there is no alias for `apps/mobile` to reach the root package by. The map already
records the matching fact on the runtime side: the root package has `imports`
(`"#/*": "./src/*"`) but no `exports` and no `main`, so nothing outside it can import
from it yet.

### What the placeholders actually get

Everything the shell needs for a module-catalog-of-placeholders is in this portable set:

- `messages/{en,nl}/modules.ts` → `byId[ModuleId].label` and `.description` for all 13
  modules, plus `groups` (the four `kitchen`/`money`/`home`/`tasting` headings).
- `messages/{en,nl}/shell.ts` → `placeholder.{planned,whatWillLiveHere,body}`,
  `allModules.*`, `nav.*`, `routes.*`, `groups.*`. 267 lines in the Dutch file; the
  shell vocabulary the map wants is already written in both locales.
- `messages/{en,nl}/settings.ts` → `language.{title,description,names}`, where
  `names` is `{ en: 'English', nl: 'Nederlands' }` — each language written in itself, so
  a native language picker needs no new strings at all.

Note that `shell.placeholder.body` already says "…navigation, sharing, and **the mobile
layout** are ready before the full workflow is implemented." The copy was written with
this in mind.

**`src/lib/modules.ts` is portable too**, which matters because the message trees are
useless without it. The file has **zero imports** (verified: `grep -c "^import"` returns
0) and holds `MODULES` as `as const satisfies readonly ModuleDef[]`. Its one web-ish
detail is benign: `icon` is a **string** (`'ChefHat'`, `'Apple'`, `'Wine'`) documented as
a "lucide-react icon name", not an imported React component. So the registry crosses to
native cleanly and the phone maps that string to whatever icon set it uses — but note
that `@expo/vector-icons` (already in `apps/mobile`) does not ship a Lucide set by
default, so the mapping is a real, if small, native-side job. That is #141's problem, not
this ticket's; recorded here because it is the one place a "plain data" registry still
leaks a web assumption.

---

## The substitutions native needs

Four, in decreasing order of how sure I am about them.

### 1. Locale detection: `navigator.language` → `expo-localization`

React Native has no `navigator.language`. Expo's `expo-localization` is the answer, and
Expo's own localization guide names it as the recommended approach: "Use the
`expo-localization` library to get the user's current language."

The API is **synchronous**, which is what makes it a clean drop-in for `resolveLocale`'s
fourth parameter: "You can use synchronous `getLocales()` and `getCalendars()` methods to
get the locale settings of the user device." A `Locale` object carries `languageTag`
(BCP 47 *with* region, e.g. `'nl-NL'`), `languageCode` (*without*, e.g. `'nl'`) and
`regionCode`.

Either field works against `resolveLocale`, since it matches `tag === locale` *or*
`tag.startsWith(\`${locale}-\`)`. `languageTag` is the closer analogue to what
Accept-Language delivers on the web, so passing it keeps the two clients resolving
identically.

There is one Android-specific behaviour to know: "the user can change locale preferences
in Settings without restarting apps. To keep the localization current, you can rerun the
methods every time the app returns to the foreground." `useLocales()` is the hook that
does this. Whether v1 cares is a judgement call — a re-detect would have to *not*
override an explicit stored choice, which `hasExplicitLocaleChoice`'s native equivalent
is exactly what answers.

`expo-localization` is a native module, so adding it costs one EAS iOS build under the
map's "a rebuild is only required when native dependencies … change" rule.

Sources: [expo-localization SDK reference](https://docs.expo.dev/versions/latest/sdk/localization/),
[Expo localization guide](https://docs.expo.dev/guides/localization/).

### 2. Persistence: `document.cookie` → a native key-value store

There is no cookie jar and no `localStorage` on native. Two credible options, both
first-party-documented:

- **`expo-sqlite/kv-store`** — Expo's docs describe it as "a drop-in replacement for the
  `@react-native-async-storage/async-storage` library", and note "A key benefit of using
  `expo-sqlite/kv-store` is the addition of **synchronous APIs**", showing `setItemSync()`
  and `getItemSync()`.
- **`@react-native-async-storage/async-storage`** — the long-standing standard, listed in
  Expo's SDK docs as "an asynchronous, unencrypted, persistent, key-value storage API"
  and marked "Included in Expo Go".

**`expo-sqlite/kv-store` is the better fit here, specifically because of its synchronous
API.** The web's `readClientLocale()` is synchronous, and the root route's loader
(`src/routes/__root.tsx`:80–84) depends on that: it reads the cookie synchronously after
hydration precisely to avoid "a flash of the wrong language while it is in flight" (its
own comment). An async read reintroduces exactly that flash on the phone — the app
renders in English, then snaps to Dutch a tick later. `getItemSync()` preserves the web's
shape and sidesteps the problem entirely. `expo-sqlite` is also already an Expo
first-party module, so it is one fewer third-party dependency.

If an async store is used instead, the native provider needs a hydration story
(render nothing / render a splash until the stored locale resolves), and that is a real
design decision rather than a detail. Worth deciding deliberately.

`expo-secure-store` is *not* the right tool: a language preference is not a secret, and
SecureStore has a value-size limit and slower access for no benefit here.

Sources: [expo-sqlite SDK reference](https://docs.expo.dev/versions/latest/sdk/sqlite/),
[async-storage in Expo](https://docs.expo.dev/versions/latest/sdk/async-storage/).

### 3. `document.documentElement.lang = next` → nothing

This line has **no native equivalent and needs none**. It exists so browsers and screen
readers know what language the page is in. React Native's accessibility layer has no
document-level language attribute; VoiceOver and TalkBack take their language from the
system. The native `setLocale` simply drops it.

Individual `lang={option}` attributes have the same fate —
`LanguageSettings.tsx`:32 sets one per button, and RN's `<Text>` has no such prop. This is
a genuine, if minor, accessibility regression on native with no available fix, and it is
worth writing down rather than discovering later: on the web the "Nederlands" button is
announced in Dutch; on the phone it will be announced in the system voice.

### 4. `Intl.PluralRules` is **MISSING** on Hermes — and the answer is not a polyfill

> **Measured, then decided.** This section was originally a prediction with a
> "verify on the emulator" instruction. The measurement was taken in #136 and the
> decision made in [#150](https://github.com/AppElent/gather/issues/150). Both are
> recorded below; the polyfill this section used to recommend was **rejected**.

**The measurement** — Android emulator, Expo SDK 57, Expo Go, Hermes:

| API | Result |
| --- | --- |
| `Intl.PluralRules` | **MISSING** |
| `Intl.RelativeTimeFormat` | **MISSING** (and unused anywhere in gather) |
| `Intl.NumberFormat` | ✅ `1.234,5` for `nl-NL` |
| `Intl.DateTimeFormat` | ✅ `13-8-2026` for `nl-NL` |

So Hermes' own `Features.md`, FormatJS and Lingui were right, and **Expo's general
"you can use the `Intl` API on all platforms" is wrong** for these two. The sibling
question below about date formatting is answered in the same pass: the OS-backed
formatters are genuinely fine, so the 8 `toLocale*` call sites across `src/` are safe.

**And it is a crash, not a cosmetic bug.** `core.ts`:53 does
`new Intl.PluralRules(locale).select(count)` with no guard and no `try`/`catch`, so on
Hermes it is a `TypeError` and a red screen — not a wrong plural form. gather calls
`plural()` in **11 places** — `src/lib/groupActivity.ts` (2, the "n minutes ago"
activity line), `src/lib/babyDate.ts` (4), and five components. Only `groupActivity.ts`
is shell code; the other nine sit behind modules that ship as placeholders in v1. So the
mobile shell may render zero plurals and the landmine still detonates on whoever first
shows an activity timestamp.

**The decision: mobile owns `plural()` and never touches `Intl`.**

`plural()`'s API is **two-form by construction** — its own JSDoc says "Assumes one/other
CLDR categories", and its body is `category === 'one' ? forms.one : forms.other`. It uses
a full CLDR plural engine to compute a boolean. For English and Dutch, CLDR's `one` rule
is identical (`i = 1 and v = 0`), so that boolean is exactly `count === 1`:

```ts
// apps/mobile's own i18n core — no @appelent/i18n dependency, no polyfill
export function plural<L extends string>(
  _locale: L,
  count: number,
  forms: { one: string; other: string },
): string {
  return fmt(count === 1 ? forms.one : forms.other, { count })
}
```

Zero new dependencies, zero bundle cost, and nothing to sequence before first render —
which matters, because `expo-router/entry` is not a file the app owns, so a polyfill
import would have meant introducing a custom entry just to hold it. This is **permanent
native code, not a shim**: `apps/mobile` takes no dependency on `@appelent/i18n` at all,
so there is nothing for it to retire into.

The cost is honest: `count === 1` is wrong for a locale whose `one` category is not
`n === 1` — French (`0` and `1`), or any language with more than two categories, which
this API could not express anyway. gather has en and nl and the rule holds for both.

**`plural()` hard-throwing is separately a bug in `@appelent/i18n`**, independent of
Hermes: a formatting helper should degrade on a missing platform API, not take the render
down with it. The agreed fix is a feature-detect falling back to the same `count === 1`
rule — the web then pays one `typeof` that always passes and ships no polyfill. Filed on
the catalog rather than applied here, following the precedent ADR-0014 set: the cost is
not the six lines, it is the release, and gather no longer hits the bug.

**For the record, the polyfill that was rejected** — should a future Appelent app need
real CLDR on Hermes, this is the shape, and the two details that are easy to get wrong.
`@formatjs/intl-pluralrules` requires `Intl.getCanonicalLocales` and `Intl.Locale` (or
their polyfills) as prerequisites, and `/polyfill-force` rather than `/polyfill` is
specifically recommended for RN because "the polyfill conditional detection code runs
very slowly on Android and can slow down your app's startup time by seconds."

```ts
// rejected for gather — three packages and a custom entry, to compute a boolean
import '@formatjs/intl-getcanonicallocales/polyfill-force'
import '@formatjs/intl-locale/polyfill-force'
import '@formatjs/intl-pluralrules/polyfill-force'
import '@formatjs/intl-pluralrules/locale-data/en'
import '@formatjs/intl-pluralrules/locale-data/nl'
```

**`Intl.RelativeTimeFormat` is also missing, and gather does not use it** — zero
references across `src/`, `convex/` and the package. Recorded so nobody re-measures it,
and so anyone reaching for relative-time formatting on the phone knows it needs a
polyfill first.

---

<details>
<summary>The original prediction, kept for the reasoning that got it right</summary>

The sources disagreed:

- **Expo's localization guide** says flatly: "If you're using Hermes in your app, you can
  use the `Intl` API on all platforms."
- **React Native's own "Hermes as the Default" post** says the iOS `Intl` implementation
  landed in RN 0.70 and Android's in 0.65, and explains the approach: "we implemented
  `Intl` by calling into APIs exposed by iOS itself" rather than bundling ICU/CLDR data.
  That is the crux — a native-formatter-backed `Intl` covers what the OS exposes, and
  plural *category selection* is not a formatter.
- **Hermes' own `doc/Features.md`** lists "Expanded Intl functionality (e.g.,
  DisplayNames, ListFormat, **PluralRules**, RelativeTimeFormat, and Locale)" under
  **Planned**, not shipped.
- **FormatJS's `intl-pluralrules` docs** — the maintainers of the polyfill — state
  directly: "Since React Native uses Hermes which does not support `Intl.PluralRules`,
  import `/polyfill-force` instead for much better performance."
- **Lingui's React Native tutorial** concurs: as of 08/2024 you need to polyfill
  "`Intl.Locale` using `@formatjs/intl-locale`" and "`Intl.PluralRules` using
  `@formatjs/intl-pluralrules`."

Three independent sources said it was missing; one general Expo statement implied it was
present. **Weight of evidence said the polyfill was needed** — the specific sources beat
the general one, and on the *fact* they were right. Where this reasoning fell short was
in treating "the API is absent" as settling "therefore polyfill it", without reading what
`plural()` actually needed the API for.

**The same question applied to date formatting, and had the happier answer predicted.**
`src/lib/groupActivity.ts`:106 and `src/lib/babyDate.ts`:70,80 call
`toLocaleDateString(locale, …)` / `toLocaleString(locale, …)` — i.e. `Intl.DateTimeFormat`.
That *is* a formatter, so it is exactly what the OS-backed implementation covers. The
failure mode to have watched for was silent English rather than a throw; it did not
occur.

</details>

Sources: [FormatJS intl-pluralrules](https://formatjs.github.io/docs/polyfills/intl-pluralrules/),
[Hermes Features.md](https://github.com/facebook/hermes/blob/main/doc/Features.md),
[Hermes as the Default (React Native blog)](https://reactnative.dev/blog/2022/07/08/hermes-as-the-default),
[Lingui React Native tutorial](https://github.com/lingui/js-lingui/blob/main/website/docs/tutorials/react-native.md),
[Expo localization guide](https://docs.expo.dev/guides/localization/).

---

## File-by-file: what crosses, what gets rewritten

### Portable as-is (no changes beyond import paths)

| File | Why |
| --- | --- |
| `src/lib/i18n/messages/en/*.ts` (10 files) | Object literals; every import is `import type`. |
| `src/lib/i18n/messages/nl/*.ts` (10 files) | Same. |
| `src/lib/modules.ts` | Zero imports; `as const satisfies`; icon is a string name. |
| `@appelent/i18n`'s `core.ts` exports — `isLocale`, `resolveLocale`, `fmt` | Pure functions, no globals. |
| `@appelent/i18n`'s `plural` | **Does not cross** — throws on Hermes. Reimplemented natively; see finding 4. |
| `useI18n`, `useMessages` | `useContext` only. Portable *if* the native app keeps `createI18n`'s context; moot under option (1). |

That is **2,536 lines of message tree** plus the registry, crossing with no rewrite.
Given the map's "Dutch from day one" and "modules ship as placeholders" commitments, this
is the answer that makes the mobile shell cheap: the content the placeholders need
already exists, in both locales, in a form a Hermes bundle can evaluate.

### Rewritten natively

| File | What replaces it |
| --- | --- |
| `src/lib/i18n/index.ts` | A native `createI18n` equivalent: same `SUPPORTED_LOCALES`/`Locale`/`Messages` exports, a provider whose `setLocale` writes to `expo-sqlite/kv-store`, and a `readClientLocale` built from `getLocales()` + the stored value fed into the package's `resolveLocale`. ~40 lines. |
| `src/lib/i18n/server.ts` | **Deleted, not ported.** Pure TanStack Start SSR; there is no server render on a phone. Its job — pick a locale before first paint — is done natively by the synchronous storage read. |
| `src/lib/i18n/LanguageSync.tsx` | Only if Clerk-on-native is wired and the choice should follow the user across devices. `@appelent/i18n/clerk-sync` imports `@clerk/clerk-react`, which is web-only, so this is a rewrite against `@clerk/clerk-expo` — and the *logic* is 20 lines worth copying rather than sharing. Arguably out of v1 scope. |
| `src/components/app/LanguageToggle.tsx` | **From scratch.** 35 lines, but every line is web: `IconButton` from `ShellPrimitives`, `onClick`, `className` with Tailwind utility strings, `aria-label`/`title`. The native version is a `Pressable` + `Text` showing `locale.toUpperCase()`, with `accessibilityLabel` carrying the same `fmt(messages.shell.topbar.switchLanguage, { language: … })` string. **The logic is three lines and the strings already exist** — `NEXT_LOCALE` is `{ en: 'nl', nl: 'en' }`. This is a cheap rewrite, not a hard one. |
| `src/components/settings/LanguageSettings.tsx` | **From scratch**, same shape of reason: `<button>`, `aria-pressed`, `lang`, Tailwind classes, and `SurfaceCard`. Native: a list of `Pressable`s over `SUPPORTED_LOCALES` with `accessibilityState={{ selected: isOn }}` replacing `aria-pressed`, reading the same `messages.settings.language.names[option]`. No new strings. |
| `src/routes/__root.tsx`'s i18n wiring | Becomes `apps/mobile/app/_layout.tsx`. The `<html lang>` goes; the two-branch loader (`typeof document !== 'undefined' ? readClientLocale() : getSsrLocale()`) collapses to the single native read, since there is no server branch. The provider-nesting order is the one thing worth copying deliberately: `LocaleProvider` outermost, `LanguageSync` inside Clerk — the root route's comment explains why. |

### Test infrastructure — question 5

`renderWithI18n` (`src/lib/i18n/testing.tsx`) imports `@testing-library/react`, which is
React DOM. It has **no bearing on native**, and under the map's "No React Native test
runner in v1" it has nothing to be ported *to*. It stays where it is, serving the web app.

`useI18n`'s throw-outside-provider behaviour (index.tsx:83–89) is a different matter and
**does carry over — with more force, not less.** It is pure React with no DOM, and the
reasoning `testing.tsx` records ("a component quietly rendering the fallback language
because a provider went missing is a bug that ships") applies harder on a phone, where
there is no server render to catch it and no one else running the build. Any native
provider written under option (1) should keep the throw.

`src/lib/i18n/__tests__/messages.test.ts` and `assertMessageParity` are unaffected. The
parity check imports only the two message barrels and `vitest` — **no DOM, no jsdom** —
so if the trees move into a shared package, the root Vitest keeps checking them from
their new home. That is the map's "Portable logic gets covered by the root Vitest if the
sharing decision puts it in a shared package", and i18n is the clearest instance of it.

---

## Feeding #143 (the sharing decision)

Five facts this ticket establishes that #143 should take as given:

1. **The message trees and `src/lib/modules.ts` are runtime-pure.** No React, no DOM, no
   bundler assumptions. They can live in a shared package, be dual-published, or be
   reached by a path alias — nothing about their *content* constrains the choice.
2. **They are not path-portable.** Four files reach out with relative paths — three into
   `convex/lib/`, one into `src/lib/modules.ts`. Moving them means moving or aliasing
   those too. This is the concrete cost of the "extract to `packages/`" option.
3. **`@appelent/i18n` itself is a normal npm dependency of `apps/mobile`,** not something
   that crosses the workspace boundary. Only `core.ts`'s pure exports are wanted; the
   `.` entry's DOM is avoided by not calling the three functions that contain it. Its
   unmet-`react-dom`-peer wrinkle is a warning to expect, not a blocker.
4. **The provider is a rewrite either way**, so no sharing mechanism saves it. Roughly 40
   lines of native code exist regardless of what #143 decides.
5. **The volume is worth the mechanism.** 2,536 lines of message tree across 20 files,
   both locales, plus a 13-entry module registry — and every one of those strings is
   under ADR-0011's "any new user-visible string goes in the message tree, in both
   locales" rule *forever*. Copy-paste would be wrong on the first day and catastrophic
   by the tenth string added. This is the strongest argument in the effort for a real
   shared package rather than a path alias.

---

## Open, and how to close it

- ~~**`Intl.PluralRules` on Hermes.**~~ **Closed.** Measured in #136: missing. Decided in
  [#150](https://github.com/AppElent/gather/issues/150): mobile reimplements `plural()`
  as `count === 1`, no polyfill. See finding 4.
- ~~**`Intl.DateTimeFormat` locale fidelity on Hermes.**~~ **Closed.** Measured in #136:
  correct for `nl-NL`, as predicted. The 8 `toLocale*` call sites are safe.
- **Async vs sync storage hydration.** Resolved *if* `expo-sqlite/kv-store`'s
  `getItemSync()` is used. If something else is chosen, the first-paint-flash question
  the root route's loader comment already worried about comes back, and needs an answer.
- **Whether `LanguageSync` (Clerk `unsafeMetadata` mirroring) is in v1 at all.** Not an
  i18n question — it depends on how Clerk-on-native lands, and the map defers that
  elsewhere.
