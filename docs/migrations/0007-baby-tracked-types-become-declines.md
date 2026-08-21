# 0007 — A Child's tracked types become declines

**Status:** run on dev; production outstanding
**Code:** `convex/migrations.ts` → `declineByOmission`, plus the
`babies.trackedTypes` column in `convex/schema.ts`

## Why

`babies.trackedTypes` held the event types a household had said **yes** to
(ADR-0022). That reads naturally and is wrong in one specific way: a type added
to the catalogue after somebody made their choice is simply missing from their
list, and a list of acceptances cannot tell *"they turned this off"* apart from
*"this did not exist when they were asked"*.

Memory made it concrete. It shipped, and every existing Child on the deployment
went on not offering it. The field now holds the **refusals**: anything nobody
has said no to is offered, and a new type arrives switched on.

## What it does

For every `babies` row that has a `trackedTypes` and no `untrackedTypes`:

    untrackedTypes = OFFERED_BEFORE_MEMORY - trackedTypes
    trackedTypes   = undefined

`OFFERED_BEFORE_MEMORY` is the eight-type catalogue as it stood *when those
choices were made*, frozen inside the migration rather than read from
`BABY_EVENT_TYPES`. A row with no `trackedTypes`, or one already holding
`untrackedTypes`, is left alone, so rerunning is safe.

## Running it

```bash
npx convex run migrations:declineByOmission          # dev
npx convex run migrations:declineByOmission --prod   # production
```

It returns `{ total, migrated, skipped }`. Preview deployments seed their own
household and do not need it.

## Retiring it

When the table below records a successful production run, delete
`declineByOmission`, `OFFERED_BEFORE_MEMORY`, the `trackedTypes` schema column,
and their tests. Archive this record with the result and removal commit.

| Deployment | Run on | Result |
| ---------- | ------ | ------ |
| dev | 2026-08-21 | `{ total: 2, migrated: 2, skipped: 0 }` |
| production | | |
