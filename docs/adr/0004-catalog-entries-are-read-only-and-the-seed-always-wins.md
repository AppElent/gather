# Catalog entries are read-only, and the seed always wins

Status: accepted (2026-08-02)

The **Catalog** — reference data owned by nobody, today just the food database
— ships with the app and is present in every environment, production included.
A Catalog entry is **read-only**: nobody may edit one, and a re-seed overwrites
it unconditionally. A person who needs a different version creates their own
food, which is not Catalog and which the seed never touches.

The two kinds of row live in one `foods` table and are told apart by `seedKey`:
present on Catalog entries, absent on everything a person created. Catalog
entries also carry no `createdBy`, because they have no author — which is what
"owned by nobody" means in [ADR 0003](./0003-three-scopes-personal-group-and-personal-records.md)
and now what the schema says.

## Why the seed wins

A shipped Catalog is app data, not user content. Its figures get corrected
between releases — a wrong calorie value, a renamed item — and those
corrections have to reach every environment. Anything that lets a row opt out
of them leaves a database where some entries are silently frozen at whatever
they were when someone touched them.

## Why read-only follows from that

We first tried to preserve local edits, reusing the `localEdited` flag that
`foods.upsertFromOff` already uses to stop an Open Food Facts rescan clobbering
what a human typed. It is the same shape of problem — an external source of
truth meeting a row that has since been changed — and reusing it would have
cost nothing.

It fails for two reasons that the Open Food Facts case does not have. First,
`foods.update` has no ownership check, so one person's edit to a Catalog row
changes it for everybody and freezes it against future corrections for
everybody. Second, once the seed wins, an editable Catalog row is a trap: the
edit form accepts the change, saves it, and the next deploy silently reverts
it. Refusing the edit is a worse experience than allowing it only if the edit
would have survived — and it would not.

We also rejected fork-on-edit, where editing a Catalog entry copies it into a
personal row. It is the better end state, but it needs a decision about what
happens to the `recipes` and `consumptionEntries` already pointing at the
original `foodId`, and that is its own piece of work rather than a detail of
seeding.

## Consequences

`foods.update` refuses any row with a `seedKey`, and the UI hides the edit
affordance rather than offering one that fails. The refusal lives in the
mutation, not only in the route, because the route is reachable by URL.

Retiring a fixture deletes its row. That can leave a
`consumptionEntries.foodId` dangling, which ADR 0003 already permits —
provenance is permission-checked on read and the entry snapshots its own
nutrition, so a diary entry stays correct and readable regardless.

The Catalog seed runs as an explicit step in `deploy:dev` / `deploy:prod`.
Convex runs `--preview-run` only on preview deployments, so production has no
post-deploy hook and the deploy script is the only deterministic place to put
it. The seed is therefore not atomic with the deploy: a failed seed leaves new
code running against un-reconciled data.

The **Sample household** — fake content for dev and preview environments — is
deliberately *not* the same mechanism, despite superficially being "seeding"
too. It never runs in production, it wipes and recreates rather than upserting
(so its dates stay anchored to now), and it is tracked per-run in `seedRuns`
rather than keyed per-row. One registry serving both would have been a false
abstraction over two opposite sets of rules, so they are two plain functions in
`convex/seed.ts`.
