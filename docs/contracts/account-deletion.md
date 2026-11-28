---
type: contract
description: Read when changing Group deletion, account deletion, or any table a Group owns.
version: 3.5.1
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
- **One function destroys a Group.** `destroyGroup` deletes the Group and runs
  the registry. Deleting a Group, deleting an account and resetting the Sample
  household all go through it.
- **A page per transaction** (APP-842): at most 500 rows or about 2 MiB, over
  all tables together (`convex/lib/purgePage.ts`). The first page goes with the
  Group, any rest right after (`cascade.purgeGroup`), a page per step, paced to
  1 MiB a second. The order is credentials (watches, connections, energy
  sources and price feeds), memberships, queued sends, then content, with a
  parent's children before the parent. Nothing reaches what waits for its step,
  because every read and write resolves its Group or a membership first. A
  recipe Shared into another Group stays readable there until its page goes.
  The last pages may go just after the account's `users` row.
- **Work that outlives its authorisation must recheck its Group** when it
  writes: an action or scheduled run may finish after the deletion.
  `storeConnection` and `takeBudget` refuse a Group that is gone (APP-877).
- **A dropped Todoist or Notion token is revoked at the provider** (APP-909):
  on disconnect, on a reconnect that replaces it, with its Group, and when a
  connect is refused after the provider answered. `revokeAfterCommit` schedules
  `integrations.revokeToken`, so the revoke goes only if the deletion commits.
  It is best effort: a failed revoke is logged without the token and the
  deletion stands. A token another connection still holds (a provider can
  issue the same one twice) is left alone. The token stays in the scheduled
  job's arguments until Convex prunes completed jobs.
- **An Enelogic refresh token is forgotten, not revoked** (APP-497): Enelogic
  documents no revoke endpoint, so disconnecting or deleting the Group drops
  the source's `secret` and Enelogic keeps the grant until it expires or the
  household removes Gather in their Enelogic account.
- The files of the deleted rows travel along and are released after the last
  page, ten per step, when no row of the Group can keep one. A step that failed
  for good is run again by hand with its own arguments, which hold their ids.
- A Member's default Group is cleared with their membership. Somebody who left
  before may keep a `defaultGroupId` that points at nothing; nothing opens it.
- `tasks`, `calendarEvents` and `babyEvents` hang off a parent rather than a
  Group, so each is deleted inside its parent's entry.
- **Deleting one list, calendar or child** (APP-878) deletes the parent row,
  then its children a page per transaction: the first page with the parent,
  the rest in `cascade.purgeChildren` steps. Nothing reaches them meanwhile,
  because every read and every queued send resolves the parent first. A
  child's log photos are released after its last page.
- **Energy** (ADR-0051): every Energy table but `energyPrices` carries a
  `groupId` and is read by `by_group`. A Group's price feeds take the account
  prices fetched through them (`energyPrices` by `feedId`); market prices have
  no feed and no Group and stay. The feed and its key are among the first rows to
  go; its account prices, some 35,000 a year, go right after, 1,000 at
  a time (`cascade.purgeAccountPrices`, APP-493). Deleting a House only clears
  an Address's link to it. Deleting a Group does not hold the
  hourly intervals and readings in its own transaction: a year of seven hourly
  channels is some 61,000 rows. `cascade.purgeEnergyRows` deletes them 1,000
  at a time right after. Nothing can read them meanwhile, because the Group is
  gone, and no sync adds to them, because its source is (APP-495).
- A repeating task's completion history (`taskCompletions`, APP-303) carries
  its `groupId`, so it goes with the Group, and with its task or list when
  either is deleted. A Member who leaves a shared Group stays named on the
  completions they made until their account is gone; after that the history
  reads "Someone".
- A table of a person's own rows (`userId`, no `groupId`: `aiUsage`,
  `idempotencyKeys`, `pushDevices`, `scheduledNotifications`) is not in the
  cascade; `cascade.finishAccount` deletes it by index, so a new one is added
  there by hand. Those rows go a page per step
  (`convex/lib/purgePage.ts`), then one shared Group per step, and the `users`
  row goes in the step that leaves nothing (APP-843). A `cascade.purgeAccount`
  step that failed is run again by hand with its own arguments and goes on from
  there, unless one shared Group alone is over the limit; without its
  `groupIds`, the solo Groups in them would be left, not destroyed. Queued push
  notifications have their scheduled jobs cancelled with them (`cancelJob` in
  `convex/lib/notifications.ts`).
  [Data export](data-export.md) reads the same tables, and its registry fails
  `pnpm typecheck` for a new one.
- **A paired watch goes with its person, its Group or its Membership**
  (`watchDevices`, APP-653): `finishAccount` and `destroyGroup` delete the rows
  and `detachFromGroup` deletes that Member's. Deleting a grocery list clears
  the rows that name it, an account merge repoints them, and an account being
  deleted is refused before its rows are gone ([watch API](watch-api.md)). The
  rate limiter's counters keep the bare row ids, which then point at nothing.
- **A queued send that names a Group goes with the Group.** `destroyGroup`
  and its steps cancel every `scheduledNotifications` row whose payload names
  the Group, by the `by_group` index, and
  deleting a task or a list withdraws the task's reminder send with it.
- **A task reminder belongs to the Member it goes to** (`tasks.reminder.userId`).
  `detachFromGroup` clears that Member's reminders in the Group and cancels
  their sends, so a Member who left or deleted their account is not reminded
  and the task shows no reminder for them. An account merge repoints it.
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
  with its other content, and so are its Staples (`groceryStaples`, APP-314)
  and the Pantry rows they were copied from (`pantryEntries`).
- **Account deletion is Convex first, Clerk second**, in scheduled steps, one
  Group per step (`convex/accounts.ts`, `convex/cascade.ts`).
- **A solo Group dies with the person; a shared Group they only leave.** What
  they added to a household stays with the household. `detachFromGroup` takes
  them out of it the same way whether they left or deleted their account: a cost
  split naming them is cleared, a saved split scenario keeps their name
  without their id, a calendar event drops them from its assignees, and a
  staple they kept (`groceryStaples.keptBy`, APP-681) no longer names them.
- **Shared is read again when the purge reaches the Group** (APP-882). The
  solo and shared Groups are split when the purge starts; by the time a
  shared one's step runs, everybody else in it may be gone or being deleted
  too, or it may have been made since. Then it has no Member left to leave
  it to, so the step destroys it instead. A Member being deleted does not
  count as staying anywhere: not here, and not in `groups.exitsFor`, so the
  last live Member may delete the Group.
- **A shared Group keeps an admin** (APP-938). `leaveGroup` refuses the only
  admin (`only-admin`); account deletion cannot be refused for that, so when
  the person going is the Group's only admin, the longest-standing Member
  staying (oldest membership) becomes admin in the same step that detaches
  them. An admin who is being deleted too does not count, the same as in
  `groups.exitsFor`.
- **An account being deleted is signed out of Gather** (APP-882).
  `getCurrentUser` and `requireCurrentUser` (`convex/lib/sharing.ts`) treat a
  `users` row with `deletedAt` as no account, so it reads, writes, creates
  and joins nothing, and spends no AI calls, while the purge runs.
  `deletionBlocker` and a repeated whole-account `deleteAccount` look the row
  up by subject, so the first still says the deletion is running and the
  second is a no-op.
- **Two choices, Gather's data first** ([ADR-0050](../adr/0050-deleting-gather-data-keeps-the-appelent-login.md)).
  Gather shares its Clerk login with Foundry, Fairway and Arcade Club. "Delete
  Gather data only" runs the purge with `keepLogin`, never calls
  `user.delete()` or revokes Sign in with Apple, signs out on this device and
  says the login still works elsewhere (the web's sign-in page at
  `?deleted=gather`, an alert on the phone). "Delete my whole AppElent
  account" is the run below and names the apps it takes with it.
- **The account portal's blocker is a purge already running.**
  `accountPortal.deletionBlocker` returns `deletionInProgress`
  (`@gather/core/refusals`) while the caller's row has `deletedAt`; a shared
  Group is left, never a blocker. Only the whole-account purge keeps the
  subject long enough to show it; "Gather data only" releases the subject, so
  the portal sees a never-used caller at once. Its `deleteAppData` follows
  APP-392.
- **One purge behind every way in.** `purgeSubject` (`convex/accounts.ts`)
  starts the purge for every `users` row of a Clerk subject, duplicates
  included, and never twice for a row already being purged. `deleteAccount`
  (either choice) and Clerk's `user.deleted` webhook both call it.
- **`users.deletedAt` stops `ensureUser` re-provisioning the account mid-purge**
  on the whole-account choice; the `users` row is deleted last for that reason.
  Gather's data only, and the webhook, release the subject instead: the row's
  `clerkId` becomes `released:<id>` in the first transaction, so the next
  sign-in gets a fresh, empty account at once while the old row is purged by
  id.
- **`POST /clerk/webhook` (`convex/http.ts`) does nothing it cannot verify.**
  It checks the Svix signature and timestamp against `CLERK_WEBHOOK_SECRET`
  before reading the body: no secret is 503, a missing signature 400, a bad or
  stale one 401. A verified `user.deleted` purges `data.id` and drops its
  Apple link; a verified `user.created` or `user.updated` mirrors the login's
  verified Sign in with Apple users into `appleSignInLinks` (APP-388), keeping
  the newest by the Clerk user's `updated_at`. A verified `session.ended`,
  `session.removed` or `session.revoked` deletes the push registration of the
  phone signed in with that session (APP-845) and the watches paired under it
  ([watch API](watch-api.md)). Any other event, a second
  delivery or a subject Gather never had answers 200 and does nothing.
- **`deleteSelfEnabled` is checked before the whole account is deleted.** Purging a
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
- **On the phone, only the login that confirmed is deleted** (APP-396). The
  user and session are remembered at the confirmation and checked before the
  Apple sheet, before its code is sent (APP-745), before the purge and again
  just before `user.delete()`. Changed before the purge: nothing is deleted.
  Changed after it: nothing is deleted on Clerk, and the
  stranded state is shown, where signing out is the way on. Signing out
  during the purge unmounts the provider, so a next person never sees it.
  Signing out and the "data deleted" alert after the purge never reach
  another session (APP-746). With no session left, the phone's local cleanup
  still runs, without the alert (APP-771). A session Clerk is switching to, or
  holds without having activated it, counts as another session (APP-797).
  Signing out, here and anywhere in the phone app, ends only that session: a
  second session on the phone stays (APP-824).
- **On the web, the same run and the same order**, from the Account page's
  Danger zone (`src/components/account/`). `AccountDeleteProvider` sits in
  `routes/_app.tsx` above the signed-in gate, so `ensureUser` is unmounted
  once the purge starts. The `deleteSelfEnabled` gate is the phone's
  (`@gather/core/account-deletion`). The confirmation names the account and
  asks for a typed word.
  Signing out, from the stranded state, after deleting Gather's data, and
  anywhere else on the web, ends only that session: a second session in the
  browser stays (APP-872).
- **The web confirms a recent sign-in before anything is deleted.** Clerk
  deletes a login only within ten minutes of the strongest sign-in factor; a
  browser tab is often older, and finding out after the purge would strand
  the account. The web asks with Clerk's verify dialog when the sign-in is
  older than five minutes, and closing it deletes nothing.
- **Another signed-in tab or device can bring the account back.** It still
  runs `ensureUser`; once the purge has deleted the `users` row, a reload
  there while the login is stranded provisions a new, empty account.
- **The iOS app and the production web revoke Sign in with Apple**, and only
  for the whole account: the phone from the native sheet (APP-213), the web
  from an Apple JS popup (APP-388, below). Android, and web origins Apple does
  not know (local, previews, staging), delete an Apple-linked account without
  revoking the grant. Deleting Gather's data only never touches Apple.

## Web Apple revocation

Ported from Foundry (APP-242). After the recent-sign-in check, an
Apple-linked account on `https://gather.appelent.nl` is asked for one more
click, because the browser opens Apple's popup only from a click
(`src/components/account/`). The popup for the Services ID `nl.appelent.web`
(`@gather/core/apple-sign-in`) returns a code, and
`accounts.revokeAppleSignIn` exchanges it with its return URL and revokes the
refresh token. Closing the popup, a blocked popup, or a popup that fails
deletes nothing. Once Convex has the code, an Apple failure is reported and
the deletion goes ahead, as on the phone.

Convex checks again before it exchanges anything, because a grant cannot be
restored: the caller is signed in and is the account the person confirmed
(`expectedSubject`), has a Gather account, and sent a registered return URL;
then the `sub` of Apple's ID token (Apple as issuer, the Services ID as
audience) must be one of the caller's `appleSignInLinks`. Otherwise nothing is
revoked, the refusal is `Apple account mismatch`, and the web stops the
deletion. No Clerk admin key is on Convex: the links come from the Clerk
webhook only. Native codes are not bound yet, because installed phones would
be refused for every login whose link is not mirrored.

Before the return URL works in production (Eric):

1. Apple Developer → Identifiers → Services ID `nl.appelent.web` → Sign in
   with Apple → Configure: add the domain `gather.appelent.nl` and the Return
   URL `https://gather.appelent.nl/account`.
2. Clerk (production) → Webhooks → the Gather endpoint
   `<convex-site-url>/clerk/webhook` (the one `user.deleted` uses): also
   subscribe `user.created` and `user.updated`.
3. After the deploy, backfill logins linked before that, since signing in
   does not send `user.updated`: `docs/migrations/README.md`,
   `backfill-apple-links`.

The development Clerk instance signs in with Clerk's shared Apple
credentials, so its Apple user ids belong to another Apple team and never
match: the first full run is on production. Test it there in Safari too: one
more click before Apple's popup, and Clerk asking to confirm the sign-in
again when Apple's step outlasts the five-minute check.

If the web says the Apple account is not the one linked although it is,
Convex has no mirrored link for that login: check that the webhook
subscribes `user.created` and `user.updated` and delivers (Clerk → Webhooks
→ attempts), then rerun the backfill. Nothing was deleted or revoked.

## Acceptance

- Deleting a Group leaves no row with its `groupId` and no blob only it held,
  once its scheduled steps have run.
- Deleting an account removes its solo Groups, leaves shared Groups intact
  without the person and with an admin, and finally removes the Clerk user.
- On the phone and the web, a Clerk refusal after the purge has started stays
  on screen, with Try again and Sign out, until one of them succeeds.
- On the web, nothing is deleted until Clerk has confirmed a recent sign-in.
- On the production web, an Apple-linked whole-account deletion revokes the
  Apple grant first; backing out of Apple's popup, or a popup that fails,
  deletes nothing, and a code for another Apple account is never revoked.
- Deleting Gather's data leaves the Clerk user untouched, signs out on this
  device, and a later sign-in gets a new, empty account.
- A signed `user.deleted` purges exactly what deleting Gather's data does; an
  unsigned or badly signed request changes nothing.
