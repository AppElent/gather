---
type: runbook
description: Read when adding a Module, a nested web route, a Convex table with a groupId, a _storage column, a photo preset, or a schema-keyed message.
version: 1.2.0
---

# Add a Module

Gather's registries that every new Module, route or column has to reach.
Every row but the last fails `pnpm typecheck` or `pnpm test` when forgotten;
`PHOTO_PRESETS` is kept honest only by this page. Work through every row in
the same change as the Module.

## Prerequisites

- The Module's id, group (`kitchen`, `money`, `home`, `tasting`) and scope
  decided. A fifth group is a design decision: it needs a contrast-safe tint on
  both themes ([ADR-0017](../adr/0017-the-phone-owns-its-look-and-shares-its-words.md)).
- Its domain terms in [GLOSSARY.md](../../GLOSSARY.md).
- No on/off switch: a Module is configured by its content, so an empty
  Module's invitation and its setup are the same screen
  ([ADR-0022](../adr/0022-a-module-is-configured-by-its-content-not-by-a-switch.md)).

## Project facts

| Registry | When | Forgetting it | Owner |
| --- | --- | --- | --- |
| `packages/core/src/modules.ts` `MODULES` | Every Module | Nothing else can name it | — |
| `packages/core/src/messages/{en,nl}/modules.ts` | Every Module: label and description, English first | `pnpm typecheck` (`satisfies Record<ModuleId, …>`) | [Localization](../../CODING_STANDARDS.md#localization) |
| `apps/mobile/src/drop/dropTargets.ts` `DROP_TARGETS` | Every Module; an empty list if it accepts no Drop | `pnpm typecheck` (`Record<ModuleId, …>`) | [Drop](../contracts/drop.md) |
| `convex/lib/groupCascade.ts` `GROUP_CONTENT` | Every table with a `groupId` | `pnpm typecheck` (derived from the schema) | [Account deletion](../contracts/account-deletion.md) |
| `convex/lib/storedFiles.ts` `FILE_HOLDERS` | Every `_storage` column | `pnpm typecheck` (typed off the schema) | [Stored files](../contracts/stored-files.md) |
| `convex/maintenance.ts` `USER_REFERENCES` | Every column holding a `v.id('users')` | `pnpm typecheck` (derived from the schema) | [Migrations](../migrations/README.md) |
| Message tables keyed by `NutrientKey`, `MealName`, `BabyEventType` | A new nutrient, meal or baby event type | `pnpm typecheck` | [Localization](../../CODING_STANDARDS.md#localization) |
| `packages/core/src/babyEvents.ts` (`BabyEventDataByType`, `summarizeBabyEvent`) | A new baby event type | `pnpm typecheck` | [Localization](../../CODING_STANDARDS.md#localization) |
| `src/lib/links.ts` `MODULE_ROUTES` + a route file under `src/routes/_app/` | Every Module | `pnpm typecheck` (`Record<ModuleId, …>`); `pnpm test` (`src/lib/modules.routes.test.ts`) for the route file | [Navigation](../contracts/navigation.md) |
| `apps/mobile/src/modules/moduleDestination.ts` `NATIVE_MODULES` (and `ModulePath` for each screen pushed by name) | When the Module gets native screens | `pnpm test` (`moduleDestination.test.ts`: every Module's address must be a route file, and only a Module without screens may land on the placeholder) | — |
| `apps/mobile/src/shell/quickActions.ts` `ACTIONS_BY_MODULE` | Every Module; an empty list if it has no capture verb for the Add tab | `pnpm typecheck` (`Record<ModuleId, …>`) | [Mobile design system](../../apps/mobile/DESIGN_SYSTEM.md#forms-and-quick-actions) |
| Seed contribution in `convex/lib/seed/`, and the Module's row in `SAMPLE_CONTENT` (`convex/seed.test.ts`) | Every Module: a Catalog fixture if it needs reference data, Sample household fixtures always | `pnpm typecheck` (`SAMPLE_CONTENT` is a `Record<ModuleId, …>`); `pnpm test` when the Sample household has no rows for it | [Seed data](../contracts/seed-data.md) |
| `<Breadcrumbs>` trail | Every route below an index | `pnpm test` (`src/components/app/Breadcrumbs.routes.test.ts` walks `src/routes/_app/`; an exception needs an entry with its reason) | [Navigation](../contracts/navigation.md) |
| `packages/core/src/photoPresets.ts` `PHOTO_PRESETS` | A new kind of photo | Silent drift: a dimension written at a call site | [Stored files](../contracts/stored-files.md) |

## Steps

1. Declare the Module in `modules.ts` and its words in both core trees; run
   `pnpm typecheck` and let each compile error name the next registry.
2. Add the web surface and route, then run `pnpm test` and let each failure
   name the next row.
3. For a backend change to existing data, write the migration with its end
   condition ([one-shot code](../../CODING_STANDARDS.md#one-shot-code)).

## Verify

- `pnpm typecheck` and `pnpm test` pass.
- `pnpm run seed:sample` (or Settings → Sample data) shows the Module populated.
- The Module opens its real screen from All on the phone, and every
  nested web page has a trail back to the Module's index.
