import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { internalQuery, mutation, query } from './_generated/server'
import { requireGroupBySlug } from './lib/groupAccess'
import { findListInGroup, requireListAccess } from './lib/taskAccess'

const byOpenThenOrder = (a: Doc<'tasks'>, b: Doc<'tasks'>) =>
  Number(a.done) - Number(b.done) || a.order - b.order

export const listByList = query({
  args: { listId: v.id('taskLists'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    await requireListAccess(ctx, args.groupSlug, args.listId)
    const rows = await ctx.db
      .query('tasks')
      .withIndex('by_list', (q) => q.eq('listId', args.listId))
      .collect()
    return rows.sort(byOpenThenOrder)
  },
})

/**
 * The rows of a list, unauthorised — and safe to be, because its one caller is
 * `taskLists.getTasks`, which has already resolved the same list through
 * `requireListAccess` against the Group in the URL. Nothing else may call this;
 * a second caller would have to do that check for itself first.
 */
export const listByListInternal = internalQuery({
  args: { listId: v.id('taskLists') },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('tasks')
      .withIndex('by_list', (q) => q.eq('listId', args.listId))
      .collect()
    return rows.sort(byOpenThenOrder)
  },
})

const priorityValidator = v.union(
  v.literal(1),
  v.literal(2),
  v.literal(3),
  v.literal(4),
)

/**
 * The task a write is about, in the Group the caller named.
 *
 * A task carries no `groupId` — it hangs off a list — so the Group is checked
 * on the list and the task follows from that. "No such task" and "that task is
 * in another Group's list" are one answer, including for the id of a real task
 * a Member of both Groups could reach at the other address, so neither can be
 * used to find out that a task exists somewhere. The Group itself is still
 * refused first and distinctly.
 */
async function requireEditableTask(
  ctx: MutationCtx,
  groupSlug: string,
  taskId: Id<'tasks'>,
) {
  const task = await ctx.db.get(taskId)
  if (!task) {
    // Resolve the Group even with nothing to look up, so that a caller who is
    // not a Member of it hears that before anything about a task id.
    await requireGroupBySlug(ctx, groupSlug)
    throw new ConvexError('Task not found')
  }
  const found = await findListInGroup(ctx, groupSlug, task.listId)
  if (!found) throw new ConvexError('Task not found')
  if (found.list.provider !== 'local') {
    throw new ConvexError('This list is read-only')
  }
  return task
}

export const add = mutation({
  args: {
    listId: v.id('taskLists'),
    groupSlug: v.string(),
    title: v.string(),
    dueDate: v.optional(v.string()),
    priority: v.optional(priorityValidator),
    labels: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { user, list } = await requireListAccess(
      ctx,
      args.groupSlug,
      args.listId,
    )
    if (list.provider !== 'local') {
      throw new ConvexError('This list is read-only')
    }
    const existing = await ctx.db
      .query('tasks')
      .withIndex('by_list', (q) => q.eq('listId', args.listId))
      .collect()
    // existing.length collides with a sibling's order once any task has
    // been deleted (e.g. orders 0,1,2 -> delete 1 -> next add gets 2 again),
    // which makes sort/move ambiguous between same-order rows.
    const nextOrder =
      existing.reduce((max, t) => Math.max(max, t.order), -1) + 1
    return await ctx.db.insert('tasks', {
      listId: args.listId,
      title: args.title,
      done: false,
      dueDate: args.dueDate,
      priority: args.priority,
      labels: args.labels,
      createdBy: user._id,
      order: nextOrder,
    })
  },
})

export const toggleDone = mutation({
  args: { taskId: v.id('tasks'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    const task = await requireEditableTask(ctx, args.groupSlug, args.taskId)
    await ctx.db.patch(args.taskId, { done: !task.done })
  },
})

export const update = mutation({
  args: {
    taskId: v.id('tasks'),
    groupSlug: v.string(),
    title: v.optional(v.string()),
    // null clears the field (same pattern as recipes.update)
    dueDate: v.optional(v.union(v.string(), v.null())),
    priority: v.optional(v.union(priorityValidator, v.null())),
    labels: v.optional(v.union(v.array(v.string()), v.null())),
    notes: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    await requireEditableTask(ctx, args.groupSlug, args.taskId)
    const { taskId, title, dueDate, priority, labels, notes } = args
    await ctx.db.patch(taskId, {
      ...(title !== undefined ? { title } : {}),
      ...(dueDate !== undefined ? { dueDate: dueDate ?? undefined } : {}),
      ...(priority !== undefined ? { priority: priority ?? undefined } : {}),
      ...(labels !== undefined ? { labels: labels ?? undefined } : {}),
      ...(notes !== undefined ? { notes: notes ?? undefined } : {}),
    })
  },
})

export const remove = mutation({
  args: { taskId: v.id('tasks'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    await requireEditableTask(ctx, args.groupSlug, args.taskId)
    await ctx.db.delete(args.taskId)
  },
})

export const reorder = mutation({
  args: {
    listId: v.id('taskLists'),
    groupSlug: v.string(),
    ids: v.array(v.id('tasks')),
  },
  handler: async (ctx, args) => {
    const { list } = await requireListAccess(ctx, args.groupSlug, args.listId)
    if (list.provider !== 'local')
      throw new ConvexError('This list is read-only')
    const rows = await ctx.db
      .query('tasks')
      .withIndex('by_list', (q) => q.eq('listId', args.listId))
      .collect()
    const open = rows
      .filter((task) => !task.done)
      .sort((a, b) => a.order - b.order)
    const expected = new Set(open.map((task) => task._id))
    if (
      args.ids.length !== open.length ||
      args.ids.some((id) => !expected.has(id))
    ) {
      throw new ConvexError('Reorder must contain every open task exactly once')
    }
    const seen = new Set<string>()
    for (const id of args.ids) {
      if (seen.has(id))
        throw new ConvexError(
          'Reorder must contain every open task exactly once',
        )
      seen.add(id)
    }
    await Promise.all(args.ids.map((id, order) => ctx.db.patch(id, { order })))
  },
})

export const renameLabel = mutation({
  args: { groupSlug: v.string(), from: v.string(), to: v.string() },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const lists = await ctx.db
      .query('taskLists')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    const rows = (
      await Promise.all(
        lists.map((list) =>
          ctx.db
            .query('tasks')
            .withIndex('by_list', (q) => q.eq('listId', list._id))
            .collect(),
        ),
      )
    ).flat()
    await Promise.all(
      rows
        .filter((task) => task.labels?.includes(args.from))
        .map((task) =>
          ctx.db.patch(task._id, {
            labels: Array.from(
              new Set(
                (task.labels ?? []).map((label) =>
                  label === args.from ? args.to : label,
                ),
              ),
            ),
          }),
        ),
    )
  },
})

export const removeLabel = mutation({
  args: { groupSlug: v.string(), label: v.string() },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const lists = await ctx.db
      .query('taskLists')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    const rows = (
      await Promise.all(
        lists.map((list) =>
          ctx.db
            .query('tasks')
            .withIndex('by_list', (q) => q.eq('listId', list._id))
            .collect(),
        ),
      )
    ).flat()
    await Promise.all(
      rows
        .filter((task) => task.labels?.includes(args.label))
        .map((task) =>
          ctx.db.patch(task._id, {
            labels: (task.labels ?? []).filter((label) => label !== args.label),
          }),
        ),
    )
  },
})

/** Swap order with the adjacent task in the current sorted view. */
export const move = mutation({
  args: {
    taskId: v.id('tasks'),
    groupSlug: v.string(),
    direction: v.union(v.literal('up'), v.literal('down')),
  },
  handler: async (ctx, args) => {
    const task = await requireEditableTask(ctx, args.groupSlug, args.taskId)
    const siblings = (
      await ctx.db
        .query('tasks')
        .withIndex('by_list', (q) => q.eq('listId', task.listId))
        .collect()
    ).sort(byOpenThenOrder)
    const index = siblings.findIndex((t) => t._id === args.taskId)
    const neighbor = siblings[args.direction === 'up' ? index - 1 : index + 1]
    if (!neighbor || neighbor.done !== task.done) return
    await ctx.db.patch(task._id, { order: neighbor.order })
    await ctx.db.patch(neighbor._id, { order: task.order })
  },
})
