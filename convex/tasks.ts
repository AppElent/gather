import {
  type GroceryUnit,
  groceryAddFields,
  groceryLineText,
  isGroceryQuantity,
  roundGroceryQuantity,
} from '@gather/core/groceries'
import { normalizeTaskUrl } from '@gather/core/task-lists'
import { clockMoment } from '@gather/core/task-reminders'
import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { internalQuery, mutation, query } from './_generated/server'
import {
  askAiOnce,
  isGroceryList,
  recentListItems,
  recogniseGroceryTitle,
  recordGroceryCorrection,
} from './lib/groceryCategories'
import {
  groceryAisleValidator,
  groceryUnitValidator,
} from './lib/groceryFields'
import {
  findInGroup,
  requireGroupBySlug,
  requireInGroup,
} from './lib/groupAccess'
import { createOnce, idempotencyKeyValidator } from './lib/idempotency'
import { taskPriorityValidator } from './lib/taskFields'
import {
  cancelSend,
  checkedClock,
  REMINDER_PASSED,
  REMINDER_SLACK_MS,
  shiftedReminder,
  syncSend,
  type TaskReminder,
} from './lib/taskReminders'

const byOpenThenOrder = (a: Doc<'tasks'>, b: Doc<'tasks'>) =>
  Number(a.done) - Number(b.done) || a.order - b.order

export const listByList = query({
  args: { listId: v.id('taskLists'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    await requireInGroup(ctx, args.groupSlug, args.listId, 'List not found')
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
 * `requireInGroup` against the Group in the URL. Nothing else may call this;
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

/**
 * The task a write is about, in the Group the caller named.
 *
 * A task carries no `groupId` — it hangs off a list — so the Group is checked
 * on the list and the task follows from that. "No such task" and "that task is
 * in another Group's list" are one answer, including for the id of a real task
 * a Member of both Groups could reach through the other Group, so neither can be
 * used to find out that a task exists somewhere. The Group itself is still
 * refused first and distinctly.
 */
async function requireEditableTask(
  ctx: MutationCtx,
  groupSlug: string,
  taskId: Id<'tasks'>,
) {
  return (await requireEditableTaskInGroup(ctx, groupSlug, taskId)).task
}

/** As `requireEditableTask`, with the Group, caller and list it was found in. */
async function requireEditableTaskInGroup(
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
  const found = await findInGroup(ctx, groupSlug, task.listId)
  if (!found) throw new ConvexError('Task not found')
  if (found.doc.provider !== 'local') {
    throw new ConvexError('This list is read-only')
  }
  return { ...found, task }
}

/**
 * A local list of the named Group. Only a local list has `tasks` rows; a write
 * to an external list goes through its provider, not through these mutations.
 */
async function requireLocalList(
  ctx: MutationCtx,
  groupSlug: string,
  listId: Id<'taskLists'>,
) {
  const found = await requireInGroup(ctx, groupSlug, listId, 'List not found')
  if (found.doc.provider !== 'local') {
    throw new ConvexError('This list is read-only')
  }
  return found
}

/** The order that puts a new row last on a list, read from its last row. */
async function endOfList(ctx: MutationCtx, listId: Id<'taskLists'>) {
  const last = await ctx.db
    .query('tasks')
    .withIndex('by_list_and_order', (q) => q.eq('listId', listId))
    .order('desc')
    .first()
  return last ? last.order + 1 : 0
}


export const add = mutation({
  args: {
    listId: v.id('taskLists'),
    groupSlug: v.string(),
    title: v.string(),
    dueDate: v.optional(v.string()),
    priority: v.optional(taskPriorityValidator),
    labels: v.optional(v.array(v.string())),
    // A grocery item's amount (APP-309), already taken off the title by the
    // client ("2 pakken melk" arrives as "melk", 2, `pak`). A client that
    // sends none — an installed app from before amounts — keeps its line as
    // the title, exactly as before.
    quantity: v.optional(v.number()),
    unit: v.optional(groceryUnitValidator),
    idempotencyKey: idempotencyKeyValidator,
  },
  handler: async (ctx, args) => {
    const { user, group, doc: list } = await requireLocalList(
      ctx,
      args.groupSlug,
      args.listId,
    )
    const quantity =
      args.quantity === undefined ? undefined : checkedQuantity(args.quantity)
    const onGroceryList = isGroceryList(group, list)
    // A list without amounts keeps an amount it was sent in the title, so
    // nothing a connected app wrote is dropped.
    const title = onGroceryList
      ? args.title
      : groceryLineText(args.title, quantity, args.unit)
    return await createOnce(ctx, user._id, 'tasks', args.idempotencyKey, async () => {
      // An item on a grocery list gets its aisle here, so every client —
      // installed apps that know nothing of aisles too — has it. It is
      // recognised as the whole line: "2 blik tomaten" is in tins, not with
      // the fresh tomatoes.
      const grocery = onGroceryList
        ? await recogniseGroceryTitle(
            ctx,
            group._id,
            groceryLineText(title, quantity, args.unit),
            await recentListItems(ctx, args.listId),
          )
        : null
      const taskId = await ctx.db.insert('tasks', {
        listId: args.listId,
        title,
        done: false,
        dueDate: args.dueDate,
        priority: args.priority,
        labels: args.labels,
        createdBy: user._id,
        order: await endOfList(ctx, args.listId),
        ...(grocery ? { category: grocery.aisle } : {}),
        ...(onGroceryList && quantity !== undefined ? { quantity } : {}),
        ...(onGroceryList && args.unit !== undefined ? { unit: args.unit } : {}),
      })
      if (grocery) await askAiOnce(ctx, group._id, grocery, taskId)
      return taskId
    })
  },
})

export const toggleDone = mutation({
  args: { taskId: v.id('tasks'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { task, group } = await requireEditableTaskInGroup(
      ctx,
      args.groupSlug,
      args.taskId,
    )
    await ctx.db.patch(args.taskId, { done: !task.done })
    if (task.reminder)
      await syncSend(ctx, { ...task, done: !task.done }, group._id, task.reminder)
  },
})

/**
 * Set or clear a task's reminder (APP-305). It goes to the caller: a reminder
 * is chosen by the person it is for (16 Sept). The clock is the caller's wall
 * clock and time zone; the moment must not have passed, give or take the
 * minute the person was looking at.
 */
export const setReminder = mutation({
  args: {
    taskId: v.id('tasks'),
    groupSlug: v.string(),
    reminder: v.union(
      v.object({ date: v.string(), time: v.string(), timeZone: v.string() }),
      v.null(),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { task, group, user } = await requireEditableTaskInGroup(
      ctx,
      args.groupSlug,
      args.taskId,
    )
    let reminder: TaskReminder | undefined
    if (args.reminder) {
      const clock = checkedClock(args.reminder)
      if (clockMoment(clock) < Date.now() - REMINDER_SLACK_MS)
        throw new ConvexError(REMINDER_PASSED)
      reminder = { ...clock, userId: user._id }
    }
    await ctx.db.patch(task._id, { reminder })
    await syncSend(ctx, { ...task, reminder }, group._id, task.reminder, {
      late: true,
    })
    return null
  },
})

export const update = mutation({
  args: {
    taskId: v.id('tasks'),
    groupSlug: v.string(),
    title: v.optional(v.string()),
    // null clears the field (same pattern as recipes.update)
    dueDate: v.optional(v.union(v.string(), v.null())),
    priority: v.optional(v.union(taskPriorityValidator, v.null())),
    labels: v.optional(v.union(v.array(v.string()), v.null())),
    notes: v.optional(v.union(v.string(), v.null())),
    // Set, rather than toggled: a connected app retrying must land in one state.
    done: v.optional(v.boolean()),
    // A wishlist item's link and price (APP-306); null clears either.
    url: v.optional(v.union(v.string(), v.null())),
    priceCents: v.optional(v.union(v.number(), v.null())),
    // The aisle a Member moved a grocery item to; it becomes the Group's own
    // choice for the item's name (APP-353).
    category: v.optional(groceryAisleValidator),
    // A grocery item's amount and unit (APP-309); null clears either.
    quantity: v.optional(v.union(v.number(), v.null())),
    unit: v.optional(v.union(groceryUnitValidator, v.null())),
  },
  handler: async (ctx, args) => {
    const {
      task,
      group,
      user,
      doc: list,
    } = await requireEditableTaskInGroup(ctx, args.groupSlug, args.taskId)
    const { taskId, title, dueDate, priority, labels, notes, done } = args
    const url = args.url === undefined ? undefined : checkedUrl(args.url)
    const priceCents =
      args.priceCents === undefined ? undefined : checkedPrice(args.priceCents)
    const onGroceryList = isGroceryList(group, list)
    // An aisle and an amount mean something only on a grocery list.
    let category = onGroceryList ? args.category : undefined
    const quantity =
      !onGroceryList || args.quantity === undefined
        ? undefined
        : args.quantity === null
          ? null
          : checkedQuantity(args.quantity)
    const unit = onGroceryList ? args.unit : undefined
    // Moving the due date moves the reminder by the same days (APP-305).
    const reminder =
      dueDate === undefined
        ? task.reminder
        : shiftedReminder(task.reminder, task.dueDate, dueDate ?? undefined)
    let askAi: Awaited<ReturnType<typeof recogniseGroceryTitle>> | null = null
    if (onGroceryList && category !== undefined) {
      await recordGroceryCorrection(
        ctx,
        group._id,
        user._id,
        title ?? task.title,
        category,
      )
    } else if (onGroceryList && title !== undefined && title !== task.title) {
      // A renamed item is a different item: find its aisle again.
      askAi = await recogniseGroceryTitle(
        ctx,
        group._id,
        groceryLineText(
          title,
          (quantity === undefined ? task.quantity : quantity) ?? undefined,
          (unit === undefined ? task.unit : unit) ?? undefined,
        ),
        await recentListItems(ctx, task.listId),
        task._id,
      )
      category = askAi.aisle
    }
    await ctx.db.patch(taskId, {
      ...(category !== undefined ? { category } : {}),
      ...(quantity !== undefined ? { quantity: quantity ?? undefined } : {}),
      ...(unit !== undefined ? { unit: unit ?? undefined } : {}),
      ...(url !== undefined ? { url: url ?? undefined } : {}),
      ...(priceCents !== undefined
        ? { priceCents: priceCents ?? undefined }
        : {}),
      ...(title !== undefined ? { title } : {}),
      ...(done !== undefined ? { done } : {}),
      ...(dueDate !== undefined ? { dueDate: dueDate ?? undefined } : {}),
      ...(priority !== undefined ? { priority: priority ?? undefined } : {}),
      ...(labels !== undefined ? { labels: labels ?? undefined } : {}),
      ...(notes !== undefined ? { notes: notes ?? undefined } : {}),
      ...(reminder !== task.reminder ? { reminder } : {}),
    })
    if (task.reminder && (reminder !== task.reminder || done !== undefined))
      await syncSend(
        ctx,
        { ...task, reminder, done: done ?? task.done },
        group._id,
        task.reminder,
      )
    if (askAi) await askAiOnce(ctx, group._id, askAi, taskId)
  },
})

/**
 * A link as stored: http or https only, so an app that opens it can never be
 * handed a `javascript:` or `file:` address. Null clears it.
 */
function checkedUrl(url: string | null): string | null {
  if (url === null || url.trim() === '') return null
  const normalized = normalizeTaskUrl(url)
  if (!normalized) throw new ConvexError('That is not a web address')
  return normalized
}

/** The highest price an item may carry: ten million, in cents. */
const PRICE_CENTS_MAX = 1_000_000_000

function checkedPrice(cents: number | null): number | null {
  if (cents === null) return null
  if (!Number.isInteger(cents) || cents < 0 || cents > PRICE_CENTS_MAX) {
    throw new ConvexError('That is not a price')
  }
  return cents
}

/** A grocery item's amount as stored: above zero, bounded, three decimals. */
function checkedQuantity(quantity: number): number {
  if (!isGroceryQuantity(quantity)) {
    throw new ConvexError('That is not an amount')
  }
  return roundGroceryQuantity(quantity)
}

/**
 * Check or uncheck many tasks of one list at once: a packing list's "Uncheck
 * all", and its undo. Without `taskIds` it is every task on the list; with
 * them, only those, and each must be on this list. Answers the ids it changed,
 * so the undo can put back exactly those and no others.
 */
export const setDoneInList = mutation({
  args: {
    listId: v.id('taskLists'),
    groupSlug: v.string(),
    done: v.boolean(),
    taskIds: v.optional(v.array(v.id('tasks'))),
  },
  returns: v.array(v.id('tasks')),
  handler: async (ctx, args) => {
    const { group } = await requireLocalList(ctx, args.groupSlug, args.listId)
    const rows = await ctx.db
      .query('tasks')
      .withIndex('by_list', (q) => q.eq('listId', args.listId))
      .collect()
    let targets = rows
    if (args.taskIds) {
      const onList = new Map(rows.map((task) => [task._id, task]))
      if (args.taskIds.some((id) => !onList.has(id))) {
        throw new ConvexError('Task not found')
      }
      targets = args.taskIds.map((id) => onList.get(id) as Doc<'tasks'>)
    }
    const changed = targets.filter((task) => task.done !== args.done)
    await Promise.all(
      changed.map((task) => ctx.db.patch(task._id, { done: args.done })),
    )
    for (const task of changed)
      if (task.reminder)
        await syncSend(ctx, { ...task, done: args.done }, group._id, task.reminder)
    return changed.map((task) => task._id)
  },
})

export const remove = mutation({
  args: { taskId: v.id('tasks'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    const task = await requireEditableTask(ctx, args.groupSlug, args.taskId)
    await cancelSend(ctx, task)
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
    await requireLocalList(ctx, args.groupSlug, args.listId)
    const rows = await ctx.db
      .query('tasks')
      .withIndex('by_list', (q) => q.eq('listId', args.listId))
      .collect()
    // Either every open task (a list that moves ticked items away) or every
    // task (a packing list, which keeps ticked items in place: APP-306).
    const open = rows.filter((task) => !task.done)
    const expected = new Set(
      (args.ids.length === rows.length ? rows : open).map((task) => task._id),
    )
    if (
      new Set(args.ids).size !== expected.size ||
      args.ids.length !== expected.size ||
      args.ids.some((id) => !expected.has(id))
    ) {
      throw new ConvexError('Reorder must contain every open task exactly once')
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

/** Into another local list of the same Group, at its end. */
export const moveToList = mutation({
  args: {
    taskId: v.id('tasks'),
    groupSlug: v.string(),
    listId: v.id('taskLists'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await requireEditableTask(ctx, args.groupSlug, args.taskId)
    if (task.listId === args.listId) return null
    const { group, doc: list } = await requireLocalList(
      ctx,
      args.groupSlug,
      args.listId,
    )
    const onGroceryList = isGroceryList(group, list)
    // Off a grocery list the amount goes back into the title ("2 pak melk"),
    // so it stays readable; onto one, an amount in the title is read out of
    // it again, and the item needs an aisle. The aisle means nothing off it.
    const line = groceryLineText(task.title, task.quantity, task.unit)
    const fields = onGroceryList
      ? task.quantity !== undefined || task.unit !== undefined
        ? { title: task.title, quantity: task.quantity, unit: task.unit }
        : groceryAddFields(task.title)
      : { title: line, quantity: undefined, unit: undefined }
    const grocery = onGroceryList
      ? await recogniseGroceryTitle(
          ctx,
          group._id,
          line,
          await recentListItems(ctx, args.listId),
        )
      : null
    await ctx.db.patch(task._id, {
      listId: args.listId,
      order: await endOfList(ctx, args.listId),
      category: grocery?.aisle,
      title: fields.title,
      quantity: fields.quantity,
      unit: fields.unit satisfies GroceryUnit | undefined,
    })
    if (grocery) await askAiOnce(ctx, group._id, grocery, task._id)
    return null
  },
})
