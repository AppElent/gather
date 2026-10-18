---
type: contract
description: Read when adding a Convex table, changing what "Export your data" contains, or changing who may see a row or column.
version: 1.1.0
status: current
---

# Data export

A person can download everything Gather holds that is theirs or their
households' as one JSON file — GDPR access and portability — from Account on
the web and Settings → Account on the phone. It is the read-only twin of
[account deletion](account-deletion.md), and it is scoped by the same rule:
everything user-owned belongs to a Group or to a person
([ADR-0030](../adr/0030-groups-are-the-only-user-owned-scope.md)).

## Behavior

- **`convex/lib/dataExport.ts` cannot be forgotten.** `EXPORT_TABLES` is keyed by
  every table in the schema, so a new table fails `pnpm typecheck` until it
  states a treatment: read for the person, read per Group, or excluded with a
  reason. A table with a `groupId` (`GroupScopedTable`, derived in
  `groupCascade.ts`) may only be read per Group or excluded, and a table with a
  `userId` and no `groupId` only for the person.
- **Scope is the person's account and every Group they are a Member of.** A
  Group's content goes in whole, because a Group's Members can already see all
  of it ([ownership and access](ownership-and-access.md)). Recipes Shared *into*
  one of their Groups are not included: they belong to, and are exported with,
  their home Group.
- **Another Member's own records stay theirs.** Personal tables (`consumptionEntries`,
  `combos`, `comboItems`, `aiUsage`) and authored `foods` are read by the
  caller's own id and nothing else. Another Member's `memberships` row keeps
  only who they are and their role; their Pins and calendar choices are theirs
  ([ADR-0005](../adr/0005-pins-belong-to-a-person-in-a-group.md)).
- **People by display name, never by identifier.** Every user id anywhere in a
  row is written as that person's name, or `null` for somebody no longer in the
  Group. No email, Clerk id or user id of anyone leaves; the person's own email
  is in their `users` row.
- **Groups by slug.** A Group id becomes the Group's slug when it is one of the
  person's Groups and is dropped otherwise, so the file names no Group they
  cannot see.
- **No secrets.** `integrationConnections.accessToken` and `groups.inviteCode`
  are omitted columns, listed in the file's `omittedFields`.
- **Photos as links, not bytes.** A column registered in `FILE_HOLDERS`
  ([stored files](stored-files.md)) becomes `…Url` with `ctx.storage.getUrl`.
  Those links need no sign-in and do not expire, and the screen says so.
- **Reference data and bookkeeping are excluded**: `tastingCatalog`
  (`reference-data`), `seedRuns` (`bookkeeping`). Tasks in a Notion- or
  Todoist-backed list live in that service and are not in the file.
- **Bounded reads, assembled on the client.** `dataExport.manifest` names the
  tables and Groups; `dataExport.page` returns at most `PAGE_SIZE` rows of one
  table from one index range. A child table is paged across its parents with a
  compound cursor. `collectExport` in `@gather/core/data-export` drains them in
  order, so web and phone write the same file.
- **The file is versioned.** It opens with `format: "gather.data-export"` and
  `version`, then `conventions`, `notIncluded`, `excludedTables` and
  `omittedFields`. Bump `EXPORT_VERSION` when a reader of the previous version
  would misread the new one; a new table is not a bump.
- **Delivery is the platform's own.** The web downloads a Blob. The phone
  (`apps/mobile/src/features/account/export/`) writes the file to the cache
  with `expo-file-system` and opens the system share sheet with `expo-sharing`,
  on iOS and Android alike; a phone with nowhere to share to is told so before
  anything is read. The file stays in the cache until the next export replaces
  it, because Android's sheet can close before the receiving app has read it.
- **`expo-sharing` is a native dependency.** It moved the fingerprint, so the
  feature reaches phones with a native build, not over the air
  ([ADR-0029](../adr/0029-a-javascript-change-ships-over-the-air-and-a-native-one-does-not.md)).
  Its config plugin is not in `app.json`: sharing out needs none, and its
  share-*into* half would compete with `expo-share-intent` ([Drop](drop.md)).

## Out of scope

- Importing a file back. Portability here is the file; nothing reads it.
- Photo bytes. A zip with the blobs would make the file self-contained, at the
  cost of a server-side job and a much larger download.
- Data held by Clerk (sign-in methods, sessions) and by connected services.

## Acceptance

- Every table in the schema is either in the manifest or in `excludedTables`.
- An export by one Member of a shared Group contains the Group's content and
  the other Member's display name, and none of the other Member's diary,
  combos, foods, Pins, email or ids, and no access token or invite code.
