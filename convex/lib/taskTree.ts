/**
 * Tasks nest, and the questions that come with nesting.
 *
 * The domain model is arbitrary depth (ADR-0014); what actually stops a tree
 * getting deeper is the Backend, which says so in its capability list. Two
 * things have to be true whatever the Backend: a task is never its own
 * ancestor, and deleting a task takes what hangs off it rather than leaving
 * rows nothing can reach.
 *
 * Deliberately walking upward one row at a time. A list holds tens of tasks,
 * not thousands, and a materialised path would be a second copy of the
 * hierarchy to keep honest against a provider that owns the first.
 */

import { ConvexError } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'

/** The chain from a task up to the root, nearest parent first. */
export async function ancestorsOf(
  ctx: QueryCtx,
  taskId: Id<'tasks'>,
): Promise<Doc<'tasks'>[]> {
  const chain: Doc<'tasks'>[] = []
  let current = await ctx.db.get(taskId)
  const seen = new Set<string>([taskId])
  while (current?.parentTaskId) {
    // A cycle cannot be created through these functions, but a cycle read
    // here would hang the request rather than fail it, so this does not
    // depend on that being true.
    if (seen.has(current.parentTaskId)) break
    seen.add(current.parentTaskId)
    const parent = await ctx.db.get(current.parentTaskId)
    if (!parent) break
    chain.push(parent)
    current = parent
  }
  return chain
}

/** How deep a task placed under this parent would sit. Top level is 1. */
export async function depthUnder(
  ctx: QueryCtx,
  parentTaskId: Id<'tasks'> | undefined,
): Promise<number> {
  if (!parentTaskId) return 1
  return (await ancestorsOf(ctx, parentTaskId)).length + 2
}

/**
 * The parent a task is being given, checked — it must be in the same list, it
 * must not be the task itself, and it must not be somewhere below it.
 */
export async function requireValidParent(
  ctx: QueryCtx,
  task: Doc<'tasks'>,
  parentTaskId: Id<'tasks'> | undefined,
): Promise<void> {
  if (!parentTaskId) return
  if (parentTaskId === task._id) {
    throw new ConvexError('A task cannot be its own subtask')
  }
  const parent = await ctx.db.get(parentTaskId)
  if (!parent || parent.listId !== task.listId) {
    throw new ConvexError('That parent task is not in this list')
  }
  const ancestors = await ancestorsOf(ctx, parentTaskId)
  if (ancestors.some((a) => a._id === task._id)) {
    throw new ConvexError('A task cannot be moved under its own subtask')
  }
}

/** Refuse a placement the Backend has said it cannot hold. */
export function requireDepthWithin(
  depth: number,
  maxDepth: number | undefined,
): void {
  if (maxDepth !== undefined && depth > maxDepth) {
    throw new ConvexError(
      `This list's provider nests ${maxDepth} levels deep at most`,
    )
  }
}

/**
 * A task and everything under it, deepest last.
 *
 * What deletion has to cover: a subtask whose parent is gone is not a
 * top-level task, it is a row nothing in the Module can reach.
 */
export async function withDescendants(
  ctx: QueryCtx,
  taskId: Id<'tasks'>,
): Promise<Id<'tasks'>[]> {
  const task = await ctx.db.get(taskId)
  if (!task) return []
  const siblings = await ctx.db
    .query('tasks')
    .withIndex('by_list', (q) => q.eq('listId', task.listId))
    .collect()

  const collected: Id<'tasks'>[] = [taskId]
  for (let i = 0; i < collected.length; i += 1) {
    const parentId = collected[i]
    for (const row of siblings) {
      if (row.parentTaskId === parentId && !collected.includes(row._id)) {
        collected.push(row._id)
      }
    }
  }
  return collected
}
