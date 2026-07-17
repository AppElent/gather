import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { internalQuery, mutation, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import { requireListAccess } from './lib/taskAccess'

const byOpenThenOrder = (a: Doc<'tasks'>, b: Doc<'tasks'>) =>
  Number(a.done) - Number(b.done) || a.order - b.order

export const listByList = query({
  args: { listId: v.id('taskLists') },
  handler: async (ctx, args) => {
    await requireListAccess(ctx, args.listId)
    const rows = await ctx.db
      .query('tasks')
      .withIndex('by_list', (q) => q.eq('listId', args.listId))
      .collect()
    return rows.sort(byOpenThenOrder)
  },
})

// Used by taskLists.getTasks, which has already authorized the list.
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

async function requireEditableTask(ctx: MutationCtx, taskId: Id<'tasks'>) {
  const task = await ctx.db.get(taskId)
  if (!task) throw new ConvexError('Task not found')
  const { list } = await requireListAccess(ctx, task.listId)
  if (list.provider !== 'local') throw new ConvexError('This list is read-only')
  return task
}

export const add = mutation({
  args: {
    listId: v.id('taskLists'),
    title: v.string(),
    dueDate: v.optional(v.string()),
    priority: v.optional(priorityValidator),
    labels: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { user, list } = await requireListAccess(ctx, args.listId)
    if (list.provider !== 'local') {
      throw new ConvexError('This list is read-only')
    }
    const existing = await ctx.db
      .query('tasks')
      .withIndex('by_list', (q) => q.eq('listId', args.listId))
      .collect()
    return await ctx.db.insert('tasks', {
      listId: args.listId,
      title: args.title,
      done: false,
      dueDate: args.dueDate,
      priority: args.priority,
      labels: args.labels,
      createdBy: user._id,
      order: existing.length,
    })
  },
})

export const toggleDone = mutation({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, args) => {
    const task = await requireEditableTask(ctx, args.taskId)
    await ctx.db.patch(args.taskId, { done: !task.done })
  },
})

export const update = mutation({
  args: {
    taskId: v.id('tasks'),
    title: v.string(),
    // null clears the field (same pattern as recipes.update)
    dueDate: v.optional(v.union(v.string(), v.null())),
    priority: v.optional(v.union(priorityValidator, v.null())),
    labels: v.optional(v.union(v.array(v.string()), v.null())),
  },
  handler: async (ctx, args) => {
    await requireEditableTask(ctx, args.taskId)
    const { taskId, title, dueDate, priority, labels } = args
    await ctx.db.patch(taskId, {
      title,
      ...(dueDate !== undefined ? { dueDate: dueDate ?? undefined } : {}),
      ...(priority !== undefined ? { priority: priority ?? undefined } : {}),
      ...(labels !== undefined ? { labels: labels ?? undefined } : {}),
    })
  },
})

export const remove = mutation({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, args) => {
    await requireEditableTask(ctx, args.taskId)
    await ctx.db.delete(args.taskId)
  },
})

/** Swap order with the adjacent task in the current sorted view. */
export const move = mutation({
  args: {
    taskId: v.id('tasks'),
    direction: v.union(v.literal('up'), v.literal('down')),
  },
  handler: async (ctx, args) => {
    const task = await requireEditableTask(ctx, args.taskId)
    const siblings = (
      await ctx.db
        .query('tasks')
        .withIndex('by_list', (q) => q.eq('listId', task.listId))
        .collect()
    ).sort(byOpenThenOrder)
    const index = siblings.findIndex((t) => t._id === args.taskId)
    const neighbor =
      siblings[args.direction === 'up' ? index - 1 : index + 1]
    if (!neighbor || neighbor.done !== task.done) return
    await ctx.db.patch(task._id, { order: neighbor.order })
    await ctx.db.patch(neighbor._id, { order: task.order })
  },
})
