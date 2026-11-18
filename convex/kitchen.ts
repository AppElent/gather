import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, type QueryCtx, query } from './_generated/server'
import * as calendar from './calendar'
import {
  isVisibleToGroups,
  requireGroupBySlug,
  requireInGroup,
} from './lib/groupAccess'
import { quickLimitValidator } from './lib/kitchen'
import { recipesVisibleIn } from './lib/recipeShares'

/**
 * A Group's planned dinners, by `by_group_date` when a range is given, with a
 * live Recipe's fields over the stored ones.
 *
 * A live Recipe is the source of truth while it remains visible. The stored
 * fields are deliberately a fallback for a deleted/unshared Recipe, so a past
 * plan remains readable (ADR-0027).
 */
async function dinnersIn(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  range: DateRange,
  visibleRecipes: ReadonlyMap<Id<'recipes'>, Doc<'recipes'>>,
) {
  const dinners = await ctx.db
    .query('plannedDinners')
    .withIndex('by_group_date', (q) => {
      const group = q.eq('groupId', groupId)
      if (range.from && range.to)
        return group.gte('date', range.from).lte('date', range.to)
      if (range.from) return group.gte('date', range.from)
      if (range.to) return group.lte('date', range.to)
      return group
    })
    .collect()
  return dinners.map((dinner) => {
    const recipe = dinner.recipeId
      ? visibleRecipes.get(dinner.recipeId)
      : undefined
    return recipe
      ? { ...dinner, title: recipe.title, prepMinutes: recipe.prepMinutes }
      : dinner
  })
}

/** The fields a dinner picker shows for a Recipe. */
function recipeCandidates(recipes: readonly Doc<'recipes'>[]) {
  return recipes.map((recipe) => ({
    _id: recipe._id,
    title: recipe.title,
    prepMinutes: recipe.prepMinutes,
  }))
}

interface DateRange {
  from?: string
  to?: string
}

async function plannerData(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  range: DateRange,
) {
  const [mealEntries, recipes] = await Promise.all([
    ctx.db
      .query('mealEntries')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect(),
    recipesVisibleIn(ctx, groupId),
  ])
  const byId = new Map(recipes.map((recipe) => [recipe._id, recipe]))
  return {
    mealEntries,
    dinners: await dinnersIn(ctx, groupId, range, byId),
    recipes: recipeCandidates(recipes),
  }
}

async function pantryOf(ctx: QueryCtx, groupId: Id<'groups'>) {
  const pantry = await ctx.db
    .query('pantryEntries')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .collect()
  return pantry.sort((a, b) => a.title.localeCompare(b.title))
}

/**
 * The meal planner: the Group's meals, the dinners of one week, and the
 * recipes a dinner can be picked from.
 */
export const planner = query({
  args: { groupSlug: v.string(), from: v.string(), to: v.string() },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    return await plannerData(ctx, group._id, args)
  },
})

/** The Pantry, alphabetical. */
export const pantry = query({
  args: { groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    return await pantryOf(ctx, group._id)
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

/**
 * Everything the kitchen screens once read in one query. Installed phones call
 * it until the OTA that calls `planner`, `pantry` and `groceries` has reached
 * them (docs/migrations/README.md); same arguments and result shape, but read
 * by index.
 */
export const overview = query({
  args: {
    groupSlug: v.string(),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { group, membership } = await requireGroupBySlug(
      ctx,
      args.groupSlug,
    )
    const range = { from: args.from, to: args.to }
    const [planned, pantry, calendars] = await Promise.all([
      plannerData(ctx, group._id, range),
      pantryOf(ctx, group._id),
      ctx.db
        .query('calendars')
        .withIndex('by_group', (q) => q.eq('groupId', group._id))
        .collect(),
    ])
    const events = (
      await Promise.all(
        calendars.map((calendar) =>
          ctx.db
            .query('calendarEvents')
            .withIndex('by_calendar_date', (q) => {
              const own = q.eq('calendarId', calendar._id)
              if (range.from && range.to)
                return own.gte('date', range.from).lte('date', range.to)
              if (range.from) return own.gte('date', range.from)
              if (range.to) return own.lte('date', range.to)
              return own
            })
            .collect(),
        ),
      )
    ).flat()
    return {
      groceryListId: group.groceryListId ?? null,
      mealEntries: planned.mealEntries,
      dinners: planned.dinners,
      pantry,
      recipes: planned.recipes,
      calendars,
      hiddenCalendarIds: membership?.hiddenCalendarIds ?? [],
      events,
    }
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

export const setDinner = mutation({
  args: {
    groupSlug: v.string(),
    date: v.string(),
    title: v.string(),
    prepMinutes: v.optional(v.number()),
    recipeId: v.optional(v.id('recipes')),
    mealEntryId: v.optional(v.id('mealEntries')),
    quickLimit: v.optional(quickLimitValidator),
  },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    if (
      Number(Boolean(args.recipeId)) + Number(Boolean(args.mealEntryId)) !==
      1
    )
      throw new ConvexError('A dinner needs exactly one candidate')
    let title = args.title
    let prepMinutes = args.prepMinutes
    if (args.mealEntryId) {
      const { doc: meal } = await requireInGroup(
        ctx,
        args.groupSlug,
        args.mealEntryId,
        'Meal not found',
      )
      title = meal.title
      prepMinutes = meal.prepMinutes
    } else if (args.recipeId) {
      const recipe = await ctx.db.get(args.recipeId)
      if (!recipe || !isVisibleToGroups(recipe, [group._id]))
        throw new ConvexError('Recipe not found')
      title = recipe.title
      prepMinutes = recipe.prepMinutes
    }
    const existing = await ctx.db
      .query('plannedDinners')
      .withIndex('by_group_date', (q) =>
        q.eq('groupId', group._id).eq('date', args.date),
      )
      .unique()
    const row = {
      recipeId: args.recipeId,
      mealEntryId: args.mealEntryId,
      title,
      prepMinutes,
      quickLimit: args.quickLimit,
    }
    if (existing) await ctx.db.patch(existing._id, row)
    else
      await ctx.db.insert('plannedDinners', {
        groupId: group._id,
        date: args.date,
        ...row,
      })
  },
})

export const clearDinner = mutation({
  args: { groupSlug: v.string(), date: v.string() },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const existing = await ctx.db
      .query('plannedDinners')
      .withIndex('by_group_date', (q) =>
        q.eq('groupId', group._id).eq('date', args.date),
      )
      .unique()
    if (existing) await ctx.db.delete(existing._id)
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

export const setGroceryList = mutation({
  args: { groupSlug: v.string(), listId: v.union(v.id('taskLists'), v.null()) },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    if (args.listId) {
      await requireInGroup(
        ctx,
        args.groupSlug,
        args.listId,
        'Task list not found',
      )
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
