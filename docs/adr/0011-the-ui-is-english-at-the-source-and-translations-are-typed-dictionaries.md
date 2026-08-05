# The UI is English at the source, and translations are typed dictionaries

Status: accepted (2026-08-04)

Gather's own words are written in English first, in `src/lib/i18n/messages/en/`,
and every other locale is a file of the same shape that `satisfies` the English
one. Content — anything a person or an external source wrote — is never
translated. There is no i18n library; the engine is `@appelent/i18n`, and the
dictionaries are ordinary TypeScript objects.

## The line that actually matters: chrome, not content

The hard part of translating an app this size is not the mechanism. It is
knowing what to leave alone.

**Chrome is Gather talking.** Navigation, buttons, headings, empty states,
`aria-label`s, the sentence Home builds around an activity entry, a Module's
name and its one-line description. All of it is translated.

**Content is somebody else talking.** A Group's name, a Member's name, a recipe
title, a task, a note, a child's name, a food from Open Food Facts, and every
fixture in `convex/lib/seed/`. None of it is translated, ever — not by us and
not by a translation layer. A recipe called "Boeuf bourguignon" stays that in
English, and one called "Shepherd's pie" stays that in Dutch, because the person
who typed it chose those words.

Get this wrong in one direction and translations bleed into the database; get it
wrong in the other and half the interface stays English. The seed fixtures are
the case most likely to tempt somebody: they are ours, they are visible, and
they are still content.

## Why the strings left `lib/modules.ts`

A Module's `label` and `description` used to sit in the registry beside its icon
and scope. They are the most-rendered strings in the app — sidebar, dock, topbar
title, All, the command palette, nine placeholder pages — and the registry is
deliberately a plain data file that no React context may reach, because
`appNavigation.ts`, `pins.ts` and `groupActivity.ts` all read it from outside a
component.

So they moved to `messages/<locale>/modules.ts`, keyed by Module id and typed
`satisfies Record<ModuleId, …>` against the registry itself. Declaring a Module
without naming it is now a `pnpm typecheck` failure rather than a page that
renders `undefined`. `MODULE_GROUPS` became ids for the same reason: a heading
is a translated string, a bucket key is not.

The functions that used to read those fields take a messages object as a
trailing parameter instead of importing the context — `navItems`,
`jumpTargets`, `getRouteContext`, `activityModuleLabel`, `formatActivityTime`.
They stay callable from a test with no React tree around them, which is most of
why they were plain functions to begin with.

## One thing the shared package cannot do for us

`@appelent/i18n` exports a `createGetSsrLocale` factory that builds the SSR
locale-resolution server function. Gather does not use it, and no app on
TanStack Start can: the Vite plugin rewrites `createServerFn(...).handler(...)`
calls it finds in **app source** into registered endpoints, and never looks
inside a pre-bundled dependency. The factory's server fn is therefore never
registered, and calling it returns `undefined` rather than running the handler —
which is what it did here, silently, until SSR tried to destructure the result.

`src/lib/i18n/server.ts` declares the server function itself and takes only the
pure `resolveLocale` from the package. Do not "simplify" it back to the factory.

## Why typed `.ts` and not react-i18next

At two locales maintained by the developer editing the files directly, a typed
object tree buys something a JSON catalog cannot: a missing key is a compile
error, not a runtime fallback nobody notices. `assertMessageParity` covers what
the type system cannot see — an empty string, and a `{placeholder}` one locale
interpolates and another silently drops.

This stops being the right trade at three or four locales, or the first time
translations arrive from an external translator or a TMS rather than from a
commit. The dictionary shape maps 1:1 onto JSON message catalogs, so that
migration is mechanical.

## Dutch glossary

Dutch keeps the capitalised proper nouns CONTEXT.md sets for the domain: Groep,
Lid, Module, Pin. Ordinary UI words are lowercase as Dutch normally writes them.

| English | Dutch |
| --- | --- |
| Group / Member / Module | Groep / Lid / Module |
| Pin (verb) / Unpin | Vastzetten / Losmaken |
| Home | Start |
| All modules | Alle modules |
| Settings / Group settings | Instellingen / Groepsinstellingen |
| Groups | Groepen |
| Soon / Only you / Personal | Binnenkort / Alleen jij / Persoonlijk |
| Recipes | Recepten |
| Nutrition | Voeding |
| Meal planner | Maaltijdplanner |
| Groceries | Boodschappen |
| Pantry | Voorraadkast |
| Finances | Financiën |
| Bills & subscriptions | Rekeningen & abonnementen |
| Tasks | Taken |
| Baby log | Babylogboek |
| Calendar | Agenda |
| Notes | Notities |
| Cheeses / Wines | Kazen / Wijnen |
| Kitchen / Money / Home & life / Tasting | Keuken / Geld / Huis & leven / Proeven |

## Backend files do not hold display strings

Four records of English lived in `convex/`, read only by client components:
`NUTRIENT_LABELS`, `MEAL_LABELS`, `BABY_EVENT_LABELS`, and the baby-log option
labels in `src/lib/babyEventFields.ts`. All four moved to the message tree,
keyed by the union the schema already defines, so the key stays where the data
is and the word goes where the reader is.

`BABY_EVENT_LABELS` was the one with a server-side reader: `activity.ts` used
it to title a baby-log entry. That was the backend choosing a display word, so
it now sends the `BabyEventType` key and the client names it. This makes the
`title` field of `GroupActivityEntry` mean two things by `kind`, which its
comment now spells out: content for a recipe or a task, a type key for a baby
event. That is the honest shape — a recipe's title is somebody's words, a
temperature entry's is ours.

Two smaller rules fell out of doing this at scale:

- **A validator returns a key, not a sentence.** `buildEventInput` reports
  `'enterVaccineName'`; the form that renders the complaint resolves it. The
  validator never has to be handed a message tree to stay testable.
- **A message read inside a `useEffect` makes the effect depend on the
  locale.** Where that is wrong — the camera stream in `BarcodeScanner`, the
  once-only OAuth callback — the *state* holds a key and the words are chosen at
  render. Biome's `useExhaustiveDependencies` catches this, and adding the
  dependency is usually the wrong fix.

## What is not done

`@appelent/auth`'s own strings — the sign-in forms, the account panel,
`AppearanceSettings` — belong to that package and are out of gather's reach.
Everything gather itself renders is translated.

Dates and numbers go through `Intl` with the active locale, so a Dutch reader
gets `di 4 aug, 13:30` and `1 minuut geleden` without a second dictionary.
Durations inside a summary (`1h 15m`) are not yet localised; they are compact
enough to read either way, and doing them properly means a duration formatter
rather than a message.
