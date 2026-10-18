---
type: contract
description: Read when changing the Catalog, the tasting Catalog, the Sample household, or any seed entrypoint.
version: 1.0.0
status: current
---

# Seed data

Two mechanisms with deliberately opposite rules, kept as plain functions in
`convex/seed.ts` ([ADR-0004](../adr/0004-catalog-entries-are-read-only-and-the-seed-always-wins.md)).
Fixtures and logic live in `convex/lib/seed/`; only `convex/seed.ts` exports
callable functions, because every export under `convex/` is deployed API.

## Behavior

- **Catalog** (`seedCatalog`, `catalogFoods.ts`; `seedTastingCatalog`,
  `tastingCatalog.ts`) is reference data the app needs in every environment,
  production included. It is reconciled by `seedKey`: the seed always wins,
  retired fixtures are deleted, and rows without a `seedKey` are user-created
  and never touched. Catalog rows are read-only in the app, enforced server-side
  for every write path (`assertNotCatalog` in `convex/foods.ts`) as well as in
  the UI. Deploys run the seeds ([deploy](../runbooks/deploy.md#seeding-is-a-deploy-step)).
- **Sample household** (`seedPreview`, `loadSampleData`, `sampleHousehold.ts`)
  is fake content for dev and previews only. It is wiped and recreated on every
  run, tracked in the `seedRuns` table, with every date anchored to the run.
  Fixtures are handwritten; `faker` only pads lists to test volume.
- **Reset cascades through containment**: a task added to a seeded list, or a
  baby's lazily created lists, go with the household, because deleting only
  the recorded rows would leave them unreachable rather than intact.
- **What the sample Group merely references survives**: a recipe a real person
  owns is un-shared, not deleted, and the owner's previous default Group is
  restored.
- `loadSampleData` / `resetSampleData` are public and refuse to run unless the
  deployment sets `ENABLE_SAMPLE_DATA=true`, which production never does
  ([environment](../runbooks/environment.md#hazards)). The internal entrypoints
  do not consult it.
- Previews seed through `--preview-run seed:seedPreview` around the hardcoded
  `PREVIEW_TEST_USER` ([previews](../runbooks/previews.md#hazards)).

## Acceptance

- Every Module contributes Sample household fixtures, and a Catalog fixture
  when it needs reference data ([add a Module](../runbooks/add-a-module.md)).
- Running a seed twice changes nothing the second time; reset leaves no
  unreachable rows.
