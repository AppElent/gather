# An account is deleted in the app, and takes its solo Groups with it

Status: decided (2026-09-01)

## Context

`apps/mobile` creates Clerk accounts (`app/(auth)/sign-up.tsx`) and offered no
way to delete one. App Store Review Guideline **5.1.1(v)** requires an app that
supports account creation to let a person start account deletion from inside
it; pointing at the web is the specific pattern Apple rejects.

Nothing in `convex/` could delete a user, and nothing could empty a Group
either: `groups.deleteGroup` deleted the membership and the Group row and left
every recipe, task list, baby, calendar, house, holding and tasting subject in
it unreachable, with their `_storage` blobs leaked.

## Decision

**A Group you are the only member of is deleted with you, and everything in it
goes. A Group with other members you simply leave.**

Every user-owned record belongs to exactly one Group
([ADR-0030](0030-groups-are-the-only-user-owned-scope.md)), so this is the whole
of "and all my data". What you added to a household you shared stays with the
household, which is what `leaveGroup` already promises. The alternative — hard
deleting everything a departing person authored — lets one member take a shared
history down on their way out, and no confirmation dialog makes that acceptable.

**Convex is purged first, Clerk second.** The purge needs an authenticated
caller and there is no authenticated caller once the Clerk user is gone, so the
order cannot be reversed. What that opens is a window in which `ensureUser` —
which runs on every app mount and is the only inserter into `users` — would hand
the person a brand new account and Personal Group. `users.deletedAt` is set in
the first transaction and closes it: `ensureUser` throws `Account deleted` while
it is set, and the `users` row is deleted **last**, after the Groups.

The client checks `UserResource.deleteSelfEnabled` **before** calling anything.
Purging a household for an account Clerk then refuses to delete is the worst
outcome available, so that button is not offered rather than allowed to fail.
This requires "Delete self" to be enabled on the Clerk instance.

**The cascade runs in scheduled steps**, one Group per invocation
(`convex/cascade.ts`), because a Convex mutation is one bounded transaction and
a household has no guaranteed size. Stored files are released in batches behind
it — `deleteStoredFile` costs five table scans per blob, so they cannot go
inline.

**`convex/lib/groupCascade.ts` is a registry that cannot be forgotten.** Its
table set is derived from the data model — every table with a `groupId` — so a
new Module's table fails to compile until somebody says how its rows are
reached. Same trick, for the same reason, as `FILE_HOLDERS` in
`convex/lib/storedFiles.ts`. `groups.deleteGroup` is retrofitted onto it, which
fixes the standing leak.

### What survives, and why

- **Attribution ids are left dangling.** `createdBy`, `createdByUserId`,
  `loggedBy`, `connectedBy`, `updatedByUserId`, `takenByUserId` never conferred
  ownership or access (`convex/lib/groupAccess.ts`), and the readers already
  tolerate a missing user. A dangling id costs nothing; repointing them at a
  tombstone would be a schema change earning nothing.
- **A cost split that named them is cleared, not rebalanced.**
  `recurringCosts.validateSplit` refuses a split that does not add to a hundred
  or that names a non-member, so a split with one party removed is one the
  household could never save again. It goes back to undivided until somebody
  says how it should be.
- **A saved split scenario keeps the name and loses the id.** It is immutable by
  design and already stores each party's name beside their id precisely so it
  reads correctly after somebody leaves.
- **`foods` rows are untouched.** User-created foods are a *global* table with
  no `groupId`, no delete mutation anywhere, and other people's
  `consumptionEntries` and `comboItems` reference them. Deleting them breaks
  other people's diaries, and blanking `createdBy` silently freezes the row —
  `foods.update` compares ids and would then refuse for everyone. A food
  somebody typed is reference data, not personal data.

## Consequences

Deletion is reachable at Settings → Account → Delete account, on a screen that
names the Groups that go and the Groups that stay **before** the confirmation.
That is the one destructive action in Gather that gets a screen rather than an
alert: an alert is a sentence, and "everything in them" means nothing until you
can see which households it means.

`groups.deleteGroup` now cascades, so Groups deleted through the UI stop
leaving orphans. Two things are knowingly left for later: `leaveGroup` does not
clear a cost split that named the leaver — the same latent problem, on a path
this change did not touch — and the sample-household reset
(`convex/lib/seed/apply.ts`) still misses the Finances tables and `notes` and
leaks the blobs it orphans. `deleteGroupContent` is the fix for both.

One failure is left reachable and is reported honestly rather than designed
away: the Convex purge succeeding and Clerk's own delete then failing. The
household is gone, the login is not, and signing in again builds a fresh empty
account. The screen says that, instead of repeating the "nothing has been
removed" message that is true only when the first step refused.

There is no Clerk webhook. Deleting an account from the Clerk dashboard leaves
its Convex rows behind, which is the same state the app has always been in, and
the shared Clerk instance makes a `user.deleted` handler a filtering problem
rather than a wiring one. If it lands, `cascade.purgeAccount` is what it calls.
