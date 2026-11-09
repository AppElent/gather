---
type: decision
description: Read before adding foods, a food diary, nutrition targets or nutrition logging back to Gather, or before changing what a Recipe's nutrition is.
version: 1.0.0
status: accepted
date: 2026-11-09
---

# Nutrition is retired, and Foundry owns it

Gather's Nutrition Module kept a food library (with Open Food Facts lookup and a
seeded Catalog of foods), a personal food diary, Combos and daily nutrition
targets. It was the last Personal Module: everything else had already become
Group-scoped ([ADR-0030](./0030-groups-are-the-only-user-owned-scope.md)), and
the phone had already shipped without it. The owner's workouts app, Foundry,
now owns foods, nutrition logging and estimates.

The owner retired the Module rather than keep two apps that log the same meals.
Gather removes its routes, components, Convex functions and messages, and the
`foods`, `consumptionEntries`, `combos` and `comboItems` tables.
`maintenance:retireNutrition` empties those tables, deletes the product photos
`foods.imageId` held, and unsets `users.nutritionTargets` in every deployment
([active migrations](../migrations/README.md)).

A Recipe's nutrition stays. It is part of the Recipes Module, not the retired
one: per-serving figures read from an imported page, typed in, or estimated by
AI, shown on the recipe and marked stale when the ingredients change. Removing
it would need a phone release and a migration of the `recipes` table, and it is
a separate product decision.

This supersedes [ADR-0012](./0012-a-combo-is-a-personal-shortcut-and-not-a-recipe.md).
[ADR-0004](./0004-catalog-entries-are-read-only-and-the-seed-always-wins.md)
stands for the Tasting catalog; its food rows are gone.

## Consequences

- No Module is Personal any more. A person's own rows are only their account
  (`users`) and their AI usage counter (`aiUsage`).
- The default Pins are Recipes and Tasks. A stored Pin to `nutrition` is
  dropped where the catalog is read, like any id no Module declares.
- `users.nutritionTargets` stays in the schema only until every deployment has
  run `retireNutrition` to zero, because Convex refuses a schema that drops a
  field documents still hold.
- Deploying production no longer seeds a food Catalog.

## Rejected

- Keeping the Module beside Foundry: two diaries for one person drift apart, and
  Gather would carry Open Food Facts, barcode scanning and the Catalog for
  nothing.
- Leaving the tables' rows behind after dropping them from the schema: they
  would hold a person's diary that no screen shows, export or deletes.
