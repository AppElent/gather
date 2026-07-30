# 0002 — Recipes become Group-owned

Moves `recipes` from `ownerId` + `sharedGroupIds` to a required `groupId`,
`sharedGroupIds` and `createdByUserId`, and clears the provenance references the
change leaves dangling on `consumptionEntries`. Refs #19.

**This destroys every recipe, on every deployment it is run against, and that is
intended.** Recipe data is disposable — it is a household's own typing and its
imports, all of it re-creatable — and destroying it is what buys the required
ownership fields. #10 tried the other way: it kept both models alive, which
forced nearly every ownership field to become optional, and a schema full of
optional ownership fields is a schema that has stopped saying who owns anything.
There is no shape a pre-#19 row can be migrated into, because a row owned by a
person does not say which Group it belongs to and nothing can work that out for
it.

Diary entries are **not** disposable and are not wiped. Every one of them keeps
its `label`, `quantity`, `quantityUnit` and recorded `nutrition` — those are a
snapshot, and a snapshot does not change because the thing it was taken from is
gone (ADR-0003). Only the `recipeId` reference is cleared, and that reference
was already permission-checked on read and already allowed to dangle.

This is **not** expand–contract. There is nothing to expand into: the wipe empties
the table, and an empty table validates against any schema.

| Step | What | Reversible? |
| --- | --- | --- |
| 1 | Empty the `recipes` table | no — recipe data is destroyed |
| 2 | Deploy | no |
| 3 | Run the wipe dry, read the summary | nothing written |
| 4 | Run the wipe with `apply: true` | no |
| 5 | Verify | — |

## 1. Empty the `recipes` table

Convex validates existing documents against the schema a deploy pushes, so the
deploy in step 2 is rejected outright while a single row still carries `ownerId`
and no `groupId`. The rows have to go first, and the mutation that removes them
ships *with* the deploy that needs them gone — so this step is done from
outside the app.

From the Convex dashboard: **Data → `recipes` → ⋯ → Clear table**, on dev and on
prod. Or, from the CLI:

```sh
# dev
: > empty.jsonl
pnpm exec convex import --replace --table recipes empty.jsonl

# prod
pnpm exec convex import --prod --replace --table recipes empty.jsonl
```

`consumptionEntries` is left alone here. Its `recipeId` values now point at
recipes that no longer exist, which is a state the schema permits — a Convex id
is not checked against the row it names — and which step 4 tidies up.

## 2. Deploy

```sh
pnpm run deploy:dev    # dev
pnpm run deploy:prod   # prod
```

With the table empty there is nothing left to validate, so the required
`groupId` / `createdByUserId` land without complaint. If this deploy is rejected
with a schema validation error, a row survived step 1 — go back to it.

## 3. Dry run

The wipe is dry by default — it reports what it would do and writes nothing.

```sh
# dev
pnpm exec convex run maintenance:wipeRecipes '{}'

# prod
pnpm exec convex run --prod maintenance:wipeRecipes '{}'
```

It prints:

```jsonc
{
  "apply": false,
  "recipesDeleted": 0,   // recipes rows still present — 0 after step 1
  "entriesUnlinked": 7   // diary entries still pointing at a recipe
}
```

Sanity-check before applying:

- `recipesDeleted` is `0`. Anything else means step 1 did not finish, and step 2
  should not have succeeded.
- `entriesUnlinked` is at most the number of diary entries logged from a recipe.
  It is the count of references about to be cleared, not of entries about to
  change in any other way — nothing else on an entry is touched.

## 4. Apply

```sh
# dev
pnpm exec convex run maintenance:wipeRecipes '{"apply":true}'

# prod
pnpm exec convex run --prod maintenance:wipeRecipes '{"apply":true}'
```

## 5. Verify

Re-run the dry version from step 3. Both counts must now be `0` — the wipe is
idempotent, and a second pass finding work left to do means the first did not
finish.

Then spot-check in the Convex data browser:

- `recipes` is empty;
- no `consumptionEntries` row still has a `recipeId`;
- diary entries still show their `label`, `quantity`, `quantityUnit` and
  `nutrition`, unchanged. This is the one thing here that cannot be re-created,
  so check it rather than assuming it.

Finally, open the app: `/g/<slug>/recipes` shows an empty collection with its
"Add your first recipe" card, and the diary for a day that had recipe entries
still lists them with their numbers and without a "View recipe" link.

## Notes

- After this, everyone in a Group sees the same recipes and the person who added
  one is shown as attribution only. Someone who leaves a Group loses the recipes
  they added to it, exactly as they lose everything else in it — that is the
  point, not a regression.
- New recipes land in the Group named by the route: `/g/<slug>/recipes/new` uses
  that Group, and the flat `/recipes/new` uses the caller's Personal group and
  says so on the page. `recipes.create` is given the slug and authorises it; it
  never falls back to `defaultGroupId`.
- Sharing a recipe into a further Group and moving one between Groups are #25.
  Until then `sharedGroupIds` is always empty on a newly created recipe, and the
  visibility rule that reads it is already in place.
