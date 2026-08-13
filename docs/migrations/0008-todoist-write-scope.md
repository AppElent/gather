# 0008 — Todoist connections need write scope

Changes the Todoist OAuth scope gather asks for from `data:read` to
`data:read_write`, because Todoist is a writable Backend now. Refs #106.

**Why it is a migration at all.** A scope is fixed at the moment the account is
authorised. Every Todoist connection stored before this change carries a
read-only token, and Todoist will refuse a write through it — not gather.
Nothing gather deploys can widen a token that has already been issued; only the
person who authorised it can, by going through the round trip again.

There is no data change and no backfill. What there is, is a period in which
some connections can write and some cannot, and the behaviour has to be
comprehensible in both.

| Step | What | Reversible? |
| --- | --- | --- |
| 1 | Deploy | yes — the scope is only read when a new connection is made |
| 2 | Each Group reconnects its Todoist accounts, when it wants writes | n/a |

## 1. Deploy

```sh
pnpm run deploy:dev    # dev
pnpm run deploy:prod   # prod
```

Existing connections keep working for reading. A list backed by one of them
refreshes exactly as before.

## 2. What a narrow token does when somebody writes

Todoist answers `403`, which the adapter raises as `ProviderAuthError` and the
Tasks card reports as *"This group's todoist connection expired — reconnect it
in its settings"*. That is the right instruction — reconnecting is exactly what
fixes it — even though the token has not literally expired.

Nothing is corrupted by the attempt: the write never reached Todoist, so
provider-first means the cache was never touched (ADR-0013).

## What retires this document

Nothing in the code is conditional on the old scope, so there is no one-shot
code to delete. This document exists so that a `403` on write against a
long-standing connection is diagnosable, and it can be removed once every
Todoist connection on both deployments has been reauthorised since the deploy:

- [ ] dev — checked on:
- [ ] prod — checked on:
