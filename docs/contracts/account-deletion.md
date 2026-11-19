---
type: contract
description: Read when changing Group deletion, account deletion, or any table a Group owns.
version: 2.1.0
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
- **One function destroys a Group.** `destroyGroup` runs the registry, deletes
  the Group with its own image and schedules the release of the files. Deleting
  a Group, deleting an account and resetting the Sample household all go through
  it.
- `tasks`, `calendarEvents` and `babyEvents` hang off a parent rather than a
  Group, so each is deleted inside its parent's entry.
- A table of a person's own rows (`userId`, no `groupId`: `aiUsage`,
  `idempotencyKeys`, `pushDevices`, `scheduledNotifications`) is not in the
  cascade; `cascade.finishAccount` deletes it by index, so a new one is added
  there by hand. Queued push notifications have their scheduled jobs
  cancelled with them (`deletePushData` in `convex/lib/notifications.ts`). [Data export](data-export.md)
  reads the same tables, and its registry fails `pnpm typecheck` for a new one.
- The shared grocery aisle cache (`groceryCategoryCache`) and its global
  daily counter (`groceryAiUsage`) carry no Group or person id, so neither a
  Group's nor an account's deletion touches them. While a question is out the
  cache row lists the waiting items' task ids (`waitingTaskIds`); a deleted
  Group's ids stay there, pointing at nothing, until the answer or the
  give-up clears the list. The per-Group daily counter
  (`groceryAiGroupUsage`) is Group content and goes with the Group. The cache does keep the normalised item name a Member
  typed (for an unknown item that was sent to the model, or that three Groups
  put in the same aisle), with nothing to say who typed it, so deletion cannot
  find it. A daily prune bounds it instead
  ([ADR-0049](../adr/0049-the-shared-aisle-cache-keeps-only-what-groups-still-back.md)):
  a model answer goes after 30 days, and a consensus within a day of its
  Groups no longer backing it. The function logs carry the aisle, not the
  name.
  Names that look like more than a product (an email address, a URL, a run of
  four or more digits, more than six words) are never sent or cached. A
  Group's aisle corrections (`groceryCategoryOverrides`) are in the cascade
  with its other content.
- Storage ids are collected by the cascade and deleted by scheduled work, so a
  large Group survives the one-transaction limit ([stored files](stored-files.md)).
- **Account deletion is Convex first, Clerk second**, in scheduled steps, one
  Group per step (`convex/accounts.ts`, `convex/cascade.ts`).
- **A solo Group dies with the person; a shared Group they only leave.** What
  they added to a household stays with the household. `detachFromGroup` takes
  them out of it the same way whether they left or deleted their account: a cost
  split naming them is cleared, and a saved split scenario keeps their name
  without their id.
- **`users.deletedAt` stops `ensureUser` re-provisioning the account mid-purge**;
  the `users` row is deleted last for that reason.
- **`deleteSelfEnabled` is checked before anything is called.** Purging a
  household for an account Clerk then refuses to delete is the worst outcome
  available, so the button is withheld rather than allowed to fail. The flag is
  the Clerk Dashboard setting "Delete self"; the app cannot turn it on.
- **On the phone, a Clerk refusal outlives the purge.** The purge empties the
  Group list, and `GroupProvider` then unmounts everything Group-scoped,
  including the delete screen. So the run lives in `AccountDeleteProvider`,
  above the session and Group gates, and once the purge has started it draws
  the deletion in place of the signed-in tree: a refusal there offers Try
  again (Clerk only) and Sign out (`apps/mobile/src/features/account/delete/`).
  The refusal is held in memory, so it lasts while the app is open and signed
  in.
- **On the web, the same run and the same order**, from the Account page's
  Danger zone (`src/components/account/`). `AccountDeleteProvider` sits in
  `routes/_app.tsx` above the signed-in gate, so `ensureUser` is unmounted
  once the purge starts. The `deleteSelfEnabled` gate is the phone's
  (`@gather/core/account-deletion`). The confirmation names the account and
  asks for a typed word.
- **The web confirms a recent sign-in before anything is deleted.** Clerk
  deletes a login only within ten minutes of the strongest sign-in factor; a
  browser tab is often older, and finding out after the purge would strand
  the account. The web asks with Clerk's verify dialog when the sign-in is
  older than five minutes, and closing it deletes nothing.
- **Another signed-in tab or device can bring the account back.** It still
  runs `ensureUser`; once the purge has deleted the `users` row, a reload
  there while the login is stranded provisions a new, empty account.
- **Only the iOS app revokes Sign in with Apple** (APP-213). Android and the
  web delete an Apple-linked account without revoking the grant.

## Acceptance

- Deleting a Group leaves no row with its `groupId` and no blob only it held.
- Deleting an account removes its solo Groups, leaves shared Groups intact
  without the person, and finally removes the Clerk user.
- On the phone and the web, a Clerk refusal after the purge has started stays
  on screen, with Try again and Sign out, until one of them succeeds.
- On the web, nothing is deleted until Clerk has confirmed a recent sign-in.
