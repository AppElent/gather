import { isIsoDate } from '@gather/core/civil-date'
import {
  type GroceryPurchase,
  type GroceryUnit,
  groceryAddFields,
  groceryHabits as groceryHabitsOf,
  groceryLineText,
  grocerySuggestions,
  isGroceryQuantity,
  roundGroceryQuantity,
} from '@gather/core/groceries'
import { taskRefusal } from '@gather/core/refusals'
import { inAnySmartList } from '@gather/core/smart-lists'
import { reorderedSubtasks, subtaskProgress } from '@gather/core/subtasks'
import { normalizeTaskUrl } from '@gather/core/task-lists'
import { clockMoment } from '@gather/core/task-reminders'
import { reanchorRepeat, type TaskRepeat } from '@gather/core/task-repeat'
import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { internalQuery, mutation, query } from './_generated/server'
import {
  askAiOnce,
  groceryTitleKey,
  isGroceryList,
  openItemNamed,
  recentListItems,
  recogniseGroceryTitle,
  recordGroceryCorrection,
  requireWritableGroceryList,
} from './lib/groceryCategories'
import {
  groceryAisleValidator,
  groceryUnitValidator,
} from './lib/groceryFields'
import { restockCheckedStaples } from './lib/groceryStaples'
import {
  findInGroup,
  requireGroupBySlug,
  requireInGroup,
} from './lib/groupAccess'
import { createOnce, idempotencyKeyValidator } from './lib/idempotency'
import {
  completeSubtasks,
  deleteSubtasks,
  recheckSubtasks,
  requireParentFor,
  subtasksOfTask,
} from './lib/subtasks'
import { assigneeChange, notifyAssignee } from './lib/taskAssignee'
import { taskPriorityValidator, taskRepeatValidator } from './lib/taskFields'
import {
  cancelSend,
  checkedClock,
  REMINDER_PASSED,
  REMINDER_SLACK_MS,
  shiftedReminder,
  syncSend,
  type TaskReminder,
} from './lib/taskReminders'
import {
  checkedRepeat,
  completeOccurrence,
  completionDay,
  completionsOf,
  firstDueDate,
  isRepeating,
  moveReminder,
  purgeCompletionsOfTask,
} from './lib/taskRepeat'
import { knownSectionId } from './lib/taskSections'

/**
 * What completing a repeating task answers: the history row it wrote, which
 * `undoCompletion` takes, and the due date the task moved to. `null` for any
 * other change.
 */
const completionResult = v.union(
  v.null(),
  v.object({ completionId: v.id('taskCompletions'), dueDate: v.string() }),
)

/**
 * The completer's calendar day, `YYYY-MM-DD`. Optional: an installed app from
 * before repeats sends none, and gets the day in the Netherlands.
 */
const todayArg = v.optional(v.string())

/**
 * A task checked or unchecked: checking stamps when, so a grocery list's
 * Recent can read its newest checked items; unchecking takes the stamp off
 * (APP-310).
 */
function doneFields(done: boolean) {
  return { done, doneAt: done ? Date.now() : undefined }
}

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
 * The open tasks the Tasks index's smart lists show (APP-301): due within
 * Upcoming's week or before, the caller's own, or nobody's on a list of jobs.
 * The rules are `@gather/core/smart-lists`; the phone sorts these rows into
 * Today, Mine, Upcoming and Unassigned and adds its linked lists' rows.
 *
 * Bounded by indexes: per local list of the Group, only its open rows
 * (`by_list_and_done`, APP-314). Never every task of the Group, so a grocery
 * list's years of checked items are not read. `today` is the caller's own
 * day, so a phone west of UTC sees its own Today.
 */
export const smartLists = query({
  args: { groupSlug: v.string(), today: v.string() },
  handler: async (ctx, args) => {
    const { user, group } = await requireGroupBySlug(ctx, args.groupSlug)
    if (!isIsoDate(args.today)) throw new ConvexError('Invalid date')
    const lists = await ctx.db
      .query('taskLists')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    const scope = { today: args.today, me: user._id as string }
    const perList = await Promise.all(
      lists
        .filter((list) => list.provider === 'local')
        .map(async (list) => {
          const of = {
            kind: list.kind ?? 'plain',
            grocery: isGroceryList(group, list),
          }
          const open = await ctx.db
            .query('tasks')
            .withIndex('by_list_and_done', (q) =>
              q.eq('listId', list._id).eq('done', false),
            )
            .collect()
          return open.filter((task) => inAnySmartList(task, of, scope))
        }),
    )
    const tasks = perList.flat()
    // APP-304: how far each row's subtasks are, and the title of the task a
    // subtask row belongs to. Installed apps from before subtasks read
    // neither and draw every row as before.
    const subtasks: { taskId: Id<'tasks'>; done: number; total: number }[] = []
    const parents: { taskId: Id<'tasks'>; title: string }[] = []
    const seenParents = new Set<Id<'tasks'>>()
    for (const task of tasks) {
      if (task.parentTaskId) {
        if (seenParents.has(task.parentTaskId)) continue
        seenParents.add(task.parentTaskId)
        const parent = await ctx.db.get(task.parentTaskId)
        if (parent) parents.push({ taskId: parent._id, title: parent.title })
        continue
      }
      const children = await ctx.db
        .query('tasks')
        .withIndex('by_parent', (q) => q.eq('parentTaskId', task._id))
        .collect()
      const progress = subtaskProgress(
        children.map((child) => ({ ...child, id: child._id })),
      ).get(task._id)
      if (progress) subtasks.push({ taskId: task._id, ...progress })
    }
    return { me: user._id, tasks, subtasks, parents }
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
    // How it repeats (APP-303). A fixed schedule without a due date starts on
    // its first day from `today`.
    repeat: v.optional(taskRepeatValidator),
    today: todayArg,
    // The Member responsible (APP-302); a current Member of the list's Group.
    assigneeId: v.optional(v.id('users')),
    // The section it is added to (APP-357). One the list does not have, and
    // none at all from an app older than sections, is "No section".
    sectionId: v.optional(v.string()),
    // The task it is a step of (APP-304): one on the same list that is not a
    // subtask itself. A subtask does not repeat and sits in its parent's
    // section.
    parentTaskId: v.optional(v.id('tasks')),
    idempotencyKey: idempotencyKeyValidator,
  },
  handler: async (ctx, args) => {
    const { user, group, doc: list } = await requireLocalList(
      ctx,
      args.groupSlug,
      args.listId,
    )
    const parent = args.parentTaskId
      ? await requireParentFor(ctx, list, args.parentTaskId)
      : null
    if (parent && args.repeat) {
      throw new ConvexError(taskRefusal('subtask-repeat'))
    }
    const quantity =
      args.quantity === undefined ? undefined : checkedQuantity(args.quantity)
    const onGroceryList = isGroceryList(group, list)
    const sectionId = parent
      ? parent.sectionId
      : knownSectionId(list, args.sectionId)
    // A list without amounts keeps an amount it was sent in the title, so
    // nothing a connected app wrote is dropped.
    const title = onGroceryList
      ? args.title
      : groceryLineText(args.title, quantity, args.unit)
    const today = completionDay(args.today)
    const repeat = args.repeat
      ? checkedRepeat(args.repeat, args.dueDate ?? today)
      : undefined
    const dueDate = repeat
      ? firstDueDate(repeat, args.dueDate, today)
      : args.dueDate
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
      const assignee =
        args.assigneeId === undefined
          ? null
          : await assigneeChange(ctx, {
              groupId: group._id,
              actorId: user._id,
              current: undefined,
              next: args.assigneeId,
            })
      const taskId = await ctx.db.insert('tasks', {
        listId: args.listId,
        title,
        done: false,
        dueDate,
        priority: args.priority,
        labels: args.labels,
        createdBy: user._id,
        order: await endOfList(ctx, args.listId),
        ...(grocery ? { category: grocery.aisle } : {}),
        ...(onGroceryList && quantity !== undefined ? { quantity } : {}),
        ...(onGroceryList && args.unit !== undefined ? { unit: args.unit } : {}),
        ...(repeat ? { repeat } : {}),
        ...(assignee ?? {}),
        ...(sectionId ? { sectionId } : {}),
        ...(parent ? { parentTaskId: parent._id } : {}),
      })
      if (grocery) await askAiOnce(ctx, group._id, grocery, taskId)
      await notifyAssignee(ctx, group._id, taskId, assignee)
      return taskId
    })
  },
})

/**
 * Tick a task, or untick it. Ticking an open repeating task completes its
 * occurrence instead: the task stays open with its next due date, and the
 * answer names the history row for `undoCompletion`. An installed app from
 * before repeats calls this too and gets the same result; it sees the task
 * come back with the new date.
 */
export const toggleDone = mutation({
  args: {
    taskId: v.id('tasks'),
    groupSlug: v.string(),
    today: todayArg,
    // "Complete all" (APP-304): checking a task checks its open subtasks
    // too. Absent — "Only this", and every app from before subtasks —
    // leaves them as they are.
    withSubtasks: v.optional(v.boolean()),
  },
  returns: completionResult,
  handler: async (ctx, args) => {
    const {
      task,
      group,
      user,
      doc: list,
    } = await requireEditableTaskInGroup(ctx, args.groupSlug, args.taskId)
    // A staple bought is back in stock (APP-314), once per tick, whether the
    // task closes or a repeating one moves on to its next occurrence.
    if (!task.done) await restockCheckedStaples(ctx, group, list, [task])
    if (!task.done && isRepeating(task)) {
      return await completeOccurrence(ctx, {
        task,
        groupId: group._id,
        userId: user._id,
        today: completionDay(args.today),
      })
    }
    await ctx.db.patch(args.taskId, doneFields(!task.done))
    if (task.reminder)
      await syncSend(ctx, { ...task, done: !task.done }, group._id, task.reminder)
    if (!task.done && args.withSubtasks)
      await completeSubtasks(ctx, task._id, group._id)
    return null
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

/**
 * Take back a repeating task's completion right after it: the due date goes
 * back to the one it was completed from, and the history row goes. Only the
 * task's latest completion can be undone, so one Member's undo never erases
 * another's later completion.
 */
export const undoCompletion = mutation({
  args: { completionId: v.id('taskCompletions'), groupSlug: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const completion = await ctx.db.get(args.completionId)
    if (!completion) {
      await requireGroupBySlug(ctx, args.groupSlug)
      throw new ConvexError('Nothing to undo')
    }
    const { task, group } = await requireEditableTaskInGroup(
      ctx,
      args.groupSlug,
      completion.taskId,
    )
    const [latest] = await completionsOf(ctx, task._id)
    if (latest?._id !== completion._id) {
      throw new ConvexError('Nothing to undo')
    }
    await ctx.db.patch(task._id, {
      dueDate: completion.previousDueDate,
      done: false,
    })
    await moveReminder(ctx, task, group._id, completion.previousDueDate)
    if (completion.reopenedSubtaskIds)
      await recheckSubtasks(
        ctx,
        task._id,
        group._id,
        completion.reopenedSubtaskIds,
      )
    await ctx.db.delete(completion._id)
    return null
  },
})

/** Who completed a repeating task and when, newest first (APP-303). */
export const completions = query({
  args: { taskId: v.id('tasks'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId)
    if (!task) {
      await requireGroupBySlug(ctx, args.groupSlug)
      throw new ConvexError('Task not found')
    }
    if (!(await findInGroup(ctx, args.groupSlug, task.listId))) {
      throw new ConvexError('Task not found')
    }
    const rows = await ctx.db
      .query('taskCompletions')
      .withIndex('by_task', (q) => q.eq('taskId', args.taskId))
      .order('desc')
      .take(COMPLETIONS_SHOWN)
    // By name, never by id; somebody who left reads as null.
    const names = new Map<Id<'users'>, string | null>()
    for (const row of rows) {
      if (!names.has(row.completedBy)) {
        names.set(row.completedBy, (await ctx.db.get(row.completedBy))?.name ?? null)
      }
    }
    return rows.map((row) => ({
      _id: row._id,
      completedAt: row.completedAt,
      completedOn: row.completedOn,
      byName: names.get(row.completedBy) ?? null,
    }))
  },
})

/** How much history the task screen shows; older rows are kept, not shown. */
const COMPLETIONS_SHOWN = 20

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
    // How it repeats (APP-303); null stops it. A moved due date carries a
    // monthly, yearly or one-weekday rule along with it.
    repeat: v.optional(v.union(taskRepeatValidator, v.null())),
    today: todayArg,
    // With done true on a repeating task: the due date the caller saw, so a
    // retry after the task moved on completes nothing twice.
    occurrence: v.optional(v.union(v.string(), v.null())),
    // The Member responsible (APP-302); null is nobody. Absent leaves it as
    // it is, which is what every client from before assignees sends.
    assigneeId: v.optional(v.union(v.id('users'), v.null())),
    // The task it is a step of (APP-304); null makes it a task of its own.
    // The same rules as `add`: same list, one level deep, no repeat.
    parentTaskId: v.optional(v.union(v.id('tasks'), v.null())),
    // With done true: check its open subtasks too ("Complete all").
    withSubtasks: v.optional(v.boolean()),
  },
  returns: completionResult,
  handler: async (ctx, args) => {
    const {
      task,
      group,
      user,
      doc: list,
    } = await requireEditableTaskInGroup(ctx, args.groupSlug, args.taskId)
    const { taskId, title, dueDate, priority, labels, notes, done } = args
    const parent = await parentChange(ctx, task, list, args.parentTaskId)
    const isSubtask =
      args.parentTaskId === undefined
        ? task.parentTaskId !== undefined
        : args.parentTaskId !== null
    if (isSubtask && (args.repeat || (args.repeat === undefined && task.repeat)))
      throw new ConvexError(taskRefusal('subtask-repeat'))
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
    const assignee =
      args.assigneeId === undefined
        ? null
        : await assigneeChange(ctx, {
            groupId: group._id,
            actorId: user._id,
            current: task.assigneeId,
            next: args.assigneeId,
          })
    // Moving the due date moves the reminder by the same days (APP-305).
    const reminder =
      dueDate === undefined
        ? task.reminder
        : shiftedReminder(task.reminder, task.dueDate, dueDate ?? undefined)
    // Done on an open repeating task keeps it open; its reminder moves with
    // the occurrence below.
    const completes = done === true && !task.done && willRepeat(task, args.repeat)
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
      // Done on an open repeating task completes its occurrence, below.
      ...(done !== undefined && !completes && done !== task.done
        ? doneFields(done)
        : {}),
      ...(dueDate !== undefined ? { dueDate: dueDate ?? undefined } : {}),
      ...(priority !== undefined ? { priority: priority ?? undefined } : {}),
      ...(labels !== undefined ? { labels: labels ?? undefined } : {}),
      ...(notes !== undefined ? { notes: notes ?? undefined } : {}),
      ...(assignee ?? {}),
      ...(reminder !== task.reminder ? { reminder } : {}),
      ...(parent ?? {}),
    })
    if (task.reminder && (reminder !== task.reminder || done !== undefined))
      await syncSend(
        ctx,
        { ...task, reminder, done: completes ? task.done : (done ?? task.done) },
        group._id,
        task.reminder,
      )
    if (askAi) await askAiOnce(ctx, group._id, askAi, taskId)
    if (done === true && !task.done)
      await restockCheckedStaples(ctx, group, list, [
        { title: title ?? task.title },
      ])
    if (done === true && !task.done && args.withSubtasks && !completes)
      await completeSubtasks(ctx, taskId, group._id)
    await notifyAssignee(ctx, group._id, taskId, assignee)

    const today = completionDay(args.today)
    const repeatPatch = repeatChange(task, args.repeat, dueDate, today)
    if (repeatPatch) await ctx.db.patch(taskId, repeatPatch)

    // Completing a repeating task moves it on rather than closing it.
    if (done === true && !task.done) {
      const current = await ctx.db.get(taskId)
      if (current && isRepeating(current)) {
        return await completeOccurrence(ctx, {
          task: current,
          groupId: group._id,
          userId: user._id,
          today,
          occurrence: args.occurrence,
        })
      }
    }
    return null
  },
})

/**
 * The assignee opened the task: its notice is seen. Anyone else opening it
 * changes nothing, and neither does a task with no notice.
 */
export const markAssignmentSeen = mutation({
  args: { taskId: v.id('tasks'), groupSlug: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { task, user } = await requireEditableTaskInGroup(
      ctx,
      args.groupSlug,
      args.taskId,
    )
    if (task.assignmentNotice && task.assigneeId === user._id) {
      await ctx.db.patch(task._id, { assignmentNotice: undefined })
    }
    return null
  },
})

/**
 * The parent fields an update writes (APP-304), or null when it changes no
 * parent. Becoming a subtask: the parent is on the same list and not a
 * subtask, the task has no subtasks of its own, and it takes the parent's
 * section. Null makes it a task of its own again, where it is.
 */
async function parentChange(
  ctx: MutationCtx,
  task: Doc<'tasks'>,
  list: Doc<'taskLists'>,
  parentTaskId: Id<'tasks'> | null | undefined,
): Promise<Pick<Doc<'tasks'>, 'parentTaskId' | 'sectionId'> | null> {
  if (parentTaskId === undefined) return null
  if (parentTaskId === null) {
    return task.parentTaskId ? { parentTaskId: undefined } : null
  }
  if (parentTaskId === task.parentTaskId) return null
  if (parentTaskId === task._id)
    throw new ConvexError(taskRefusal('subtask-depth'))
  const parent = await requireParentFor(ctx, list, parentTaskId)
  if ((await subtasksOfTask(ctx, task._id)).length > 0)
    throw new ConvexError(taskRefusal('subtask-depth'))
  return { parentTaskId: parent._id, sectionId: parent.sectionId }
}

/** Whether the task repeats once this update's repeat change is applied. */
function willRepeat(task: Doc<'tasks'>, repeat: TaskRepeat | null | undefined) {
  return repeat === undefined ? task.repeat !== undefined : repeat !== null
}

/**
 * The repeat fields an update writes: a new rule (anchored on the due date,
 * and giving a fixed rule without one its first day), none, or the old rule
 * following a moved due date. `undefined` when nothing about the repeat
 * changes.
 */
function repeatChange(
  task: Doc<'tasks'>,
  repeat: TaskRepeat | null | undefined,
  dueDate: string | null | undefined,
  today: string,
): Partial<Pick<Doc<'tasks'>, 'repeat' | 'dueDate'>> | undefined {
  const due = dueDate === undefined ? task.dueDate : (dueDate ?? undefined)
  if (repeat === null) return task.repeat ? { repeat: undefined } : undefined
  if (repeat) {
    const rule = checkedRepeat(repeat, due ?? today)
    const first = firstDueDate(rule, due, today)
    return { repeat: rule, ...(first !== due ? { dueDate: first } : {}) }
  }
  // Only a due date that moved re-anchors: the same date sent again (a sheet
  // confirmed unchanged, an agent echoing what it read) keeps a rule on the
  // 31st that is waiting on the 30th.
  if (task.repeat && typeof dueDate === 'string' && dueDate !== task.dueDate) {
    return { repeat: reanchorRepeat(task.repeat, dueDate) }
  }
  return undefined
}

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
    const { group, doc: list } = await requireLocalList(
      ctx,
      args.groupSlug,
      args.listId,
    )
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
      changed.map((task) => ctx.db.patch(task._id, doneFields(args.done))),
    )
    for (const task of changed)
      if (task.reminder)
        await syncSend(ctx, { ...task, done: args.done }, group._id, task.reminder)
    if (args.done) await restockCheckedStaples(ctx, group, list, changed)
    return changed.map((task) => task._id)
  },
})

export const remove = mutation({
  args: { taskId: v.id('tasks'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    const task = await requireEditableTask(ctx, args.groupSlug, args.taskId)
    // A parent's subtasks go with it (APP-304), after the same confirm.
    await deleteSubtasks(ctx, task._id)
    await cancelSend(ctx, task)
    await purgeCompletionsOfTask(ctx, args.taskId)
    await ctx.db.delete(args.taskId)
  },
})

export const reorder = mutation({
  args: {
    listId: v.id('taskLists'),
    groupSlug: v.string(),
    ids: v.array(v.id('tasks')),
    // APP-357: each task's section after the drag, by position in `ids`
    // (null is "No section"). Absent from an app older than sections, which
    // leaves every task in the section it was in.
    sectionIds: v.optional(v.array(v.union(v.string(), v.null()))),
  },
  handler: async (ctx, args) => {
    const { doc: list } = await requireLocalList(
      ctx,
      args.groupSlug,
      args.listId,
    )
    const sectionIds = args.sectionIds
    if (sectionIds && sectionIds.length !== args.ids.length) {
      throw new ConvexError('Every task needs its section')
    }
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
    await Promise.all(
      args.ids.map((id, order) =>
        ctx.db.patch(id, {
          order,
          ...(sectionIds
            ? { sectionId: knownSectionId(list, sectionIds[order]) }
            : {}),
        }),
      ),
    )
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
    // From one grocery list to another (one per store, APP-313) the item
    // keeps the aisle it has: the aisle is the item's, the order the store's.
    const from = await ctx.db.get(task.listId)
    const keptAisle =
      onGroceryList && from && isGroceryList(group, from)
        ? task.category
        : undefined
    const grocery =
      onGroceryList && !keptAisle
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
      category: keptAisle ?? grocery?.aisle,
      title: fields.title,
      quantity: fields.quantity,
      unit: fields.unit satisfies GroceryUnit | undefined,
      // A section belongs to its list; on another list the task has none.
      sectionId: undefined,
      // A subtask moved on its own leaves its parent behind (APP-304).
      parentTaskId: undefined,
    })
    if (grocery) await askAiOnce(ctx, group._id, grocery, task._id)
    // A parent takes its subtasks along, in their order, behind it.
    const subtasks = (await subtasksOfTask(ctx, task._id)).sort(
      (a, b) => a.order - b.order,
    )
    for (const subtask of subtasks) {
      await ctx.db.patch(subtask._id, {
        listId: args.listId,
        order: await endOfList(ctx, args.listId),
        sectionId: undefined,
        ...(onGroceryList ? {} : { category: undefined }),
      })
    }
    return null
  },
})

/** How many checked items a Group's Recent holds (`designs/groceries` §4). */
export const RECENT_GROCERIES_LIMIT = 100

/**
 * How many of each grocery list's newest checked items Recent reads: twice
 * the limit, so a name checked as two separate items still leaves room for
 * a hundred different ones.
 */
const RECENT_GROCERIES_WINDOW = 2 * RECENT_GROCERIES_LIMIT

/**
 * A Group's Recent (APP-310): the checked items of its grocery lists, newest
 * first, one per name (the newest), at most `RECENT_GROCERIES_LIMIT`. There is
 * no table of its own: an item stays a checked task, and each grocery list is
 * read through `by_list_and_done_at` from its newest check down, so the read
 * is bounded by twice the limit per grocery list of the Group.
 *
 * Items checked before `doneAt` existed have no stamp. They come after every
 * stamped item, newest added first, with the moment they were added standing
 * in for when they were checked: read from the same index's no-stamp range
 * (`doneAt` undefined), which also holds the open items, so it is bounded by
 * the same window per list. No data is rewritten for them.
 */
export const recentGroceries = query({
  args: { groupSlug: v.string() },
  returns: v.array(
    v.object({
      _id: v.id('tasks'),
      listId: v.id('taskLists'),
      title: v.string(),
      quantity: v.optional(v.number()),
      unit: v.optional(groceryUnitValidator),
      category: v.optional(groceryAisleValidator),
      doneAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const lists = await ctx.db
      .query('taskLists')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    const grocery = lists.filter(
      (list) => list.provider === 'local' && isGroceryList(group, list),
    )
    const window = (list: Doc<'taskLists'>, stamped: boolean) =>
      ctx.db
        .query('tasks')
        .withIndex('by_list_and_done_at', (q) =>
          stamped
            ? q.eq('listId', list._id).gt('doneAt', 0)
            : q.eq('listId', list._id).eq('doneAt', undefined),
        )
        .order('desc')
        .take(RECENT_GROCERIES_WINDOW)
    const [stamped, legacy] = await Promise.all([
      Promise.all(grocery.map((list) => window(list, true))),
      Promise.all(grocery.map((list) => window(list, false))),
    ])
    const checked = [
      ...stamped
        .flat()
        .filter((task) => task.done && task.doneAt !== undefined)
        .map((task) => ({ task, at: task.doneAt ?? 0 }))
        .sort((a, b) => b.at - a.at),
      ...legacy
        .flat()
        .filter((task) => task.done)
        .map((task) => ({ task, at: task._creationTime }))
        .sort((a, b) => b.at - a.at),
    ]
    const seen = new Set<string>()
    const recent = []
    for (const { task, at } of checked) {
      const key = groceryTitleKey(task.title)
      if (seen.has(key)) continue
      seen.add(key)
      recent.push({
        _id: task._id,
        listId: task.listId,
        title: task.title,
        quantity: task.quantity,
        unit: task.unit,
        category: task.category,
        doneAt: at,
      })
      if (recent.length === RECENT_GROCERIES_LIMIT) break
    }
    return recent
  },
})

/**
 * How many of each grocery list's newest checked items the habits read
 * (APP-311): enough for a year of weekly shopping of a full list.
 */
const GROCERY_HABITS_WINDOW = 1000

/** How many names the composer's history completes from. */
const GROCERY_HABITS_LIMIT = 300

const groceryHabitValidator = v.object({
  key: v.string(),
  title: v.string(),
  count: v.number(),
  intervalDays: v.union(v.number(), v.null()),
  lastAt: v.number(),
  quantity: v.optional(v.number()),
  unit: v.optional(groceryUnitValidator),
  category: v.optional(groceryAisleValidator),
})

/**
 * What the Group usually buys, for one of its grocery lists (APP-311;
 * `designs/groceries/README.md`, section 1 item 2 and section 2):
 *
 * - `habits`: every name its grocery lists had checked, most bought first,
 *   with the usual interval and amount: the composer completes from them.
 * - `suggestions`: the "Maybe needed" strip, computed here by the plain rule
 *   in `@gather/core/groceries` (`grocerySuggestions`), no AI: bought at least
 *   three times, the usual interval has passed, not open on this list, not
 *   hidden from it, at most eight. Empty when the list has them switched off.
 *
 * History is the checked items of the Group's grocery lists, as Recent reads
 * it (`by_list_and_done_at`, no table of its own), bounded per list. Items
 * checked before `doneAt` existed count at the moment they were added. The
 * "now" a query sees is when it last ran: the strip moves on with the next
 * change to the Group's grocery lists or the next time it is opened.
 */
export const groceryHabits = query({
  args: { groupSlug: v.string(), listId: v.id('taskLists') },
  returns: v.object({
    habits: v.array(groceryHabitValidator),
    suggestions: v.array(groceryHabitValidator),
  }),
  handler: async (ctx, args) => {
    const { group, doc: target } = await requireInGroup(
      ctx,
      args.groupSlug,
      args.listId,
      'List not found',
    )
    if (target.provider !== 'local' || !isGroceryList(group, target)) {
      return { habits: [], suggestions: [] }
    }
    const lists = await ctx.db
      .query('taskLists')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    const grocery = lists.filter(
      (list) => list.provider === 'local' && isGroceryList(group, list),
    )
    const window = (list: Doc<'taskLists'>, stamped: boolean) =>
      ctx.db
        .query('tasks')
        .withIndex('by_list_and_done_at', (q) =>
          stamped
            ? q.eq('listId', list._id).gt('doneAt', 0)
            : q.eq('listId', list._id).eq('doneAt', undefined),
        )
        .order('desc')
        .take(GROCERY_HABITS_WINDOW)
    const [stamped, unstamped] = await Promise.all([
      Promise.all(grocery.map((list) => window(list, true))),
      Promise.all(grocery.map((list) => window(list, false))),
    ])
    const purchases: GroceryPurchase[] = [
      ...stamped.flat().filter((task) => task.done),
      ...unstamped.flat().filter((task) => task.done),
    ].map((task) => ({
      key: groceryTitleKey(task.title),
      title: task.title,
      at: task.doneAt ?? task._creationTime,
      ...(task.quantity !== undefined ? { quantity: task.quantity } : {}),
      ...(task.unit !== undefined ? { unit: task.unit } : {}),
      ...(task.category !== undefined ? { category: task.category } : {}),
    }))
    const habits = groceryHabitsOf(purchases)
    if (target.suggestionsOff) {
      return { habits: habits.slice(0, GROCERY_HABITS_LIMIT), suggestions: [] }
    }
    // What is open on the list now: the open rows sit in the no-stamp range.
    const onList = unstamped[grocery.findIndex((list) => list._id === target._id)]
      .filter((task) => !task.done)
      .map((task) => groceryTitleKey(task.title))
    const exclude = new Set([...onList, ...(target.hiddenSuggestions ?? [])])
    return {
      habits: habits.slice(0, GROCERY_HABITS_LIMIT),
      suggestions: grocerySuggestions(habits, { now: Date.now(), exclude }),
    }
  },
})

/**
 * A checked grocery item back onto a grocery list from Recent (APP-310), with
 * its amount, unit and aisle. A copy is added and the checked item stays as
 * it was, so the Group's history keeps that purchase (APP-311 reads it), on
 * its own list too. When an open item of the same name is already on the
 * list, however old, nothing is added and that item is the answer: a second
 * tap, or a second Member, never makes a duplicate (APP-403).
 *
 * Both lists must be grocery lists of the Group that Gather can write to.
 * Refusals are keyed (`@gather/core/refusals`, `tasks:*`); installed phones
 * only play the failure haptic on any error, so the keys change nothing they
 * show.
 */
export const putBack = mutation({
  args: {
    taskId: v.id('tasks'),
    groupSlug: v.string(),
    listId: v.id('taskLists'),
  },
  returns: v.id('tasks'),
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    const task = await ctx.db.get(args.taskId)
    const source = task ? await ctx.db.get(task.listId) : null
    if (!task || !source || source.groupId !== group._id)
      throw new ConvexError(taskRefusal('not-found'))
    requireWritableGroceryList(group, source)
    const list = await ctx.db.get(args.listId)
    if (!list || list.groupId !== group._id)
      throw new ConvexError(taskRefusal('not-found'))
    requireWritableGroceryList(group, list)
    const open = await openItemNamed(ctx, args.listId, task.title)
    if (open) return open._id
    const order = await endOfList(ctx, args.listId)
    return await ctx.db.insert('tasks', {
      listId: args.listId,
      title: task.title,
      done: false,
      createdBy: user._id,
      order,
      ...(task.category ? { category: task.category } : {}),
      ...(task.quantity !== undefined ? { quantity: task.quantity } : {}),
      ...(task.unit !== undefined ? { unit: task.unit } : {}),
    })
  },
})

/**
 * Into a section of its own list, or out of every section with null
 * (APP-357). It goes last in its new section.
 */
export const setSection = mutation({
  args: {
    taskId: v.id('tasks'),
    groupSlug: v.string(),
    sectionId: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { task, doc: list } = await requireEditableTaskInGroup(
      ctx,
      args.groupSlug,
      args.taskId,
    )
    const sectionId = knownSectionId(list, args.sectionId)
    if (args.sectionId !== null && sectionId === undefined) {
      throw new ConvexError('Section not found')
    }
    if ((task.sectionId ?? undefined) === sectionId) return null
    await ctx.db.patch(task._id, {
      sectionId,
      order: await endOfList(ctx, task.listId),
    })
    // Its subtasks go along, so an app from before subtasks, which draws
    // them as rows, still finds them in the parent's section (APP-304).
    for (const subtask of await subtasksOfTask(ctx, task._id)) {
      await ctx.db.patch(subtask._id, { sectionId })
    }
    return null
  },
})

/**
 * One task's subtasks in a new order (APP-304), from its detail screen. They
 * swap the order values they already hold, so nothing else on the list moves.
 * `ids` must be every subtask of the task, once each.
 */
export const reorderSubtasks = mutation({
  args: {
    taskId: v.id('tasks'),
    groupSlug: v.string(),
    ids: v.array(v.id('tasks')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { task } = await requireEditableTaskInGroup(
      ctx,
      args.groupSlug,
      args.taskId,
    )
    const siblings = await subtasksOfTask(ctx, task._id)
    const next = reorderedSubtasks(
      siblings.map((subtask) => ({ ...subtask, id: subtask._id })),
      args.ids,
    )
    if (!next) throw new ConvexError('Reorder must contain every subtask once')
    for (const { id, order } of next) {
      await ctx.db.patch(id as Id<'tasks'>, { order })
    }
    return null
  },
})
