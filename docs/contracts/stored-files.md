---
type: contract
description: Read when uploading, preparing, replacing, or deleting a photo or any Convex stored file.
version: 2.1.0
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
  typed off the schema, as a list of its table's `_storage` columns, so a new
  column fails to compile until it is listed — including a second column on a
  table already listed (a Loyalty card's front and back photos). That registry is what stops a blob being deleted from under a table
  nobody registered. Each column also needs a `by_<column>` index in the schema
  (fails to compile without it), so a release reads at most one row however many
  there are (APP-876).
- **A stored file lives exactly as long as some row points at it.** Every
  path that orphans a file calls `deleteStoredFile` / `replaceStoredFile`
  *after* the write that let go, behind the access check the mutation already
  made, so a photo nobody can reach is not a thing storage holds — and a photo
  two rows hold survives the first of them going.
- **A chosen photo that cannot be prepared is not stored at all.** An image
  Gather fetches for itself is neither chosen nor prepared.
- **The bytes go up before the row exists.** Convex's upload ends in an id, so
  the id is passed into the mutation and never patched on afterwards. A save
  whose upload failed never became a row. The photo is always optional, so
  "save without it" is the fallback, not a retry queue.
- **One prepared file is uploaded once** on the phone (`uploadPhotoOnce`): a form
  reopened on a kept draft takes up the upload its closed row started.
- On the phone, local files are read with `expo-file-system`
  ([mobile bindings](../../apps/mobile/CODING_STANDARDS.md#bindings)).
- **Group deletion carries storage ids through its steps** rather than deleting
  inline; `cascade.releaseFiles` lets them go after the last page
  ([account deletion](account-deletion.md)).

## Out of scope

- A file uploaded before any row references it. It is the exception to the
  lifetime rule and is not yet handled.
- Private files. `ctx.storage.getUrl` returns an unguessable but
  unauthenticated URL that never expires: accepted for avatars, headers and
  keepsakes, not for anything a household would mind being readable by whoever
  holds a link.

## Acceptance

- Replacing or clearing a photo, and deleting its record, leaves no unreferenced
  blob; a blob shared by two rows survives until the second lets go.
