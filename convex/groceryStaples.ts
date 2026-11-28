/**
 * Groceries "In stock" (APP-314, `designs/groceries/README.md` section 7): the
 * staples a household keeps, each in stock or running low. It replaces the
 * Pantry Module; the rules every writer shares are in `lib/groceryStaples.ts`.
 */

import { GROCERY_AISLES } from '@gather/core/groceries'
import { ConvexError, v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { recentListItems, recogniseGroceryTitle } from './lib/groceryCategories'
import {
  findStaple,
  groupToday,
  openKeysOn,
  putStapleOnList,
  STAPLE_NAME_MAX,
  stapleKey,
  writableGroceryList,
} from './lib/groceryStaples'
import { requireGroupBySlug, requireInGroup } from './lib/groupAccess'

const NOT_FOUND = 'Staple not found'

/**
 * The Group's staples in walking order (aisle, then name), the grocery list
 * running low puts them on, and for each whether it is on that list today: a
 * repeating item waiting for its next date is not (APP-989).
 */
export const list = query({
  args: { groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const [staples, list] = await Promise.all([
      ctx.db
        .query('groceryStaples')
        .withIndex('by_group', (q) => q.eq('groupId', group._id))
        .collect(),
      writableGroceryList(ctx, group),
    ])
    const open = list
      ? await openKeysOn(ctx, list._id, groupToday(group))
      : new Set<string>()
    const rank = (aisle: string) =>
      (GROCERY_AISLES as readonly string[]).indexOf(aisle)
    return {
      list: list ? { _id: list._id, name: list.name } : null,
      staples: staples
        .sort(
          (a, b) =>
            rank(a.aisle) - rank(b.aisle) || a.name.localeCompare(b.name),
        )
        .map((staple) => ({
          _id: staple._id,
          name: staple.name,
          aisle: staple.aisle,
          low: staple.low,
          note: staple.note,
          onList: open.has(staple.key),
        })),
    }
  },
})

/**
 * A new staple, in stock. A name the Group already keeps answers the staple
 * it has, so a double tap or a second Member adds nothing twice. A Member who
 * did not make it is remembered as keeping it too (APP-681), from any app.
 *
 * With `report` it answers whether this call made the row, so an undo takes
 * back only its own (APP-671). Without it, as installed apps call it, it
 * answers the id alone.
 */
export const add = mutation({
  args: {
    groupSlug: v.string(),
    name: v.string(),
    report: v.optional(v.boolean()),
  },
  returns: v.union(
    v.id('groceryStaples'),
    v.object({ id: v.id('groceryStaples'), created: v.boolean() }),
  ),
  handler: async (ctx, args) => {
    const answer = (id: Id<'groceryStaples'>, created: boolean) =>
      args.report ? { id, created } : id
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    const name = args.name.trim()
    if (!name || name.length > STAPLE_NAME_MAX)
      throw new ConvexError('That is not a name')
    const key = stapleKey(name)
    if (!key) throw new ConvexError('That is not a name')
    const existing = await findStaple(ctx, group._id, key)
    if (existing) {
      const { createdBy, keptBy = [] } = existing
      if (user._id !== createdBy && !keptBy.includes(user._id))
        await ctx.db.patch(existing._id, { keptBy: [...keptBy, user._id] })
      return answer(existing._id, false)
    }
    const list = await writableGroceryList(ctx, group)
    const { aisle } = await recogniseGroceryTitle(
      ctx,
      group._id,
      name,
      list ? await recentListItems(ctx, list._id) : [],
    )
    const id = await ctx.db.insert('groceryStaples', {
      groupId: group._id,
      name,
      key,
      aisle,
      low: false,
      createdBy: user._id,
    })
    return answer(id, true)
  },
})

/**
 * Running low, or back in stock. Running low puts the staple on the Group's
 * grocery list (once, bringing a waiting repeating copy forward); back in
 * stock leaves the list alone, since someone may be buying it right now.
 * Answers whether it is on the list.
 */
export const setLow = mutation({
  args: { groupSlug: v.string(), id: v.id('groceryStaples'), low: v.boolean() },
  handler: async (ctx, args) => {
    const {
      group,
      user,
      doc: staple,
    } = await requireInGroup(ctx, args.groupSlug, args.id, NOT_FOUND)
    if (staple.low !== args.low) await ctx.db.patch(staple._id, { low: args.low })
    if (!args.low) return { onList: false }
    return { onList: await putStapleOnList(ctx, group, staple, user._id) }
  },
})

/**
 * No longer a staple. Whatever is on the grocery list stays there. An undo of
 * `add` says `unlessLow` (APP-671): a staple somebody marked running low since
 * is in use, and one another Member added since is theirs too (APP-681). Both
 * stay.
 */
export const remove = mutation({
  args: {
    groupSlug: v.string(),
    id: v.id('groceryStaples'),
    unlessLow: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { doc: staple, user } = await requireInGroup(
      ctx,
      args.groupSlug,
      args.id,
      NOT_FOUND,
    )
    const inUse =
      staple.low || staple.keptBy?.some((keeper) => keeper !== user._id)
    if (args.unlessLow && inUse) return
    await ctx.db.delete(args.id)
  },
})
