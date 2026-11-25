---
type: contract
description: Read when changing what a paired Apple Watch may call, its key, or the /watch/v1 routes.
version: 1.0.0
status: current
---

# Watch API

A paired Apple Watch calls `/watch/v1/*` on the Convex deployment's
`.convex.site` origin by itself, with a key the phone gave it. The key stands
for one Member in one Group (APP-653).

## Behavior

- **Pairing.** `watch.pair` returns `{ deviceId, key, siteUrl }`. The key is
  `gw_` and 64 hex digits (256 random bits), returned once; `watchDevices`
  keeps its SHA-256. Pairing the same `installId` again replaces that person's
  key. A person has at most ten watches: the least recently seen goes first.
- **What ends a key.** `watch.revoke`; the end of the Clerk session that paired
  it (`watch.forgetSession` on sign-out, Clerk's `session.ended`,
  `session.removed` and `session.revoked` events, and
  `notifications.forgetEndedSessions`); a session that expires counts as ended;
  leaving or being removed from the
  Group; deleting the Group or the account ([account deletion](account-deletion.md)).
- **Every call checks again.** The key, the person, the Group and the
  Membership are resolved in the transaction that reads or writes
  (`convex/lib/watchAccess.ts`), never cached.
- **Connected apps cannot pair**, list or revoke watches.
- **Nothing else is reachable.** Reads and writes name no Group and no person;
  a task of another Group and one that does not exist are one answer
  ([ownership and access](ownership-and-access.md)).

## Routes

Send `Authorization: Bearer <key>`. Answers are JSON, `cache-control: no-store`,
and carry `version`.

| Route | Answers |
| --- | --- |
| `GET /watch/v1/modules` | The Group's name and, for `groceries`, `today` and `cards`, the version and counts. The Member's own Module order is kept on the phone, so this order is Gather's |
| `GET /watch/v1/groceries` | The watch's grocery list by aisle, and what is in the basket. The watch's own list when it has one, else the Group's; `list: null` when Gather keeps none itself |
| `GET /watch/v1/today` | The Group's day: events (the Member's calendar filters apply), due and overdue tasks, meals, tomorrow's first event |
| `GET /watch/v1/cards` | The Group's own loyalty cards, each with `barcode` |
| `POST /watch/v1/changes` | `{ changes: [...] }`, 1 to 50, at most 64 KB. `{ results: [...] }` in the same order |

`barcode` is linear `{ sbs, bhs, bbs, quietLeft, quietRight }`, a matrix
`{ size, pixs, quiet }` (`size` is the width in modules), or `null` when the
number does not encode, and then the watch shows the number. `sbs` starts
with a bar and may end with a space (Code 39, Codabar, ITF); `bhs` is
relative, all bars being equally tall, so the watch chooses the height. EAN and
UPC guard bars are flat. PDF417 rows are repeated so every module is square.

A change is one of these, with the watch's own `key` (8 to 64 characters):

| `kind` | Fields |
| --- | --- |
| `grocery.add` | `text`, read by the same recognition the apps use |
| `grocery.check`, `grocery.uncheck` | `taskId` |
| `task.done` | `taskId`, and `occurrence` (the due date shown) for a repeating task |

- **Each change is its own transaction**, so a refused one never holds up the
  rest. A result is `{ key, ok: true, taskId }` or
  `{ key, ok: false, kind: 'watch:…' }`. Only `watch:failed` is worth sending
  again; every other kind is final.
- **A key counts once** per person and kind, whichever watch or pairing sends
  it. A repeat answers what the first did and changes nothing, even when the
  row has been changed or deleted since, so the watch makes a fresh UUID for
  every change: a `grocery.add` with a used key and other text adds nothing.
  A refused change leaves no receipt.

## Refusals

| Status | `kind` |
| --- | --- |
| 401 | `groups:not-signed-in`: no key, a malformed one, an unknown or revoked one, an account being deleted |
| 403 | `groups:not-a-member` |
| 429 | `watch:rate-limited`, with `Retry-After` in seconds |
| 400, 413 | `watch:bad-request` |

Limits per watch: 60 requests a minute (burst 120) and 120 changes a minute
(burst 300). Pairing: 20 an hour per person (`convex/lib/watchRateLimits.ts`).
A caller without a valid key is not counted: it costs one indexed read.

## Acceptance

- The raw key is in no table, log or later answer.
- A revoked key and an ended Membership refuse the very next call, reads and
  writes alike.
- The same change sent twice leaves one row.
- Every `BARCODE_FORMATS` entry encodes; `convex/watch.test.ts` covers all of
  this.
