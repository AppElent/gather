# 0006 — A food's servings become a list

Replaces a food's single optional serving (`servingSize` + `servingLabel`) with
an ordered list of named servings. Refs #68 (expand) and #71 (contract).

```
servings: Array<{ label: string; amount: number }>   // amount in the food's base unit
```

**This document covers both halves.** #68 adds the list beside the old fields
and removes nothing; #71 removes the old fields and the shim that reads them.
The two ship separately on purpose: every reader has to have moved before
anything is taken away.

| Step | What | Reversible? |
| --- | --- | --- |
| 1 | Deploy #68 | yes — `servings` is optional and nothing is removed |
| 2 | Catalog seed (runs inside the deploy) | yes — re-seeding restores whatever the fixtures say |
| 3 | Deploy #71 | **no** — `servingSize` and `servingLabel` are dropped from the schema |

## 1. Deploy the expand half

```sh
pnpm run deploy:dev    # dev
pnpm run deploy:prod   # prod
```

`foods.servings` is `v.optional(...)`, so every existing row validates and the
deploy cannot be rejected by this change. The Catalog seed that runs inside the
deploy script rewrites every Catalog row, so all 31 fixtures come out of step 1
with authored serving lists.

**There is no backfill, and none is needed.** Three sources fill the list, and
between them they cover every row:

1. **Catalog fixtures** ship hand-authored lists (`convex/lib/seed/catalogFoods.ts`).
2. **Open Food Facts import** contributes the product's declared serving as one
   entry, on every import from #68 onwards.
3. **The person's own history** — `consumption.loggedAmountsForFood`, ranked by
   frequency — covers everything else, including Catalog foods nobody may edit
   and foods whose authored list is empty.

A row written before #68 that has a `servingSize` keeps working through the
compatibility shim, `authoredServings` in `convex/lib/servings.ts`, which reads
either shape and produces the new one.

## What retires the shim

`authoredServings`' legacy branch, `foods.servingSize` and `foods.servingLabel`
go together in **#71**, once all of the following are true:

- [ ] #68 is deployed to dev and prod, so every writer produces `servings`
- [ ] No client reads `servingSize` or `servingLabel` — grep is the check; the
      last readers were the add sheet's amount control and `foods.upsertFromOff`
- [ ] Any Open Food Facts row still carrying only `servingSize` has either been
      re-imported or is accepted as losing its one serving suggestion, which
      the person's own logged amounts then replace

The third is a judgement rather than a migration: a serving suggestion is not
data anybody typed, it is a hint, and re-deriving it costs one import. If that
is ever judged too lossy, the alternative is a `backfillFoodServings` mutation
running `authoredServings` over every row and writing the result — one-shot
code with the same end condition as this document, not a schema decision.

## 3. Deploy the contract half

Ticked when #71 ships:

- [ ] dev — run on:
- [ ] prod — run on:
