# 0006 — A food's servings become a list

Replaces a food's single optional serving (`servingSize` + `servingLabel`) with
an ordered list of named servings. Refs #68 (expand) and #71 (contract).

```
servings: Array<{ label: string; amount: number }>   // amount in the food's base unit
```

## The thing that makes this awkward

#68 and #71 are the expand and contract halves of one migration, and they
**ship together in PR #72** — one branch, one deploy. That is not how
expand–contract is supposed to go, and it costs something specific:

Convex validates the schema against existing documents when a deploy pushes it,
so a `foods` row still carrying `servingSize` **rejects the push**. The usual
answer is to run a backfill first — but `maintenance:backfillFoodServings`
ships *inside the very push* those rows are blocking. It cannot run before
itself. (`docs/migrations/0001` is what this should have looked like: two
deploys with the backfill in between.)

So the deadlock is broken from outside the code.

| Step | What | Reversible? |
| --- | --- | --- |
| 1 | Clear the `foods` table from the Convex dashboard | **no** — see what goes, below |
| 2 | Deploy | **no** — `servingSize` and `servingLabel` leave the schema |
| 3 | The Catalog seed inside the deploy script repopulates all 31 fixtures | yes — re-seeding is idempotent |

## 1. Clear the `foods` table — before deploying

**From the Convex dashboard**, not from code: that is the whole point. The
dashboard's table controls need nothing deployed, which is the one lever
available while the push is blocked.

Do it on each deployment being upgraded, immediately before its deploy.

**What this destroys, and why it was judged acceptable** (owner's call, PR #72,
2026-08-07 — "there is no real data on prod"):

- **Catalog foods** — 31 rows, recreated by step 3 within the same command.
  Nothing is lost.
- **Foods a person created or imported from Open Food Facts** — gone for good.
  This is the loss. It is only acceptable because there are none worth keeping.
- **Diary entries are not touched.** They keep their nutrition snapshot and
  their `foodId` simply dangles, which ADR-0003 permits explicitly and ADR-0004
  already accepts whenever a retired fixture's row is deleted. The one visible
  consequence: editing such an entry's quantity scales its snapshot instead of
  recomputing from the food, which is the documented fallback in
  `consumption.update`.
- **Stored food images become orphans.** Clearing a table from the dashboard
  does not run the mutation that deletes them (`lib/storedFiles.ts`), so any
  blob an imported food held stays in storage with nothing pointing at it.
  Small, and the same shape as the gap #41 already tracks.

- [ ] dev — cleared on:
- [ ] prod — cleared on:

## 2. Deploy

```sh
pnpm run deploy:dev    # dev
pnpm run deploy:prod   # prod
```

What #71 removes: both fields from the schema, `authoredServings`' legacy
branch, the serving pair from `OffMappedFood`, the Catalog fixtures' old fields,
and the food form's two inputs — replaced by a list editor over the same data.
`'piece'` quantities now count the food's **first named serving**, which is
exactly what `servingSize` was, so no logged entry changes value.

- [ ] dev — deployed on:
- [ ] prod — deployed on:

## 3. The Catalog comes back by itself

`deploy:dev` and `deploy:prod` both run `convex run seed:seedCatalog` between
the Convex deploy and the build, so the 31 fixtures are rewritten with their
authored serving lists as part of the same command. Nothing to do.

Where servings come from afterwards, in order of specificity:

1. **Catalog fixtures** ship hand-authored lists (`convex/lib/seed/catalogFoods.ts`).
2. **Open Food Facts import** contributes the product's declared serving as one
   entry, on every import from #68 onwards.
3. **The person's own history** — `consumption.loggedAmountsForFood`, ranked by
   frequency — covers everything else, including Catalog foods nobody may edit
   and foods whose authored list is empty.

## What happens to `backfillFoodServings`

`maintenance:backfillFoodServings` carries a row's single serving into the list
and strips the two old fields. It is **not used by the route above**, and on
this branch it cannot be: it is unrunnable before the deploy that contains it,
and pointless afterwards, because that deploy only succeeded on a table with
nothing left for it to find.

It stays in the tree for exactly one reason: it is the only route for a
deployment whose foods *are* worth keeping, and taking it means splitting this
branch into two deploys — everything up to #68's expand, then the backfill, then
#71. If no such deployment ever appears, **delete it together with this
document** once both sets of boxes above are ticked. That is its end condition.

```sh
# Only meaningful on a deployment where #68 is live and #71 is not.
pnpm exec convex run maintenance:backfillFoodServings                  # dry run
pnpm exec convex run maintenance:backfillFoodServings '{"apply":true}'
```

Reports `{ apply, foods, stripped, converted }`. It `replace`s rather than
patches, because the fields being *gone* from the document is the point, and
re-running is a no-op.
