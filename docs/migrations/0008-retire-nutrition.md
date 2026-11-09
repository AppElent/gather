# 0008 — Retire the Nutrition Module's data

**Status:** run on dev; production outstanding
**Code:** `convex/maintenance.ts` → `retireNutrition`, plus the legacy
`users.nutritionTargets` field in `convex/schema.ts`

## Why

The Nutrition Module is retired and Foundry owns nutrition
([ADR-0041](../adr/0041-nutrition-is-retired-and-foundry-owns-it.md)). Its
tables left the schema, but Convex keeps the rows of a table the schema stops
declaring. Left there, they would hold a person's food diary that no screen
shows, the data export leaves out and account deletion no longer reaches.

## What it does

Each run deletes up to 200 rows across `comboItems`, `combos`,
`consumptionEntries` and `foods` (in that order), deletes the product photo of
every deleted food that had one, and unsets `nutritionTargets` on every user.
It is dry unless called with `{"apply":true}`, and returns
`{ apply, deleted, images, nutritionTargets, more }`. On a deployment that never
had the tables it reads as empty.

## Running it

Production order. Merging changes nothing on the backend: staging is a frontend
on the production deployment (ADR-0039).

1. Deploy production (the **Deploy production** workflow). The schema drops the
   four tables; their rows stay until step 3.
2. `pnpm exec convex run maintenance:retireNutrition --prod`: the dry run.
3. `pnpm exec convex run maintenance:retireNutrition '{"apply":true}' --prod`,
   repeated while `more` is true.
4. Run step 3 once more and confirm every count is zero.
5. Record the dry run and the zero run below.

Until step 3 runs, deleting an account leaves that person's diary rows behind;
this run removes them. Preview deployments seed their own household and start
without the tables.

## Retiring it

When the table below records a zero run on production, delete
`retireNutrition`, its test and `users.nutritionTargets`, and delete this file.

| Deployment | Run on | Dry run | Final run |
| ---------- | ------ | ------- | --------- |
| dev (`basic-ibex-235`) | 2026-11-09 | `deleted: { comboItems: 6, combos: 2, consumptionEntries: 28, foods: 34 }, images: 0, nutritionTargets: 1, more: false` | all zero |
| production | | | |
