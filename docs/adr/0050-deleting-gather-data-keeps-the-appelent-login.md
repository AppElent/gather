---
type: decision
description: Read before changing account deletion, the users tombstone, or the Clerk webhook.
version: 1.0.0
status: accepted
date: 2026-11-19
---

# Deleting Gather's data keeps the AppElent login

## Context

Gather, Foundry, Fairway and Arcade Club sign in with one Clerk app
(AppElent). [ADR-0032](0032-an-account-is-deleted-in-the-app-and-takes-its-solo-groups-with-it.md)
deleted the account by purging Gather and then calling `user.delete()`, which
also deleted the login the other apps use and left their data orphaned. Eric
decided on 19 November 2026 (APP-392) that every app offers both choices.

## Decision

**Two choices, Gather's data first.** The web Account page and the phone's
Delete account screen offer "Delete Gather data only" and then "Delete my
whole AppElent account". The second names Gather, Foundry, Fairway and Arcade
Club and says the login goes too. Both confirm the same way.

**Gather's data only** runs the same purge (`accounts.deleteAccount` with
`keepLogin`), never calls `user.delete()`, never revokes Sign in with Apple
(the grant is the other apps' too), signs out on this device and says the
login still works elsewhere. It needs no `deleteSelfEnabled`.

**The released subject replaces the tombstone for that choice.** The purge
rewrites the `users` row's `clerkId` to `released:<id>` in its first
transaction, so nothing that resolves the subject finds the row again.
`ensureUser` therefore provisions a fresh, empty account on the next sign-in,
even mid-purge, while the old row is purged by id. The whole-account choice
keeps the subject and `deletedAt` as before, because the same session is about
to ask Clerk to delete the login and must not be handed an account in between.

**Clerk's `user.deleted` webhook purges as the first choice does.**
`POST /clerk/webhook` (`convex/http.ts`) verifies the Svix signature against
`CLERK_WEBHOOK_SECRET` and runs `accounts.purgeDeletedClerkUser` for
`data.id`. A login deleted from any app or from the Clerk dashboard so wipes
Gather. `purgeSubject` is the one purge behind all three paths; it purges every
row of the subject, duplicates included, and a row already being purged is not
purged twice.

## Consequences

- Option 2 reaches production only once all four apps have the webhook and
  production has the secret (APP-392 rollout); until then a login deleted in
  another app leaves Gather's data until somebody deletes it here.
- Unknown and unsigned webhook requests do nothing; a deployment without the
  secret refuses every request (503).
