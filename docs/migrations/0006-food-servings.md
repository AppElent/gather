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
| 3 | `backfillFoodServings --apply` | yes — it only moves a value the row already held |
| 4 | Deploy #71 | **no** — `servingSize` and `servingLabel` are dropped from the schema |

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
either shape and produces the new one. **That shim is deleted by #71** — step 3
is what makes deleting it safe.

## 3. Carry the old field across — **before** deploying #71

**Run this before the contract deploy, not after.** Convex rejects a document
carrying a field the schema does not describe, so a row still holding
`servingSize` fails the deploy that removes it. The backfill is a prerequisite
of that deploy, not tidying-up behind it.

```sh
pnpm exec convex run maintenance:backfillFoodServings            # dev, dry run
pnpm exec convex run maintenance:backfillFoodServings '{"apply":true}'
pnpm exec convex run maintenance:backfillFoodServings --prod     # prod, dry run
pnpm exec convex run maintenance:backfillFoodServings '{"apply":true}' --prod
```

Reports `{ apply, foods, stripped, converted }` — how many rows still carry
either old field, and how many of those gain a servings entry from it (a row
that already has a list keeps it; the list always won over the pair). It
`replace`s rather than patches, because the fields being *gone* from the
document is the point. Re-running is a no-op.

- [ ] dev — run on:
- [ ] prod — run on:

## 4. Deploy the contract half

```sh
pnpm run deploy:dev    # dev
pnpm run deploy:prod   # prod
```

What #71 removes: both fields from the schema, `authoredServings`' legacy
branch, the serving pair from `OffMappedFood`, the Catalog fixtures' old
fields, and the food form's two inputs — replaced by a list editor over the
same data. `'piece'` quantities now count the food's **first named serving**,
which is exactly what `servingSize` was, so no logged entry changes value.

Once both boxes above are ticked, `maintenance:backfillFoodServings` is itself
one-shot code with nothing left to find, and is deleted along with this
document's reason for existing.

- [ ] dev — deployed on:
- [ ] prod — deployed on:
