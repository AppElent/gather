---
type: contract
description: Read when changing the Catalog, the tasting or Retailer Catalog, the Sample household, or any seed entrypoint.
version: 3.0.0
status: current
---

# Seed data

Two mechanisms with deliberately opposite rules, kept as plain functions in
`convex/seed.ts` ([ADR-0004](../adr/0004-catalog-entries-are-read-only-and-the-seed-always-wins.md)).
Fixtures and logic live in `convex/lib/seed/`; only `convex/seed.ts` exports
callable functions, because every export under `convex/` is deployed API.

## Behavior

- **A Catalog entry is a suggestion, so nothing references it.** Tasting a
  **Tasting catalog** entry makes a copy that is yours, and the shipped row is
  never seen again
  ([ADR-0024](../adr/0024-a-tasting-catalog-is-a-picker-and-tasting-it-makes-it-yours.md)).
  The food Catalog, whose rows a diary referenced, was retired with the
  Nutrition Module ([ADR-0041](../adr/0041-nutrition-is-retired-and-foundry-owns-it.md)).
- **The Catalog is read-only and always reflects the shipped version.** A
  Group that wants a different entry edits its own copy.
- **Tasting catalog** (`seedTastingCatalog`, `tastingCatalog.ts`) is a picker,
  not a reference ([ADR-0024](../adr/0024-a-tasting-catalog-is-a-picker-and-tasting-it-makes-it-yours.md)).
  Its own `tastingCatalog` table holds only seeded rows, reconciled by `seedKey`
  (updated, deduplicated, retired rows deleted). Choosing an entry creates the
  Group's own `tastingSubjects` row, prefilled from it and keyed by
  `(groupId, kind, catalogKey)` so choosing it again finds the same subject
  (`convex/tastings.ts`). From then on the subject belongs to the Group: any
  Member may edit it, a later seed never rewrites it, and its `catalogKey` is
  Provenance only — allowed to dangle when the entry is retired.
- **Retailer catalog** (`seedRetailerCatalog`, `retailerCatalog.ts`) is a
  picker by the same rules, minus the one-per-key lookup: a household may hold
  two cards from one store, so choosing a retailer always creates a new
  `loyaltyCards` row with the retailer's colour, domain and format copied onto
  it and its `seedKey` kept as `catalogKey` Provenance
  ([ADR-0043](../adr/0043-a-retailer-catalog-is-a-picker-and-a-card-keeps-its-own-copy.md)).
  Every fixture carries a source comment; an unsourced barcode format is
  `CODE_128` with `formatConfidence: 'guess'`.
- **Retailer logos** ship with the clients, not in Convex: each Catalog
  `seedKey` is either in `RETAILER_LOGOS` (with its source and licence) or in
  `RETAILERS_WITHOUT_LOGO` (with the reason) in
  `packages/core/src/retailerLogos.ts`, and its WebP files sit in
  `packages/core/assets/retailer-logos/`. Adding, renaming or retiring an
  entry updates that manifest and re-runs `scripts/prepare-retailer-logos.mjs`
  in the same change; `scripts/retailer-logos.test.ts` fails otherwise. A card
  finds its logo by `catalogKey`, so a retired entry's cards fall back to the
  monogram. The phone bundles the files through a generated `require` list;
  re-run `node apps/mobile/scripts/generate-retailer-logo-files.mjs` after the
  prepare script, or `scripts/mobile-retailer-logo-files.test.ts` fails.
- Deploys run both Catalog seeds ([deploy](../runbooks/deploy.md#seeding-is-a-deploy-step)).
- **Sample household** (`seedPreview`, `loadSampleData`, `sampleHousehold.ts`)
  is fake content for dev and previews only. It is wiped and recreated on every
  run, tracked in the `seedRuns` table, with every date anchored to the run.
  Fixtures are handwritten; `faker` only pads lists to test volume.
- **Reset cascades through containment**: it destroys the recorded Group through
  `destroyGroup` ([account deletion](account-deletion.md)), so a task added to a
  seeded list, a note or a cost added later, or a baby's lazily created lists go
  with the household, because deleting only the recorded rows would leave them
  unreachable rather than intact.
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
- Running `seedTastingCatalog` twice changes nothing the second time, and it
  never changes a Group's tasting subjects.
- Running `seedRetailerCatalog` twice inserts and retires nothing the second
  time, and it never changes a Group's Loyalty cards.
- The Sample household is *not* idempotent: every run wipes it and builds a
  new one dated from that run. A reset leaves no unreachable rows, and content
  the Sample Group only referenced survives: a real person's recipe is
  un-shared, not deleted, and their previous default Group is restored.
