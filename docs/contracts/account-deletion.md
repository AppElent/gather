---
type: contract
description: Read when changing Group deletion, account deletion, or any table a Group owns.
version: 1.0.0
status: current
---

# Group and account deletion

A Group is emptied completely when it is deleted, and an account is deleted in
the app ([ADR-0032](../adr/0032-an-account-is-deleted-in-the-app-and-takes-its-solo-groups-with-it.md),
[ADR-0030](../adr/0030-groups-are-the-only-user-owned-scope.md)).

## Behavior

- **`convex/lib/groupCascade.ts` cannot be forgotten.** `GROUP_CONTENT` is keyed
  by every schema table with a `groupId`, derived from the data model, so a new
  table fails `pnpm typecheck` until somebody says how its rows are reached.
  `groups.deleteGroup` and account deletion both run it.
- `tasks`, `calendarEvents` and `babyEvents` hang off a parent rather than a
  Group, so each is deleted inside its parent's entry. `comboItems` belong to a
  person's combo and go with the account purge.
- Storage ids come back from the cascade and are deleted by scheduled work, so
  a large Group survives the one-transaction limit ([stored files](stored-files.md)).
- **Account deletion is Convex first, Clerk second**, in scheduled steps, one
  Group per step (`convex/accounts.ts`, `convex/cascade.ts`).
- **A solo Group dies with the person; a shared Group they only leave.** What
  they added to a household stays with the household.
- **`users.deletedAt` stops `ensureUser` re-provisioning the account mid-purge**;
  the `users` row is deleted last for that reason.
- **`deleteSelfEnabled` is checked before anything is called.** Purging a
  household for an account Clerk then refuses to delete is the worst outcome
  available, so the button is withheld rather than allowed to fail. The flag is
  the Clerk Dashboard setting "Delete self"; the app cannot turn it on.

## Acceptance

- Deleting a Group leaves no row with its `groupId` and no blob only it held.
- Deleting an account removes its solo Groups, leaves shared Groups intact
  without the person, and finally removes the Clerk user.
