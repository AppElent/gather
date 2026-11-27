/**
 * The AI fallback for grocery names the dictionary does not know (APP-353).
 *
 * `tasks.add` puts such an item in `other` at once and schedules `classify`
 * for its name (`lib/groceryCategories.ts`, `askAiOnce`). `classify` takes a
 * question from the global daily budget and the Group's share of it
 * (APP-368), asks a small model for the name
 * alone, stores the answer in the shared cache and moves the item. Every
 * function here is internal: none is reachable from a client.
 */

import type { GroceryAisle } from '@gather/core/groceries'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import {
  internalAction,
  internalMutation,
  internalQuery,
} from './_generated/server'
import { utcDay } from './lib/aiUsage'
import { anthropicApiKey } from './lib/anthropic'
import { askGroceryAisle, isAskableGroceryName } from './lib/groceryAi'
import {
  applyGroceryAnswer,
  findGroceryCache,
  GROCERY_AI_DAILY_BUDGET,
  GROCERY_AI_GROUP_DAILY_BUDGET,
  groupUsage,
  isPrunableGroceryCache,
  takeGroceryAiBudget,
  WAIT_FOR_ANSWER_MS,
  WAIT_FOR_ANSWER_TRIES,
} from './lib/groceryCategories'
import { groceryAisleValidator } from './lib/groceryFields'

export const classify = internalAction({
  args: {
    name: v.string(),
    cleanName: v.string(),
    taskId: v.id('tasks'),
    // Optional only for runs scheduled before APP-368 added the Group's cap.
    groupId: v.optional(v.id('groups')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const apiKey = anthropicApiKey()
    if (!apiKey) {
      console.warn('grocery-category: ANTHROPIC_API_KEY is not set; item stays in other')
      await ctx.runMutation(internal.groceryCategories.release, { name: args.name })
      return null
    }
    const taken = await ctx.runMutation(internal.groceryCategories.takeBudget, {
      groupId: args.groupId,
    })
    if (taken !== 'taken') {
      console.warn(
        taken === 'no-group'
          ? 'grocery-category: the Group is gone; nothing asked for it'
          : `grocery-category: ${taken} AI budget spent; item stays in other`,
      )
      // Only this Group is out of questions, or gone: another Group's waiting
      // item may still ask.
      await ctx.runMutation(internal.groceryCategories.release, {
        name: args.name,
        ...(taken !== 'global' && args.groupId
          ? {
              handOff: {
                cleanName: args.cleanName,
                refusedGroupId: args.groupId,
                askerTaskId: args.taskId,
              },
            }
          : {}),
      })
      return null
    }
    const aisle = await askGroceryAisle(args.cleanName, apiKey)
    if (!aisle) {
      console.warn('grocery-category: no answer; item stays in other')
      await ctx.runMutation(internal.groceryCategories.release, { name: args.name })
      return null
    }
    await ctx.runMutation(internal.groceryCategories.record, {
      name: args.name,
      aisle,
      taskId: args.taskId,
    })
    return null
  },
})

/**
 * Take one question from today's global budget and, for an item's question,
 * from its Group's; or refuse. A Group that is gone is refused too.
 */
export const takeBudget = internalMutation({
  args: { groupId: v.optional(v.id('groups')) },
  returns: v.union(
    v.literal('taken'),
    v.literal('global'),
    v.literal('group'),
    v.literal('no-group'),
  ),
  handler: async (ctx, args) => await takeGroceryAiBudget(ctx, args.groupId),
})

/**
 * Give up a claim that got no answer, so a later item may ask again. Items
 * that waited on it stay in `other`, as they would with no key at all —
 * unless only the asking Group was out of questions (`handOff`): then the
 * first waiting item of another Group takes the question over.
 */
export const release = internalMutation({
  args: {
    name: v.string(),
    handOff: v.optional(
      v.object({
        cleanName: v.string(),
        refusedGroupId: v.id('groups'),
        // The refused item waits too: the answer is shared, not spent.
        askerTaskId: v.id('tasks'),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await findGroceryCache(ctx, args.name)
    if (!row || row.aisle) return null
    const waiting = row.waitingTaskIds ?? []
    if (args.handOff)
      for (const [index, taskId] of waiting.entries()) {
        const task = await ctx.db.get(taskId)
        if (!task || task.category !== 'other') continue
        const list = await ctx.db.get(task.listId)
        if (!list || list.groupId === args.handOff.refusedGroupId) continue
        // A deleted Group's tasks wait for their step of the cascade.
        if (!(await ctx.db.get(list.groupId))) continue
        // Only a Group with questions left: two spent Groups must not hand
        // the question back and forth until midnight.
        const usage = await groupUsage(ctx, list.groupId, utcDay(Date.now()))
        if (usage && usage.count >= GROCERY_AI_GROUP_DAILY_BUDGET) continue
        await ctx.db.patch(row._id, {
          askedAt: Date.now(),
          waitingTaskIds: [
            args.handOff.askerTaskId,
            ...waiting.filter((_, other) => other !== index),
          ],
        })
        await ctx.scheduler.runAfter(0, internal.groceryCategories.classify, {
          name: args.name,
          cleanName: args.handOff.cleanName,
          taskId,
          groupId: list.groupId,
        })
        return null
      }
    await ctx.db.delete(row._id)
    return null
  },
})

/**
 * Store the model's answer and move the item that asked, with every item
 * that waited on the same question.
 */
export const record = internalMutation({
  args: {
    name: v.string(),
    aisle: groceryAisleValidator,
    taskId: v.id('tasks'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now()
    const row = await findGroceryCache(ctx, args.name)
    const items = [args.taskId, ...(row?.waitingTaskIds ?? [])]
    // Groups agreeing outrank the model; never overwrite their answer.
    const aisle = row?.source === 'consensus' && row.aisle ? row.aisle : args.aisle
    if (row)
      await ctx.db.patch(row._id, {
        ...(aisle === args.aisle ? { aisle, answeredAt: now } : {}),
        waitingTaskIds: undefined,
      })
    else
      await ctx.db.insert('groceryCategoryCache', {
        name: args.name,
        aisle,
        source: 'ai',
        askedAt: now,
        answeredAt: now,
      })
    let moved = 0
    for (const taskId of items)
      if (await applyGroceryAnswer(ctx, taskId, args.name, aisle)) moved++
    // The name stays out of the logs: they outlive the Group that typed it.
    console.log(`grocery-category ai aisle=${aisle} moved=${moved}`)
    return null
  },
})

/**
 * For an item added while its name's question was out: move it once the
 * answer is in, looking again a few times before leaving it in `other`.
 * Only runs scheduled before APP-368 reach this; items now wait on the
 * question's `waitingTaskIds`. Remove once none can be pending.
 */
export const applyAnswer = internalMutation({
  args: { taskId: v.id('tasks'), name: v.string(), tries: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await findGroceryCache(ctx, args.name)
    if (row?.aisle) {
      await applyGroceryAnswer(ctx, args.taskId, args.name, row.aisle)
      return null
    }
    if (row && args.tries < WAIT_FOR_ANSWER_TRIES)
      await ctx.scheduler.runAfter(
        WAIT_FOR_ANSWER_MS,
        internal.groceryCategories.applyAnswer,
        { ...args, tries: args.tries + 1 },
      )
    return null
  },
})

/**
 * Ask the model about names without storing anything: for measuring the
 * fallback against the eval set (`scripts/groceries/ask-ai.ts`) and for
 * trying the prompt. Spends from the same daily budget.
 */
export const askNames = internalAction({
  args: { names: v.array(v.string()) },
  returns: v.array(
    v.object({ name: v.string(), aisle: v.union(groceryAisleValidator, v.null()) }),
  ),
  handler: async (ctx, args) => {
    const apiKey = anthropicApiKey()
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set on this deployment')
    const answers: { name: string; aisle: GroceryAisle | null }[] = []
    for (const name of args.names.slice(0, 50)) {
      if (!isAskableGroceryName(name)) {
        answers.push({ name, aisle: null })
        continue
      }
      const taken = await ctx.runMutation(internal.groceryCategories.takeBudget, {})
      if (taken !== 'taken') throw new Error('daily grocery AI budget spent')
      answers.push({ name, aisle: await askGroceryAisle(name, apiKey) })
    }
    return answers
  },
})

/**
 * Rows `prune` reads per run; it schedules itself for the rest. Small, because
 * a consensus row reads up to 500 corrections to check it still stands.
 */
const PRUNE_PAGE_SIZE = 25

/**
 * Drop shared cache rows nothing backs any more (ADR-0049): run daily by
 * `crons.ts`, a page at a time. Items already sorted keep their aisle, which
 * is stored on the item.
 */
export const prune = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now()
    const page = await ctx.db
      .query('groceryCategoryCache')
      .paginate({ cursor: args.cursor ?? null, numItems: PRUNE_PAGE_SIZE })
    let removed = 0
    for (const row of page.page) {
      if (!(await isPrunableGroceryCache(ctx, row, now))) continue
      await ctx.db.delete(row._id)
      removed++
    }
    if (removed) console.log(`grocery-category prune removed=${removed}`)
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.groceryCategories.prune, {
        cursor: page.continueCursor,
      })
    return null
  },
})

/** Today's use of the budget, for the dashboard and the runbook. */
export const usage = internalQuery({
  args: {},
  returns: v.object({ day: v.string(), count: v.number(), budget: v.number() }),
  handler: async (ctx) => {
    const day = utcDay(Date.now())
    const row = await ctx.db
      .query('groceryAiUsage')
      .withIndex('by_day', (q) => q.eq('day', day))
      .unique()
    return { day, count: row?.count ?? 0, budget: GROCERY_AI_DAILY_BUDGET }
  },
})
