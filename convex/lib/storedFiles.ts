/**
 * Keeping stored files from outliving the rows that point at them.
 *
 * A photo is uploaded to Convex storage and the row keeps its id. Nothing else
 * ever looks at that blob, so the moment the row stops pointing at it — the
 * photo is replaced, cleared, or the record deleted — it is unreachable, and
 * storage that only grows is storage that fills up with pictures nobody can
 * ever see again (#38).
 *
 * So the mutation that orphans a blob deletes it, in the same transaction, and
 * these are the two shapes that takes: reconciling the id a row *held* with the
 * id it is *being given*, and dropping the one a deleted record held. Recipes
 * and Baby are the two Modules with a photo today and there will be a third, so
 * the rule lives here once rather than open-coded in each.
 *
 * **Deletion belongs behind the access check the mutation already makes.** A
 * `_storage` id carries no ownership — a function that took one and deleted it
 * would let any signed-in caller destroy any blob in the deployment. Every
 * caller here has already resolved the record and refused whoever may not write
 * it; there is deliberately no publicly callable form of this.
 *
 * **A blob goes when the *last* row lets go of it, not the first.** #38 assumed
 * no two rows ever hold one `_storage` id, and no gather code copies one — but
 * nothing enforces it at the door either. `imageId`/`photoId` are supplied by
 * the client on create and update, and every read hands the id back, so a
 * Member of a Group a recipe was merely Shared into can put that id on a recipe
 * of their own. They still cannot write the original row, and unguarded, their
 * delete would have destroyed the original's picture (PR #58 review). So the
 * rule is asked rather than assumed: after the write that let go, is any row
 * still pointing at this blob? That also gives Copy a safe answer in advance —
 * two rows on one blob keep the picture until both are gone.
 *
 * Reading every row of every photo-bearing table to answer it is affordable
 * because it happens only on the paths that orphan a file, never on a read
 * path, and `recipes.list` already scans that table on every page load.
 *
 * Out of scope, and both filed: blobs orphaned *before* any row references them
 * (abandoned forms and imports, #41), and any sweep or backfill over the
 * orphans already in storage (#38 states why that half is the hazardous one).
 */

import type { Doc, Id, TableNames } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

/**
 * The fields of one table that hold a `_storage` id, if it has any.
 *
 * Assignability runs field → id, not the other way about: a `_storage` id is a
 * branded string and so is assignable *to* every plain `string` column, which
 * would make every table in the schema look like a file holder.
 */
type StoredFileField<T extends TableNames> = {
  [K in keyof Doc<T>]-?: [NonNullable<Doc<T>[K]>] extends [Id<'_storage'>]
    ? K
    : never
}[keyof Doc<T>]

/** Every table whose rows can point at a stored file. */
type FileHolder = {
  [T in TableNames]: [StoredFileField<T>] extends [never] ? never : T
}[TableNames]

/**
 * Which field holds the file, per table that has one.
 *
 * Typed off the schema rather than written out, so adding a photo to a third
 * Module fails to compile until it is registered here. A table missing from
 * this map is invisible to the reference check, and a blob it alone still
 * points at would be deleted out from under it — the one way this file can
 * destroy a live photo, and worth a type error rather than vigilance.
 */
const FILE_HOLDERS: { [T in FileHolder]: StoredFileField<T> } = {
  babies: 'photoId',
  babyEvents: 'photoId',
  recipes: 'imageId',
  foods: 'imageId',
  groups: 'imageId',
  tastingSubjects: 'photoId',
}

/** Is any row — in any table — still pointing at this file? */
async function isStillReferenced(ctx: MutationCtx, id: Id<'_storage'>) {
  for (const table of Object.keys(FILE_HOLDERS) as FileHolder[]) {
    const field = FILE_HOLDERS[table]
    const rows = await ctx.db.query(table as TableNames).collect()
    if (rows.some((row) => (row as Record<string, unknown>)[field] === id)) {
      return true
    }
  }
  return false
}

/**
 * Delete a stored file, once nothing points at it any more.
 *
 * Call this *after* the write that let go of it — the patch, or the row's own
 * delete — so the row being changed is not found holding the id it just
 * dropped.
 *
 * Already gone is not an error. A blob deleted out of band leaves a row still
 * pointing at it, and throwing on that would make the record undeletable — a
 * worse state than the stale pointer being cleaned up. Same call `recipes.remove`
 * already makes about the row itself.
 */
export async function deleteStoredFile(
  ctx: MutationCtx,
  id: Id<'_storage'> | undefined | null,
) {
  if (!id) return
  // File metadata is a system table read, and the only way to ask "is this
  // blob still here?" from inside a mutation.
  const metadata = await ctx.db.system.get(id)
  if (!metadata) return
  if (await isStillReferenced(ctx, id)) return
  await ctx.storage.delete(id)
}

/**
 * Reconcile the file a row stored with the one it is being given, deleting the
 * previous blob when the row stops pointing at it.
 *
 * `next` speaks the language the update mutations already speak: `undefined` is
 * "the field was absent, leave it alone", `null` is "clear it". Only an id that
 * differs from the stored one, or a clear, orphans anything.
 */
export async function replaceStoredFile(
  ctx: MutationCtx,
  previous: Id<'_storage'> | undefined,
  next: Id<'_storage'> | null | undefined,
) {
  if (next === undefined) return
  if (!previous || next === previous) return
  await deleteStoredFile(ctx, previous)
}

/**
 * The stored file one row holds, if its table holds files at all.
 *
 * The registry above is the only thing that knows which column that is, so
 * anything enumerating rows in order to delete them — a Group cascade, an
 * account purge — asks here rather than reaching for `imageId ?? photoId` and
 * quietly missing the sixth table the day it arrives.
 */
export function storedFileIdOf<T extends TableNames>(
  table: T,
  row: Doc<T>,
): Id<'_storage'> | undefined {
  const field = (FILE_HOLDERS as Record<string, string | undefined>)[table]
  if (!field) return undefined
  return (row as Record<string, unknown>)[field] as Id<'_storage'> | undefined
}
