---
type: contract
description: Read when changing the Catalog, the tasting Catalog, the Sample household, or any seed entrypoint.
version: 2.1.0
status: current
---

# Seed data

Two mechanisms with deliberately opposite rules, kept as plain functions in
`convex/seed.ts` ([ADR-0004](../adr/0004-catalog-entries-are-read-only-and-the-seed-always-wins.md)).
Fixtures and logic live in `convex/lib/seed/`; only `convex/seed.ts` exports
callable functions, because every export under `convex/` is deployed API.

## Behavior

- **A Catalog entry is a fact or a suggestion, and which one decides whether
  anything may point at it.** A Food is a fact, so a diary entry references the
  Catalog row and the row stays read-only forever. A **Tasting catalog** entry
  is a suggestion, so nothing references it: tasting it makes a copy that is
  yours, and the shipped row is never seen again
  ([ADR-0024](../adr/0024-a-tasting-catalog-is-a-picker-and-tasting-it-makes-it-yours.md)).
- **The Catalog is read-only and always reflects the shipped version.** A
  person who needs a different entry creates their own alongside it.
- **Food Catalog** (`seedCatalog`, `catalogFoods.ts`) is reference data the
  app needs in every environment, production included, and every diary entry
  references its rows directly ([ADR-0004](../adr/0004-catalog-entries-are-read-only-and-the-seed-always-wins.md)).
  It is reconciled by `seedKey` in the shared `foods` table: the seed always
  wins, retired fixtures are deleted, and rows without a `seedKey` are
  user-created and never touched. Catalog Foods are read-only in the app,
  enforced server-side on every write path (`assertNotCatalog` in
  `convex/foods.ts`) as well as in the UI.
- **Tasting catalog** (`seedTastingCatalog`, `tastingCatalog.ts`) is a picker,
  not a reference ([ADR-0024](../adr/0024-a-tasting-catalog-is-a-picker-and-tasting-it-makes-it-yours.md)).
  Its own `tastingCatalog` table holds only seeded rows, reconciled by `seedKey`
  (updated, deduplicated, retired rows deleted). Choosing an entry creates the
  Group's own `tastingSubjects` row, prefilled from it and keyed by
  `(groupId, kind, catalogKey)` so choosing it again finds the same subject
  (`convex/tastings.ts`). From then on the subject belongs to the Group: any
  Member may edit it, a later seed never rewrites it, and its `catalogKey` is
  Provenance only — allowed to dangle when the entry is retired.
- Deploys run both Catalog seeds ([deploy](../runbooks/deploy.md#seeding-is-a-deploy-step)).
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
- Running `seedCatalog` or `seedTastingCatalog` twice changes nothing the
  second time, and neither changes a Group's tasting subjects.
- The Sample household is *not* idempotent: every run wipes it and builds a
  new one dated from that run. A reset leaves no unreachable rows, and content
  the Sample Group only referenced survives: a real person's recipe is
  un-shared, not deleted, and their previous default Group is restored.
