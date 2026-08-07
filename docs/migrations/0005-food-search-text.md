# 0005 — Foods get one searchable text

Gives `foods` a `searchText` field holding its name and brand as one string,
and points the search index at that instead of at `name`. Refs #67.

**Why it is a migration at all.** A Convex search index has exactly one
full-text field, so "match the name or the brand" cannot be a query — it has to
be data. Every write path fills the field in from this commit onward
(`convex/lib/foodSearchText.ts`, used by `foods.create`, `foods.update`,
`foods.upsertFromOff`, `foods.applyOffRefresh` and the Catalog and Sample
seeds), but rows written before it have no value, and a row with no value
matches nothing. **Until the backfill runs, food search returns nothing for
foods that already existed** — this is not tidying-up that can wait.

| Step | What | Reversible? |
| --- | --- | --- |
| 1 | Deploy | yes — the field is optional and the old index is unused |
| 2 | `backfillFoodSearchText` dry run | writes nothing |
| 3 | `backfillFoodSearchText --apply` | yes — re-derivable from name and brand at any time |

## 1. Deploy

```sh
pnpm run deploy:dev    # dev
pnpm run deploy:prod   # prod
```

`searchText` is `v.optional(v.string())`, so every existing row validates and
the deploy cannot be rejected by this change. The Catalog seed that runs inside
the deploy script rewrites every Catalog row, so Catalog foods come out of step
1 already searchable; what is left for step 3 is the rows people created and
the ones imported from Open Food Facts.

## 2. Look before writing

```sh
pnpm exec convex run maintenance:backfillFoodSearchText            # dev
pnpm exec convex run maintenance:backfillFoodSearchText --prod     # prod
```

Reports `{ apply: false, foods, updated }` — how many rows it would write.
`updated` counts rows whose stored value differs from the one their name and
brand produce, so a row that is already correct is never touched.

## 3. Apply

```sh
pnpm exec convex run maintenance:backfillFoodSearchText '{"apply":true}'
pnpm exec convex run maintenance:backfillFoodSearchText '{"apply":true}' --prod
```

Re-running is a no-op. Nothing is deleted and nothing is derived from anything
but the row's own `name` and `brand`, so a bad run is fixed by running it
again rather than by restoring anything.

## What retires the one-shot code

`backfillFoodSearchText` is one-shot code and says so in its own docstring. It
is deleted, and `foods.searchText` becomes a required `v.string()`, once this
document records the apply step as done on both deployments:

- [ ] dev — run on:
- [ ] prod — run on:

Until both boxes are ticked the mutation stays, because a deployment that has
not had it still has foods nobody can find.
