# 0007 — A connection says which account it is

Gives `integrationConnections` an `externalAccountId` — the account at the
provider that its token speaks for — so that a Group may hold more than one
connection per provider. Refs #104.

**Why it is a migration at all.** Until now a Group had at most one Notion and
one Todoist connection, and `(groupId, provider)` was the identity:
`storeConnection` upserted on it. With several connections per provider that
pair no longer identifies anything, so the identity moves to the account the
provider reports (`getAccountIdentity` on each adapter). Rows written before
this commit have no `externalAccountId` and therefore match nothing.

Nothing breaks in the meantime: an unidentified row is still readable, still
usable by the lists linked to it, and still disconnectable. What it cannot do is
tell itself apart from a second account — so the first re-authorisation in a
Group **adopts** the unidentified row for that provider instead of inserting
beside it (`convex/integrations.ts`, `storeConnection`).

| Step | What | Reversible? |
| --- | --- | --- |
| 1 | Deploy | yes — the field is optional |
| 2 | Anyone reconnects Notion/Todoist, or `backfillConnectionAccounts` | yes — re-derivable from the provider at any time |

## 1. Deploy

```sh
pnpm run deploy:dev    # dev
pnpm run deploy:prod   # prod
```

`externalAccountId` is `v.optional(v.string())` and `accessToken` became
optional in the same change (absent = disconnected), so every existing row
validates and the deploy cannot be rejected by this.

## 2. Fill it in

There is no backfill mutation, deliberately: the value can only be had by asking
the provider with the row's own token, which is an action per row and a provider
request per row for data that fills itself in the first time anybody
reconnects. The adoption rule above is what makes waiting safe.

To check what is left:

```sh
pnpm exec convex data integrationConnections --prod
```

## What retires the one-shot code

The adoption fallback in `storeConnection` —

```ts
rows.find((r) => r.externalAccountId === undefined)
```

— is one-shot code. It is deleted, and `externalAccountId` becomes a required
`v.string()`, once this document records that no row on either deployment is
missing one:

- [ ] dev — checked on:
- [ ] prod — checked on:

Until both boxes are ticked the fallback stays, because a deployment that still
holds an unidentified row would otherwise grow a duplicate connection the next
time somebody reconnects — and both rows would claim the same account.
