import { ConvexError, v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { requireGroupBySlug } from './lib/groupAccess'

const quickLimit = v.union(v.literal(10), v.literal(20), v.literal(30))

async function calendarInGroup(
  ctx: Parameters<typeof requireGroupBySlug>[0],
  groupSlug: string,
  calendarId: Id<'calendars'>,
) {
  const { group, user } = await requireGroupBySlug(ctx, groupSlug)
  const calendar = await ctx.db.get(calendarId)
  if (!calendar || calendar.groupId !== group._id)
    throw new ConvexError('Calendar not found')
  return { group, user, calendar }
}

export const overview = query({
  args: {
    groupSlug: v.string(),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
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
    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .filter((q) => q.eq(q.field('userId'), user._id))
      .first()
    const visibleRecipes = recipes.filter(
      (recipe) =>
        recipe.groupId === group._id ||
        recipe.sharedGroupIds.includes(group._id),
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
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const entry = await ctx.db.get(args.id)
    if (!entry || entry.groupId !== group._id)
      throw new ConvexError('Meal not found')
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
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const entry = await ctx.db.get(args.id)
    if (!entry || entry.groupId !== group._id)
      throw new ConvexError('Meal not found')
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
    quickLimit: v.optional(quickLimit),
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
      const meal = await ctx.db.get(args.mealEntryId)
      if (!meal || meal.groupId !== group._id)
        throw new ConvexError('Meal not found')
      title = meal.title
      prepMinutes = meal.prepMinutes
    } else if (args.recipeId) {
      const recipe = await ctx.db.get(args.recipeId)
      if (
        !recipe ||
        (recipe.groupId !== group._id &&
          !recipe.sharedGroupIds.includes(group._id))
      )
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
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const entry = await ctx.db.get(args.id)
    if (!entry || entry.groupId !== group._id)
      throw new ConvexError('Pantry entry not found')
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
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const entry = await ctx.db.get(args.id)
    if (!entry || entry.groupId !== group._id)
      throw new ConvexError('Pantry entry not found')
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
      const list = await ctx.db.get(args.listId)
      if (!list || list.groupId !== group._id)
        throw new ConvexError('Task list not found')
    }
    await ctx.db.patch(group._id, { groceryListId: args.listId ?? undefined })
  },
})

export const addCalendar = mutation({
  args: { groupSlug: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    return await ctx.db.insert('calendars', {
      groupId: group._id,
      name: args.name.trim(),
      source: 'local',
      createdBy: user._id,
    })
  },
})

export const removeCalendar = mutation({
  args: { groupSlug: v.string(), id: v.id('calendars') },
  handler: async (ctx, args) => {
    const { calendar } = await calendarInGroup(ctx, args.groupSlug, args.id)
    const events = await ctx.db
      .query('calendarEvents')
      .withIndex('by_calendar', (q) => q.eq('calendarId', calendar._id))
      .collect()
    await Promise.all(events.map((event) => ctx.db.delete(event._id)))
    await ctx.db.delete(calendar._id)
    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_group', (q) => q.eq('groupId', calendar.groupId))
      .collect()
    await Promise.all(
      memberships.map((membership) =>
        ctx.db.patch(membership._id, {
          hiddenCalendarIds: (membership.hiddenCalendarIds ?? []).filter(
            (id) => id !== calendar._id,
          ),
        }),
      ),
    )
  },
})

export const addCalendarEvent = mutation({
  args: {
    groupSlug: v.string(),
    calendarId: v.id('calendars'),
    title: v.string(),
    date: v.string(),
    startMinutes: v.optional(v.number()),
    endMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { calendar, user } = await calendarInGroup(
      ctx,
      args.groupSlug,
      args.calendarId,
    )
    if (
      (args.startMinutes === undefined) !== (args.endMinutes === undefined) ||
      (args.startMinutes !== undefined &&
        args.endMinutes !== undefined &&
        args.endMinutes <= args.startMinutes)
    )
      throw new ConvexError('Invalid event time')
    return await ctx.db.insert('calendarEvents', {
      calendarId: calendar._id,
      title: args.title.trim(),
      date: args.date,
      startMinutes: args.startMinutes,
      endMinutes: args.endMinutes,
      createdBy: user._id,
    })
  },
})

/** One event's own destination, including when Search opened it cold. */
export const getCalendarEvent = query({
  args: { groupSlug: v.string(), id: v.id('calendarEvents') },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id('calendarEvents'),
      title: v.string(),
      date: v.string(),
      startMinutes: v.optional(v.number()),
      endMinutes: v.optional(v.number()),
      calendarName: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.id)
    if (!event) return null
    const { calendar } = await calendarInGroup(
      ctx,
      args.groupSlug,
      event.calendarId,
    )
    return {
      _id: event._id,
      title: event.title,
      date: event.date,
      startMinutes: event.startMinutes,
      endMinutes: event.endMinutes,
      calendarName: calendar.name,
    }
  },
})

export const removeCalendarEvent = mutation({
  args: { groupSlug: v.string(), id: v.id('calendarEvents') },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.id)
    if (!event) throw new ConvexError('Calendar event not found')
    await calendarInGroup(ctx, args.groupSlug, event.calendarId)
    await ctx.db.delete(args.id)
  },
})

export const setCalendarVisibility = mutation({
  args: {
    groupSlug: v.string(),
    calendarId: v.id('calendars'),
    visible: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { group, user, calendar } = await calendarInGroup(
      ctx,
      args.groupSlug,
      args.calendarId,
    )
    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .filter((q) => q.eq(q.field('userId'), user._id))
      .unique()
    if (!membership) throw new ConvexError('Membership not found')
    const hidden = new Set(membership.hiddenCalendarIds ?? [])
    if (args.visible) hidden.delete(calendar._id)
    else hidden.add(calendar._id)
    await ctx.db.patch(membership._id, { hiddenCalendarIds: [...hidden] })
  },
})
