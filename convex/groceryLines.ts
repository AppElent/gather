/**
 * Lines from a recipe (and later the week menu, APP-321) onto a grocery list
 * (APP-312, `designs/groceries/README.md` section 5).
 *
 * The phone reads each line with the local parser first (`@gather/core`
 * `readIngredientLine`) and keeps what it read; `read` is the AI fallback for
 * the lines it could not, one call against the person's daily cap. `add`
 * merges the lines into the open items already on the list (same name,
 * compatible unit: the amounts add up) and adds the rest, each carrying the
 * source as its note. The server never parses titles itself, so the phone
 * stays the one place a line becomes an amount (APP-309).
 */

import {
  type GroceryAddLine,
  groceryLineText,
  isGroceryQuantity,
  pendingItemId,
  planGroceryAdds,
  roundGroceryQuantity,
} from '@gather/core/groceries'
import { ConvexError, type Infer, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { action, mutation } from './_generated/server'
import { DAILY_AI_CALLS } from './lib/aiUsage'
import { anthropicApiKey } from './lib/anthropic'
import {
  askAiOnce,
  isGroceryList,
  recentListItems,
  recogniseGroceryTitle,
} from './lib/groceryCategories'
import { groceryUnitValidator } from './lib/groceryFields'
import {
  AI_LINE_LENGTH_MAX,
  AI_LINES_MAX,
  readGroceryLinesWithAi,
} from './lib/groceryLinesAi'
import { requireInGroup } from './lib/groupAccess'
import { requireIdentity } from './lib/sharing'

const aiReadLineValidator = v.object({
  name: v.string(),
  quantity: v.optional(v.number()),
  unit: v.optional(groceryUnitValidator),
})

const readResultValidator = v.union(
  v.object({
    status: v.literal('read'),
    used: v.number(),
    limit: v.number(),
    lines: v.array(v.union(aiReadLineValidator, v.null())),
  }),
  v.object({ status: v.literal('limit'), limit: v.number() }),
  v.object({ status: v.literal('unavailable') }),
)

/**
 * The lines the local parser could not read, read by the AI in one call that
 * counts against the person's daily cap. Over the cap, or without an answer,
 * nothing is read and the phone adds those lines as plain text.
 */
export const read = action({
  args: { lines: v.array(v.string()) },
  returns: readResultValidator,
  // Annotated: an action that runs an internal function would otherwise infer
  // its type from the generated api that includes it.
  handler: async (ctx, args): Promise<Infer<typeof readResultValidator>> => {
    const identity = await requireIdentity(ctx)
    const lines = args.lines
      .slice(0, AI_LINES_MAX)
      .map((line) => line.trim().slice(0, AI_LINE_LENGTH_MAX))
    if (lines.length === 0 || lines.some((line) => !line))
      throw new ConvexError('Nothing to read')
    const apiKey = anthropicApiKey()
    if (!apiKey) return { status: 'unavailable' as const }
    const used: number | null = await ctx.runMutation(internal.aiUsage.takeCounted, {
      clerkId: identity.subject,
    })
    if (used === null) return { status: 'limit' as const, limit: DAILY_AI_CALLS }
    const answer = await readGroceryLinesWithAi(lines, apiKey)
    if (!answer) return { status: 'unavailable' as const }
    return { status: 'read' as const, used, limit: DAILY_AI_CALLS, lines: answer }
  },
})

/** Lines one add may carry: a long recipe, or a week of them. */
const ADD_LINES_MAX = 100
/** A source label ("Shakshuka met feta") as the list's meta shows it. */
const SOURCE_LENGTH_MAX = 120

/**
 * Put lines on a grocery list: each merges into the open item with the same
 * name whose amount it adds up with, or is added at the end with its aisle.
 * A new item carries `source` as its note, and so does a merged one that had
 * none, so the list says which recipe it is for.
 */
export const add = mutation({
  args: {
    groupSlug: v.string(),
    listId: v.id('taskLists'),
    source: v.optional(v.string()),
    lines: v.array(
      v.object({
        title: v.string(),
        quantity: v.optional(v.number()),
        unit: v.optional(groceryUnitValidator),
      }),
    ),
  },
  returns: v.object({ added: v.number(), merged: v.number() }),
  handler: async (ctx, args) => {
    const {
      user,
      group,
      doc: list,
    } = await requireInGroup(ctx, args.groupSlug, args.listId, 'List not found')
    if (list.provider !== 'local') throw new ConvexError('This list is read-only')
    if (!isGroceryList(group, list))
      throw new ConvexError('This is not a grocery list')
    if (args.lines.length > ADD_LINES_MAX)
      throw new ConvexError('Too many lines at once')
    const lines = args.lines.map(checkedLine)
    const source = args.source?.trim().slice(0, SOURCE_LENGTH_MAX) || undefined

    const items = await ctx.db
      .query('tasks')
      .withIndex('by_list', (q) => q.eq('listId', args.listId))
      .collect()
    const plans = planGroceryAdds(
      items.map((item) => ({
        id: item._id,
        title: item.title,
        quantity: item.quantity,
        unit: item.unit,
        done: item.done,
      })),
      lines,
    )

    const recent = await recentListItems(ctx, args.listId)
    const last = await ctx.db
      .query('tasks')
      .withIndex('by_list_and_order', (q) => q.eq('listId', args.listId))
      .order('desc')
      .first()
    let order = last ? last.order + 1 : 0
    const inserted = new Map<string, Id<'tasks'>>()
    let added = 0
    let merged = 0
    for (const [index, plan] of plans.entries()) {
      const line = lines[index]
      if (plan.kind === 'merge') {
        const taskId = inserted.get(plan.into) ?? (plan.into as Id<'tasks'>)
        const task = await ctx.db.get(taskId)
        if (!task) continue
        await ctx.db.patch(taskId, {
          quantity: plan.to.quantity,
          unit: plan.to.unit,
          ...(plan.title !== undefined ? { title: plan.title } : {}),
          ...(source && !task.notes ? { notes: source } : {}),
        })
        merged++
        continue
      }
      const grocery = await recogniseGroceryTitle(
        ctx,
        group._id,
        groceryLineText(line.title, line.quantity, line.unit),
        recent,
      )
      const taskId = await ctx.db.insert('tasks', {
        listId: args.listId,
        title: line.title,
        done: false,
        createdBy: user._id,
        order: order++,
        category: grocery.aisle,
        ...(line.quantity !== undefined ? { quantity: line.quantity } : {}),
        ...(line.unit !== undefined ? { unit: line.unit } : {}),
        ...(source ? { notes: source } : {}),
      })
      await askAiOnce(ctx, group._id, grocery, taskId)
      inserted.set(pendingItemId(index), taskId)
      added++
    }
    return { added, merged }
  },
})

/** A line as stored: a title, and an amount above zero and bounded. */
function checkedLine(line: GroceryAddLine): GroceryAddLine {
  const title = line.title.trim()
  if (!title || title.length > 500) throw new ConvexError('That is not an item')
  if (line.quantity !== undefined && !isGroceryQuantity(line.quantity))
    throw new ConvexError('That is not an amount')
  return {
    title,
    ...(line.quantity !== undefined
      ? { quantity: roundGroceryQuantity(line.quantity) }
      : {}),
    ...(line.unit !== undefined ? { unit: line.unit } : {}),
  }
}
