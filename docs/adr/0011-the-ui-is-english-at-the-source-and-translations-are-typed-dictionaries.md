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

## What is not done

Only the shell is translated: navigation, the topbar, the Group switcher, Home,
All, the placeholder pages, the not-found page and `/settings`. Recipes,
Nutrition, Tasks, the Baby log, Foods and a Group's own settings are still
English literals in their components, and each is extracted as its own change
using the same recipe. Until then the app is honestly half-translated rather
than dishonestly half-typed — the parity test proves what *is* in the tree is
complete, and says nothing about what has not been put there yet.

`@appelent/auth`'s own strings — the sign-in forms, the account panel,
`AppearanceSettings` — belong to that package and are out of gather's reach.
