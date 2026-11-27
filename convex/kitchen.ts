import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import * as calendar from './calendar'
import { requireGroupBySlug, requireInGroup } from './lib/groupAccess'

/** The Pantry, alphabetical. */
export const pantry = query({
  args: { groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const pantry = await ctx.db
      .query('pantryEntries')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    return pantry.sort((a, b) => a.title.localeCompare(b.title))
  },
})

/** Which Task list the Group uses for groceries, if any. */
export const groceries = query({
  args: { groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    return { groceryListId: group.groceryListId ?? null }
  },
})

export const addMealEntry = mutation({
  args: {
    groupSlug: v.string(),
    title: v.string(),
    prepMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    return await ctx.db.insert('mealEntries', {
      groupId: group._id,
      title: args.title.trim(),
      prepMinutes: args.prepMinutes,
      createdBy: user._id,
    })
  },
})

export const removeMealEntry = mutation({
  args: { groupSlug: v.string(), id: v.id('mealEntries') },
  handler: async (ctx, args) => {
    await requireInGroup(ctx, args.groupSlug, args.id, 'Meal not found')
    await ctx.db.delete(args.id)
  },
})

export const updateMealEntry = mutation({
  args: {
    groupSlug: v.string(),
    id: v.id('mealEntries'),
    title: v.string(),
    prepMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireInGroup(ctx, args.groupSlug, args.id, 'Meal not found')
    await ctx.db.patch(args.id, {
      title: args.title.trim(),
      prepMinutes: args.prepMinutes,
    })
  },
})

export const addPantryEntry = mutation({
  args: {
    groupSlug: v.string(),
    title: v.string(),
    quantity: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    return await ctx.db.insert('pantryEntries', {
      groupId: group._id,
      title: args.title.trim(),
      quantity: args.quantity?.trim() || undefined,
      createdBy: user._id,
    })
  },
})

export const removePantryEntry = mutation({
  args: { groupSlug: v.string(), id: v.id('pantryEntries') },
  handler: async (ctx, args) => {
    await requireInGroup(ctx, args.groupSlug, args.id, 'Pantry entry not found')
    await ctx.db.delete(args.id)
  },
})

export const updatePantryEntry = mutation({
  args: {
    groupSlug: v.string(),
    id: v.id('pantryEntries'),
    title: v.string(),
    quantity: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireInGroup(ctx, args.groupSlug, args.id, 'Pantry entry not found')
    await ctx.db.patch(args.id, {
      title: args.title.trim(),
      quantity: args.quantity?.trim() || undefined,
    })
  },
})

/**
 * Which list the Groceries Module opens on an installed phone from before a
 * Group could have several grocery lists (APP-313), and the "use this list"
 * of a Group with none. A list picked here becomes a grocery list in its own
 * right (kind `groceries`), so it stays one once `groups.groceryListId` is
 * gone; unlinking leaves the list as it is.
 */
export const setGroceryList = mutation({
  args: { groupSlug: v.string(), listId: v.union(v.id('taskLists'), v.null()) },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    if (args.listId) {
      const { doc: list } = await requireInGroup(
        ctx,
        args.groupSlug,
        args.listId,
        'Task list not found',
      )
      if (list.kind !== 'groceries')
        await ctx.db.patch(list._id, { kind: 'groceries' })
    }
    await ctx.db.patch(group._id, { groceryListId: args.listId ?? undefined })
  },
})

// Installed phones call these by name until the next OTA has reached them
// (docs/migrations/README.md).
export const addCalendar = calendar.addCalendar
export const removeCalendar = calendar.removeCalendar
export const addCalendarEvent = calendar.addCalendarEvent
export const getCalendarEvent = calendar.getCalendarEvent
export const removeCalendarEvent = calendar.removeCalendarEvent
export const setCalendarVisibility = calendar.setCalendarVisibility
