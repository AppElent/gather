# 0001 — A Child's tracked types become declines

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
went on not offering it — the answer to "why can't I see the thing you just
shipped" was "go and find it in settings", forever, for every event type we
ever add. So the field now holds the **refusals**: anything nobody has said no
to is offered, and a new type arrives switched on.

## What it does

For every `babies` row that has a `trackedTypes` and no `untrackedTypes`:

    untrackedTypes = OFFERED_BEFORE_MEMORY - trackedTypes
    trackedTypes   = undefined

`OFFERED_BEFORE_MEMORY` is the eight-type catalogue as it stood *when those
choices were made*, and it is frozen inside the migration rather than read from
`BABY_EVENT_TYPES`. Subtracting from today's catalogue would record Memory as
refused by everybody — the exact bug this is fixing.

A row with no `trackedTypes` never made a choice and is left alone: absent still
means "everything is offered". A row that already has `untrackedTypes` is left
alone too, so running it twice is safe.

## Running it

```bash
npx convex run migrations:declineByOmission          # dev
npx convex run migrations:declineByOmission --prod   # production
```

It returns `{ total, migrated, skipped }`. Preview deployments seed their own
household from `convex/lib/seed/` and never hold pre-migration rows, so they do
not need it.

## Retiring it

When the table below says every deployment has run it, delete
`convex/migrations.ts`'s `declineByOmission` and `OFFERED_BEFORE_MEMORY`, and
delete the `trackedTypes` column from `convex/schema.ts`. Nothing reads that
column but this migration.

| Deployment | Run on | Result |
| ---------- | ------ | ------ |
| dev        | 2026-08-21 | `{ total: 2, migrated: 2, skipped: 0 }` |
| production |        |        |
