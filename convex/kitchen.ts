import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import * as calendar from './calendar'
import {
  isVisibleToGroups,
  requireGroupBySlug,
  requireInGroup,
} from './lib/groupAccess'
import { quickLimitValidator } from './lib/kitchen'

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
    const [mealEntries, dinners, pantry, calendars, recipes] =
      await Promise.all([
        ctx.db
          .query('mealEntries')
          .withIndex('by_group', (q) => q.eq('groupId', group._id))
          .collect(),
        ctx.db
          .query('plannedDinners')
          .withIndex('by_group', (q) => q.eq('groupId', group._id))
          .collect(),
        ctx.db
          .query('pantryEntries')
          .withIndex('by_group', (q) => q.eq('groupId', group._id))
          .collect(),
        ctx.db
          .query('calendars')
          .withIndex('by_group', (q) => q.eq('groupId', group._id))
          .collect(),
        ctx.db.query('recipes').collect(),
      ])
    const visibleRecipes = recipes.filter((recipe) =>
      isVisibleToGroups(recipe, [group._id]),
    )
    const events = (
      await Promise.all(
        calendars.map((calendar) =>
          ctx.db
            .query('calendarEvents')
            .withIndex('by_calendar', (q) => q.eq('calendarId', calendar._id))
            .collect(),
        ),
      )
    )
      .flat()
      .filter(
        (event) =>
          (!args.from || event.date >= args.from) &&
          (!args.to || event.date <= args.to),
      )
    return {
      groceryListId: group.groceryListId ?? null,
      mealEntries,
      dinners: dinners
        .filter(
          (dinner) =>
            (!args.from || dinner.date >= args.from) &&
            (!args.to || dinner.date <= args.to),
        )
        // A live Recipe is the source of truth while it remains visible. The
        // stored fields are deliberately a fallback for a deleted/unshared
        // Recipe, so a past plan remains readable (ADR-0027).
        .map((dinner) => {
          const recipe = dinner.recipeId
            ? visibleRecipes.find(
                (candidate) => candidate._id === dinner.recipeId,
              )
            : undefined
          return recipe
            ? {
                ...dinner,
                title: recipe.title,
                prepMinutes: recipe.prepMinutes,
              }
            : dinner
        }),
      pantry: pantry.sort((a, b) => a.title.localeCompare(b.title)),
      recipes: visibleRecipes.map((recipe) => ({
        _id: recipe._id,
        title: recipe.title,
        prepMinutes: recipe.prepMinutes,
      })),
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
