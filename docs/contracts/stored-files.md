---
type: contract
description: Read when uploading, preparing, replacing, or deleting a photo or any Convex stored file.
version: 1.0.0
status: current
---

# Stored files

Every stored photo is **prepared, never stored as chosen**
([ADR-0010](../adr/0010-a-photo-is-stored-as-prepared-never-as-chosen.md)), and
no blob outlives the last row that points at it.

## Behavior

- **One table of sizes.** `packages/core/src/photoPresets.ts` is the only place
  a dimension, aspect or JPEG quality is written, shared by web and phone. Call
  sites name a preset and pass nothing else; a new kind of photo is a new
  preset there, never a number at a call site.
- **A stored file is registered** in `FILE_HOLDERS` (`convex/lib/storedFiles.ts`),
  typed off the schema, so a new `_storage` column fails to compile until it is
  listed. That registry is what stops a blob being deleted from under a table
  nobody registered.
- **Every path that orphans a file** calls `deleteStoredFile` /
  `replaceStoredFile` *after* the write that let go, behind the access check the
  mutation already made. A blob goes when the last row lets go of it.
- **The bytes go up before the row exists.** Convex's upload ends in an id, so
  the id is passed into the mutation and never patched on afterwards. A save
  whose upload failed never became a row. The photo is always optional, so
  "save without it" is the fallback, not a retry queue.
- On the phone, local files are read with `expo-file-system`
  ([mobile bindings](../../apps/mobile/CODING_STANDARDS.md#bindings)).
- **Group deletion returns storage ids** rather than deleting inline; the caller
  schedules them ([account deletion](account-deletion.md)).

## Out of scope

- Private files. `ctx.storage.getUrl` returns an unguessable but
  unauthenticated URL that never expires: accepted for avatars, headers and
  keepsakes, not for anything a household would mind being readable by whoever
  holds a link.

## Acceptance

- Replacing or clearing a photo, and deleting its record, leaves no unreferenced
  blob; a blob shared by two rows survives until the second lets go.
