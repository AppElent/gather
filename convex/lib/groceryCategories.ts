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

/** Groups that must make the same correction before the shared cache follows. */
export const CONSENSUS_GROUPS = 3

/** A question still out after this long is taken as lost and asked again. */
export const PENDING_STALE_MS = 60 * 60 * 1000

/**
 * How long the model's answer for a name stays in the shared cache. The name
 * is text a Member typed, kept with no record of who typed it, so it must not
 * outlive the Group that typed it for long: the daily `prune` drops it after
 * this, and the next Group to type it asks again (ADR-0049).
 */
export const AI_ANSWER_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

/** How long a later item waits between looks at a question already out. */
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
 * The aisle for a title on a Group's grocery list. `listTasks` are the list's
 * rows, already read by the caller; the newest one with the same name and an
 * aisle is the Group's history for it.
 */
export async function recogniseGroceryTitle(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  title: string,
  listTasks: readonly Doc<'tasks'>[],
  exceptTaskId?: Id<'tasks'>,
): Promise<GroceryRecognition> {
  const key = groceryTitleKey(title)
  const override = key ? await findOverride(ctx, groupId, key) : null
  const cached = key ? await findGroceryCache(ctx, key) : null
  let history: GroceryAisle | undefined
  let newest = -1
  for (const task of listTasks) {
    if (task._id === exceptTaskId || !task.category || task.category === 'other')
      continue
    if (task._creationTime > newest && groceryTitleKey(task.title) === key) {
      history = task.category
      newest = task._creationTime
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
 * schedules it; an item added while it is out waits for the same answer. The
 * claim is a row in the shared cache without an aisle, written in this
 * mutation, so two items racing cannot both ask.
 */
export async function askAiOnce(
  ctx: MutationCtx,
  recognition: GroceryRecognition,
  taskId: Id<'tasks'>,
) {
  if (!recognition.askAi) return
  // Nothing to ask with: no key, or today's questions are spent. `classify`
  // checks both again; this only spares a scheduled run per unknown item.
  if (!process.env.ANTHROPIC_API_KEY) return
  const { key: name, cleanName } = recognition
  const now = Date.now()
  const usage = await ctx.db
    .query('groceryAiUsage')
    .withIndex('by_day', (q) => q.eq('day', utcDay(now)))
    .unique()
  if (usage && usage.count >= GROCERY_AI_DAILY_BUDGET) return
  const row = await findGroceryCache(ctx, name)
  if (row?.aisle) return
  if (row && now - row.askedAt < PENDING_STALE_MS) {
    await ctx.scheduler.runAfter(
      WAIT_FOR_ANSWER_MS,
      internal.groceryCategories.applyAnswer,
      { taskId, name, tries: 1 },
    )
    return
  }
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
  // The name stays out of the logs: they outlive the Group that typed it.
  console.log(`grocery-category consensus aisle=${aisle}`)
}

/** How many Groups, and how many people, chose this aisle for a name. */
export async function groupsChoosing(
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

/**
 * Whether the daily `prune` drops a shared cache row (ADR-0049): a question
 * that never got its answer, a model answer past its retention, or a
 * consensus that no longer stands because the Groups behind it deleted or
 * changed their choice. What is left is what Groups still back.
 */
export async function isPrunableGroceryCache(
  ctx: QueryCtx,
  row: Doc<'groceryCategoryCache'>,
  now: number,
): Promise<boolean> {
  if (!row.aisle) return now - row.askedAt >= PENDING_STALE_MS
  if (row.source === 'ai')
    return now - (row.answeredAt ?? row.askedAt) >= AI_ANSWER_RETENTION_MS
  const agreeing = await groupsChoosing(ctx, row.name, row.aisle)
  return agreeing.groups < CONSENSUS_GROUPS || agreeing.people < CONSENSUS_GROUPS
}
