/**
 * The aisle of an item on a Group's grocery list (APP-353), in the order the
 * design sets: the Group's own choice, the Group's history, the bundled
 * dictionary, the shared AI cache, then `other` — and for a name nobody knows,
 * one question to a small model, answered later (`groceryCategories.ts`).
 *
 * Everything here runs inside the mutation that adds or edits the item, so an
 * installed app that knows nothing of aisles still gets them.
 */

import {
  type GroceryAisle,
  groceryKey,
  parseGroceryLine,
  recogniseGroceryLine,
} from '@gather/core/groceries'
import { internal } from '../_generated/api'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { utcDay } from './aiUsage'
import { isAskableGroceryName } from './groceryAi'

/** Questions the AI fallback may ask per UTC day, across every Group. */
export const GROCERY_AI_DAILY_BUDGET = 300

/**
 * Questions one Group's items may cause per UTC day (APP-368): a tenth of the
 * global budget, so one busy Group leaves the rest for everyone else.
 */
export const GROCERY_AI_GROUP_DAILY_BUDGET = 30

/**
 * How many of a list's newest items are its history for a name (APP-368). An
 * add reads these instead of the whole list; a name not seen among them falls
 * through to the Group's corrections and the dictionary.
 */
export const GROCERY_HISTORY_WINDOW = 200

/** Items that may wait on one question; later ones stay in `other`. */
export const MAX_WAITING_ITEMS = 100

/** Groups that must make the same correction before the shared cache follows. */
export const CONSENSUS_GROUPS = 3

/** A question still out after this long is taken as lost and asked again. */
export const PENDING_STALE_MS = 60 * 60 * 1000

/**
 * Polling for an answer, which only `applyAnswer` jobs scheduled before
 * APP-368 still use: items now wait on the question itself.
 */
export const WAIT_FOR_ANSWER_MS = 30 * 1000
export const WAIT_FOR_ANSWER_TRIES = 6

/** The cache key of an item title: its name, amount and unit taken off. */
export function groceryTitleKey(title: string): string {
  return groceryKey(parseGroceryLine(title).name)
}

export function isGroceryList(
  group: Doc<'groups'>,
  listId: Id<'taskLists'>,
): boolean {
  return group.groceryListId === listId
}

/** A list's newest items, newest first: its history for recognition. */
export async function recentListItems(
  ctx: QueryCtx,
  listId: Id<'taskLists'>,
): Promise<Doc<'tasks'>[]> {
  return await ctx.db
    .query('tasks')
    .withIndex('by_list', (q) => q.eq('listId', listId))
    .order('desc')
    .take(GROCERY_HISTORY_WINDOW)
}

/** Today's question count for one Group. */
export async function groupUsage(ctx: QueryCtx, groupId: Id<'groups'>, day: string) {
  return await ctx.db
    .query('groceryAiGroupUsage')
    .withIndex('by_group_and_day', (q) => q.eq('groupId', groupId).eq('day', day))
    .unique()
}

/** Whether a question was taken, or which budget refused it. */
export type GroceryBudgetResult = 'taken' | 'global' | 'group'

/**
 * Take one question from today's global budget and the Group's, or refuse
 * when either is spent. Both counters move together, in one mutation.
 */
export async function takeGroceryAiBudget(
  ctx: MutationCtx,
  groupId: Id<'groups'> | undefined,
): Promise<GroceryBudgetResult> {
  const day = utcDay(Date.now())
  const global = await ctx.db
    .query('groceryAiUsage')
    .withIndex('by_day', (q) => q.eq('day', day))
    .unique()
  if (global && global.count >= GROCERY_AI_DAILY_BUDGET) return 'global'
  const group = groupId ? await groupUsage(ctx, groupId, day) : null
  if (group && group.count >= GROCERY_AI_GROUP_DAILY_BUDGET) return 'group'
  if (global) await ctx.db.patch(global._id, { count: global.count + 1 })
  else await ctx.db.insert('groceryAiUsage', { day, count: 1 })
  if (group) await ctx.db.patch(group._id, { count: group.count + 1 })
  else if (groupId) await ctx.db.insert('groceryAiGroupUsage', { groupId, day, count: 1 })
  return 'taken'
}

export async function findGroceryCache(ctx: QueryCtx, name: string) {
  return await ctx.db
    .query('groceryCategoryCache')
    .withIndex('by_name', (q) => q.eq('name', name))
    .unique()
}

async function findOverride(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  name: string,
) {
  return await ctx.db
    .query('groceryCategoryOverrides')
    .withIndex('by_group_and_name', (q) =>
      q.eq('groupId', groupId).eq('name', name),
    )
    .unique()
}

export interface GroceryRecognition {
  aisle: GroceryAisle
  key: string
  /** The readable name, which is what the model would be asked about. */
  cleanName: string
  /** Nothing knew the name and it may be sent to the model. */
  askAi: boolean
}

/**
 * The aisle for a title on a Group's grocery list. `recentItems` are the
 * list's newest rows, newest first (`recentListItems`); the first one with
 * the same name and an aisle is the Group's history for it.
 */
export async function recogniseGroceryTitle(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  title: string,
  recentItems: readonly Doc<'tasks'>[],
  exceptTaskId?: Id<'tasks'>,
): Promise<GroceryRecognition> {
  const key = groceryTitleKey(title)
  const override = key ? await findOverride(ctx, groupId, key) : null
  const cached = key ? await findGroceryCache(ctx, key) : null
  let history: GroceryAisle | undefined
  for (const task of recentItems) {
    if (task._id === exceptTaskId || !task.category || task.category === 'other')
      continue
    if (groceryTitleKey(task.title) === key) {
      history = task.category
      break
    }
  }

  const result = recogniseGroceryLine(title, {
    override: () => override?.aisle,
    history: () => history,
    cache: () => cached?.aisle,
  })
  return {
    aisle: result.aisle,
    key: result.key,
    cleanName: result.cleanName,
    askAi:
      result.source === 'none' &&
      result.key !== '' &&
      isAskableGroceryName(title) &&
      isAskableGroceryName(result.cleanName),
  }
}

/**
 * Ask the model about a name once: the first item claims the question and
 * schedules it; an item added while it is out joins the question's waiting
 * items and moves when the answer comes in, however late. The claim is a row
 * in the shared cache without an aisle, written in this mutation, so two
 * items racing cannot both ask.
 */
export async function askAiOnce(
  ctx: MutationCtx,
  groupId: Id<'groups'>,
  recognition: GroceryRecognition,
  taskId: Id<'tasks'>,
) {
  if (!recognition.askAi) return
  if (!process.env.ANTHROPIC_API_KEY) return
  const { key: name, cleanName } = recognition
  const now = Date.now()
  const row = await findGroceryCache(ctx, name)
  if (row?.aisle) return
  if (row && now - row.askedAt < PENDING_STALE_MS) {
    // Waiting costs no question, so it needs no budget.
    const waiting = row.waitingTaskIds ?? []
    if (waiting.length < MAX_WAITING_ITEMS && !waiting.includes(taskId))
      await ctx.db.patch(row._id, { waitingTaskIds: [...waiting, taskId] })
    return
  }
  // Today's questions are spent, globally or for this Group. `classify`
  // takes from both again; this only spares a scheduled run per item.
  const day = utcDay(now)
  const usage = await ctx.db
    .query('groceryAiUsage')
    .withIndex('by_day', (q) => q.eq('day', day))
    .unique()
  if (usage && usage.count >= GROCERY_AI_DAILY_BUDGET) return
  const mine = await groupUsage(ctx, groupId, day)
  if (mine && mine.count >= GROCERY_AI_GROUP_DAILY_BUDGET) return
  if (row) await ctx.db.patch(row._id, { askedAt: now })
  else
    await ctx.db.insert('groceryCategoryCache', {
      name,
      source: 'ai',
      askedAt: now,
    })
  await ctx.scheduler.runAfter(0, internal.groceryCategories.classify, {
    name,
    cleanName,
    taskId,
    groupId,
  })
}

/**
 * A Member put an item in another aisle: that is the Group's choice for the
 * name from now on. When enough Groups made the same choice for a name the
 * bundled dictionary does not know, and more Groups chose it than chose the
 * shared answer it would replace, the shared cache takes it too — whether or
 * not the model was ever asked.
 */
export async function recordGroceryCorrection(
  ctx: MutationCtx,
  groupId: Id<'groups'>,
  userId: Id<'users'>,
  title: string,
  aisle: GroceryAisle,
) {
  const name = groceryTitleKey(title)
  if (!name) return
  const now = Date.now()
  const override = await findOverride(ctx, groupId, name)
  if (override)
    await ctx.db.patch(override._id, { aisle, updatedBy: userId, updatedAt: now })
  else
    await ctx.db.insert('groceryCategoryOverrides', {
      groupId,
      name,
      aisle,
      updatedBy: userId,
      updatedAt: now,
    })

  // The cache is read only for names the dictionary does not know, so a
  // shared answer for any other name would never be used.
  if (recogniseGroceryLine(title).source === 'dictionary') return
  // What may not be sent to the model may not be shared either.
  if (!isAskableGroceryName(title)) return
  const cached = await findGroceryCache(ctx, name)
  if (cached?.aisle === aisle) return
  const agreeing = await groupsChoosing(ctx, name, aisle)
  if (
    agreeing.groups < CONSENSUS_GROUPS ||
    agreeing.people < CONSENSUS_GROUPS ||
    (cached?.aisle &&
      agreeing.groups <= (await groupsChoosing(ctx, name, cached.aisle)).groups)
  )
    return
  if (cached)
    await ctx.db.patch(cached._id, { aisle, source: 'consensus', answeredAt: now })
  else
    await ctx.db.insert('groceryCategoryCache', {
      name,
      aisle,
      source: 'consensus',
      askedAt: now,
      answeredAt: now,
    })
  console.log(`grocery-category consensus name="${name}" aisle=${aisle}`)
}

/** How many Groups, and how many people, chose this aisle for a name. */
async function groupsChoosing(
  ctx: QueryCtx,
  name: string,
  aisle: GroceryAisle,
) {
  const rows = await ctx.db
    .query('groceryCategoryOverrides')
    .withIndex('by_name_and_aisle', (q) => q.eq('name', name).eq('aisle', aisle))
    .take(500)
  return {
    groups: new Set(rows.map((row) => row.groupId)).size,
    people: new Set(rows.map((row) => row.updatedBy)).size,
  }
}

/**
 * Move an item out of `other` now that its name has an answer — unless a
 * Member already chose its aisle, or the Group's own choice for the name,
 * or renamed it to something else.
 */
export async function applyGroceryAnswer(
  ctx: MutationCtx,
  taskId: Id<'tasks'>,
  name: string,
  aisle: GroceryAisle,
): Promise<boolean> {
  const task = await ctx.db.get(taskId)
  if (!task || task.category !== 'other') return false
  if (groceryTitleKey(task.title) !== name) return false
  // A Member who put the name somewhere (`other` included) while the
  // question was out has the last word for their Group: the item goes where
  // they chose, not where the answer says.
  const list = await ctx.db.get(task.listId)
  const override = list ? await findOverride(ctx, list.groupId, name) : null
  const chosen = override?.aisle ?? aisle
  if (chosen === 'other') return false
  await ctx.db.patch(taskId, { category: chosen })
  return true
}
