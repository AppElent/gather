/**
 * The local cache of an external Task list, and how the provider's answer gets
 * written into it.
 *
 * The provider owns these records (ADR-0013). Reconciliation is therefore not a
 * merge: it is the provider's list, written down. A cached row the provider no
 * longer has stops existing here too, a row whose fields differ takes the
 * provider's, and nothing local is protected — a local change the provider did
 * not accept was never made.
 *
 * Kept out of `tasks.ts` because it is the one piece both the refresh path and
 * the write paths need, and because it is worth testing on its own.
 */

import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import type { UnifiedTask } from './taskProviders/types'

/** What one refresh changed, so a caller can say so and a test can assert it. */
export interface ReconcileResult {
  added: number
  updated: number
  deleted: number
}

/**
 * The fields of a cached row that the provider decides. Everything else on the
 * document — its list, its id here — is gather's own bookkeeping.
 */
function cachedFields(task: UnifiedTask, order: number) {
  return {
    title: task.title,
    done: task.done,
    dueDate: task.dueDate,
    priority: task.priority,
    labels: task.labels,
    url: task.url,
    order,
  }
}

/** Whether a cached row already says exactly what the provider just said. */
function matches(row: Doc<'tasks'>, fields: ReturnType<typeof cachedFields>) {
  return (
    row.title === fields.title &&
    row.done === fields.done &&
    row.dueDate === fields.dueDate &&
    row.priority === fields.priority &&
    row.url === fields.url &&
    row.order === fields.order &&
    JSON.stringify(row.labels ?? null) === JSON.stringify(fields.labels ?? null)
  )
}

/**
 * Make the cache of `listId` say exactly what the provider just returned.
 *
 * Idempotent: reconciling the same answer twice writes nothing the second
 * time, which is what makes a refresh cheap enough to offer freely and what
 * keeps Convex from waking every reader of the list for no change.
 */
export async function reconcileList(
  ctx: MutationCtx,
  listId: Id<'taskLists'>,
  tasks: UnifiedTask[],
): Promise<ReconcileResult> {
  const existing = await ctx.db
    .query('tasks')
    .withIndex('by_list', (q) => q.eq('listId', listId))
    .collect()
  const byExternalId = new Map(
    existing.filter((t) => t.externalId).map((t) => [t.externalId, t]),
  )

  const result: ReconcileResult = { added: 0, updated: 0, deleted: 0 }
  const seen = new Set<string>()

  // The provider's order is the provider's, so position comes from where the
  // task sits in its answer rather than from anything gather remembers.
  for (const [index, task] of tasks.entries()) {
    seen.add(task.externalId)
    const fields = cachedFields(task, index)
    const row = byExternalId.get(task.externalId)
    if (!row) {
      await ctx.db.insert('tasks', {
        listId,
        externalId: task.externalId,
        ...fields,
      })
      result.added += 1
      continue
    }
    if (!matches(row, fields)) {
      await ctx.db.patch(row._id, fields)
      result.updated += 1
    }
  }

  // Gone from the provider is gone. That covers a task somebody deleted there
  // and a task that left this source; either way the provider is authoritative
  // and a row it does not have would otherwise look real forever.
  //
  // A row with no `externalId` on an external list is deleted too: nothing
  // writes one, so its existence would mean a local write had leaked past the
  // provider-first rule and it must not be allowed to look like data.
  for (const row of existing) {
    if (row.externalId && seen.has(row.externalId)) continue
    await ctx.db.delete(row._id)
    result.deleted += 1
  }

  await linkParents(ctx, listId, tasks)
  return result
}

/**
 * Resolve the provider's parent references onto rows in this table.
 *
 * A second pass, because a subtask can arrive before its parent does and a
 * reference to a row that does not exist yet is not a reference. By the time
 * this runs every task the provider mentioned has a row, so every parent it
 * named can be found — and one it did not name resolves to nothing, which is
 * the same as being top-level and is what a parent deleted at the provider
 * leaves behind.
 */
async function linkParents(
  ctx: MutationCtx,
  listId: Id<'taskLists'>,
  tasks: UnifiedTask[],
): Promise<void> {
  if (!tasks.some((t) => t.parentExternalId)) {
    // Nothing nested in this answer. Any parent link still on a row is one the
    // provider has stopped asserting, so it goes — but only walk the rows if
    // there is something to clear.
    const rows = await ctx.db
      .query('tasks')
      .withIndex('by_list', (q) => q.eq('listId', listId))
      .collect()
    for (const row of rows) {
      if (row.parentTaskId) {
        await ctx.db.patch(row._id, { parentTaskId: undefined })
      }
    }
    return
  }

  const rows = await ctx.db
    .query('tasks')
    .withIndex('by_list', (q) => q.eq('listId', listId))
    .collect()
  const idByExternalId = new Map(
    rows.filter((r) => r.externalId).map((r) => [r.externalId, r._id]),
  )
  const parentByExternalId = new Map(
    tasks.map((t) => [t.externalId, t.parentExternalId]),
  )

  for (const row of rows) {
    const parentExternalId = row.externalId
      ? parentByExternalId.get(row.externalId)
      : undefined
    const parentTaskId = parentExternalId
      ? idByExternalId.get(parentExternalId)
      : undefined
    if (row.parentTaskId !== parentTaskId) {
      await ctx.db.patch(row._id, { parentTaskId })
    }
  }
}
