/**
 * The meal planner's week (APP-317): Planned meals per day and meal slot, who
 * eats along, busy evenings from the calendar, and moving meals between days.
 *
 * Planned meals live in `plannedDinners` (ADR-0027). Phones from before slots
 * still call `kitchen.planner`, `kitchen.setDinner` and `kitchen.clearDinner`,
 * which read and write the dinner slot only.
 */
import { isIsoDate } from '@gather/core/civil-date'
import { isEveningEvent, MEAL_SLOTS, slotOf } from '@gather/core/meal-planner'
import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import {
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from './_generated/server'
import {
  isVisibleToGroups,
  requireGroupBySlug,
  requireInGroup,
} from './lib/groupAccess'
import { createOnce, idempotencyKeyValidator } from './lib/idempotency'
import { mealSlotValidator } from './lib/kitchen'
import {
  mealAt,
  mealPreferencesOf,
  membersOf,
} from './lib/mealPlan'
import { nextOrder } from './lib/order'
import { recipesVisibleIn } from './lib/recipeShares'

/** The longest range one week read covers, so one answer stays one screen. */
const MAX_RANGE_DAYS = 31
const MAX_SERVINGS = 50
const MAX_NOTE = 500
const MAX_TITLE = 200
const NOT_FOUND = 'Meal not found'

type PlannedMeal = Doc<'plannedDinners'>

function requireRange(from: string, to: string) {
  if (!isIsoDate(from) || !isIsoDate(to) || to < from)
    throw new ConvexError('Use a range of YYYY-MM-DD days')
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5
  if (days > MAX_RANGE_DAYS)
    throw new ConvexError(`At most ${MAX_RANGE_DAYS} days at once`)
}

function requireDate(date: string) {
  if (!isIsoDate(date)) throw new ConvexError('Use a YYYY-MM-DD day')
}

function checkedServings(servings: number | null | undefined) {
  if (servings === null || servings === undefined) return undefined
  if (!Number.isInteger(servings) || servings < 1 || servings > MAX_SERVINGS)
    throw new ConvexError(`Servings is a whole number from 1 to ${MAX_SERVINGS}`)
  return servings
}

function checkedNote(note: string | null | undefined) {
  const trimmed = note?.trim()
  if (!trimmed) return undefined
  if (trimmed.length > MAX_NOTE)
    throw new ConvexError(`A note is at most ${MAX_NOTE} characters`)
  return trimmed
}

/** Chosen eaters, deduplicated, each a Member of the Group. */
async function checkedEaters(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  eaterIds: readonly Id<'users'>[] | null | undefined,
) {
  if (eaterIds === null || eaterIds === undefined) return undefined
  const members = new Set((await membersOf(ctx, groupId)).map((m) => m.userId))
  const unique = [...new Set(eaterIds)]
  if (unique.some((id) => !members.has(id)))
    throw new ConvexError('That person is not in this Group')
  return unique
}

/**
 * A stored meal with a live Recipe's title and time over its snapshot, while
 * the Recipe is still visible in the Group (ADR-0027).
 */
async function withLiveRecipe(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  meal: PlannedMeal,
) {
  const recipe = meal.recipeId ? await ctx.db.get(meal.recipeId) : null
  const live = recipe && isVisibleToGroups(recipe, [groupId]) ? recipe : null
  return {
    _id: meal._id,
    date: meal.date,
    slot: slotOf(meal),
    recipeId: live ? live._id : undefined,
    mealEntryId: meal.mealEntryId,
    title: live ? live.title : meal.title,
    prepMinutes: live ? live.prepMinutes : meal.prepMinutes,
    servings: meal.servings,
    note: meal.note,
    eaterIds: meal.eaterIds,
    imageUrl: live?.imageId ? await ctx.storage.getUrl(live.imageId) : null,
  }
}

/** The Group's calendar events in a range that take an evening. */
async function eveningEventsIn(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  from: string,
  to: string,
) {
  const calendars = await ctx.db
    .query('calendars')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .collect()
  const events = (
    await Promise.all(
      calendars.map((calendar) =>
        ctx.db
          .query('calendarEvents')
          .withIndex('by_calendar_date', (q) =>
            q.eq('calendarId', calendar._id).gte('date', from).lte('date', to),
          )
          .collect(),
      ),
    )
  ).flat()
  return events.filter(isEveningEvent).map((event) => ({
    _id: event._id,
    date: event.date,
    title: event.title,
    startMinutes: event.startMinutes,
    endMinutes: event.endMinutes,
    assigneeIds: event.assigneeIds ?? [],
  }))
}

/** Everything a week of the planner draws, read by index. */
export async function weekOf(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  from: string,
  to: string,
) {
  const [rows, members, events, group] = await Promise.all([
    ctx.db
      .query('plannedDinners')
      .withIndex('by_group_date', (q) =>
        q.eq('groupId', groupId).gte('date', from).lte('date', to),
      )
      .collect(),
    membersOf(ctx, groupId),
    eveningEventsIn(ctx, groupId, from, to),
    ctx.db.get(groupId),
  ])
  const meals = await Promise.all(
    rows.map((row) => withLiveRecipe(ctx, groupId, row)),
  )
  meals.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      MEAL_SLOTS.indexOf(a.slot) - MEAL_SLOTS.indexOf(b.slot),
  )
  return {
    meals,
    members,
    events,
    preferences: await mealPreferencesOf(ctx, groupId, members),
    groceryListId: group?.groceryListId ?? null,
  }
}

/** A week of the planner: meals, Members, evening events and preferences. */
export const week = query({
  args: { groupSlug: v.string(), from: v.string(), to: v.string() },
  handler: async (ctx, args) => {
    requireRange(args.from, args.to)
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    return await weekOf(ctx, group._id, args.from, args.to)
  },
})

/** What a slot can be filled with: the Group's Recipes and quick meals. */
export async function candidatesOf(ctx: QueryCtx, groupId: Id<'groups'>) {
  const [recipes, mealEntries] = await Promise.all([
    recipesVisibleIn(ctx, groupId),
    ctx.db
      .query('mealEntries')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect(),
  ])
  return {
    recipes: await Promise.all(
      recipes
        .sort((a, b) => a.title.localeCompare(b.title))
        .map(async (recipe) => ({
          _id: recipe._id,
          title: recipe.title,
          prepMinutes: recipe.prepMinutes,
          rating: recipe.rating,
          tags: recipe.tags,
          ingredients: recipe.ingredients,
          imageUrl: recipe.imageId
            ? await ctx.storage.getUrl(recipe.imageId)
            : null,
        })),
    ),
    mealEntries: mealEntries
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((entry) => ({
        _id: entry._id,
        title: entry.title,
        prepMinutes: entry.prepMinutes,
      })),
  }
}

export const candidates = query({
  args: { groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    return await candidatesOf(ctx, group._id)
  },
})

/** The title and time a Recipe or quick meal is planned with. */
async function candidateFields(
  ctx: QueryCtx,
  groupSlug: string,
  groupId: Id<'groups'>,
  args: { recipeId?: Id<'recipes'>; mealEntryId?: Id<'mealEntries'> },
) {
  if (Number(Boolean(args.recipeId)) + Number(Boolean(args.mealEntryId)) !== 1)
    throw new ConvexError('A meal needs exactly one recipe or quick meal')
  if (args.mealEntryId) {
    const { doc } = await requireInGroup(
      ctx,
      groupSlug,
      args.mealEntryId,
      'Meal not found',
    )
    return {
      recipeId: undefined,
      mealEntryId: doc._id,
      title: doc.title,
      prepMinutes: doc.prepMinutes,
    }
  }
  const recipe = args.recipeId ? await ctx.db.get(args.recipeId) : null
  if (!recipe || !isVisibleToGroups(recipe, [groupId]))
    throw new ConvexError('Recipe not found')
  return {
    recipeId: recipe._id,
    mealEntryId: undefined,
    title: recipe.title,
    prepMinutes: recipe.prepMinutes,
  }
}

export interface PlanArgs {
  groupSlug: string
  date: string
  slot: 'breakfast' | 'lunch' | 'dinner'
  recipeId?: Id<'recipes'>
  mealEntryId?: Id<'mealEntries'>
  servings?: number
  note?: string
  eaterIds?: Id<'users'>[]
  replace?: boolean
  /**
   * The meal "Something else" swaps out. Replaces that row wherever it now
   * is, rather than whatever holds `date` and `slot`, so a move landing
   * first can never make it overwrite the meal swapped into its place.
   */
  replaceId?: Id<'plannedDinners'>
  idempotencyKey?: string
}

/**
 * Plans a Recipe or quick meal in one slot of one day. A slot that already
 * holds a meal is refused unless `replace` is set; replacing keeps that
 * evening's servings, note and eaters unless new ones are given. A retry
 * with the same `idempotencyKey` answers the first meal (ADR-0046).
 */
export async function planMeal(ctx: MutationCtx, args: PlanArgs) {
  requireDate(args.date)
  const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
  const fields = await candidateFields(ctx, args.groupSlug, group._id, args)
  const servings = checkedServings(args.servings)
  const note = checkedNote(args.note)
  const eaterIds = await checkedEaters(ctx, group._id, args.eaterIds)
  const replaced = args.replaceId
    ? (await requireInGroup(ctx, args.groupSlug, args.replaceId, NOT_FOUND))
        .doc
    : null
  return await createOnce(
    ctx,
    user._id,
    'plannedDinners',
    args.idempotencyKey,
    async () => {
      const existing =
        replaced ?? (await mealAt(ctx, group._id, args.date, args.slot))
      if (existing && !args.replace && !replaced)
        throw new ConvexError('That slot already has a meal')
      if (existing) {
        await ctx.db.patch(existing._id, {
          ...fields,
          ...(replaced ? {} : { slot: args.slot }),
          ...(servings !== undefined ? { servings } : {}),
          ...(note !== undefined ? { note } : {}),
          ...(eaterIds !== undefined ? { eaterIds } : {}),
          quickLimit: undefined,
        })
        return existing._id
      }
      return await ctx.db.insert('plannedDinners', {
        groupId: group._id,
        date: args.date,
        slot: args.slot,
        ...fields,
        servings,
        note,
        eaterIds,
      })
    },
  )
}

const planArgs = {
  groupSlug: v.string(),
  date: v.string(),
  slot: mealSlotValidator,
  recipeId: v.optional(v.id('recipes')),
  mealEntryId: v.optional(v.id('mealEntries')),
  servings: v.optional(v.number()),
  note: v.optional(v.string()),
  eaterIds: v.optional(v.array(v.id('users'))),
  replace: v.optional(v.boolean()),
  replaceId: v.optional(v.id('plannedDinners')),
  idempotencyKey: idempotencyKeyValidator,
}

export const plan = mutation({
  args: planArgs,
  handler: async (ctx, args) => await planMeal(ctx, args),
})

/**
 * Changes a meal's servings, note or eaters. Only the fields passed change;
 * `null` clears one back to the Group's default.
 */
export const update = mutation({
  args: {
    groupSlug: v.string(),
    id: v.id('plannedDinners'),
    servings: v.optional(v.union(v.number(), v.null())),
    note: v.optional(v.union(v.string(), v.null())),
    eaterIds: v.optional(v.union(v.array(v.id('users')), v.null())),
  },
  handler: async (ctx, args) => {
    const { group, doc } = await requireInGroup(
      ctx,
      args.groupSlug,
      args.id,
      NOT_FOUND,
    )
    const patch: Partial<PlannedMeal> = {}
    if (args.servings !== undefined)
      patch.servings = checkedServings(args.servings)
    if (args.note !== undefined) patch.note = checkedNote(args.note)
    if (args.eaterIds !== undefined)
      patch.eaterIds = await checkedEaters(ctx, group._id, args.eaterIds)
    await ctx.db.patch(doc._id, patch)
  },
})

/**
 * Moves a meal to another day or slot. A place that already holds a meal
 * swaps with it, in one transaction, so nobody ever sees two meals in a slot.
 * A meal that changes day drops its chosen eaters: who eats along was chosen
 * for that evening and its calendar, so the new day starts from its own
 * defaults (ADR-0027).
 */
export const move = mutation({
  args: {
    groupSlug: v.string(),
    id: v.id('plannedDinners'),
    date: v.string(),
    slot: mealSlotValidator,
  },
  handler: async (ctx, args) => {
    requireDate(args.date)
    const { group, doc } = await requireInGroup(
      ctx,
      args.groupSlug,
      args.id,
      NOT_FOUND,
    )
    const from = { date: doc.date, slot: slotOf(doc) }
    if (from.date === args.date && from.slot === args.slot)
      return { kind: 'stay' as const }
    const other = await mealAt(ctx, group._id, args.date, args.slot)
    const newDay = from.date !== args.date ? { eaterIds: undefined } : {}
    await ctx.db.patch(doc._id, { date: args.date, slot: args.slot, ...newDay })
    if (!other) return { kind: 'move' as const }
    await ctx.db.patch(other._id, { ...from, ...newDay })
    return { kind: 'swap' as const, otherId: other._id }
  },
})

/**
 * Takes a meal off the plan and answers what it was, for `restore` to put
 * back. A Recipe the Group can no longer see is left out of the answer; its
 * snapshot title and time stay.
 */
export const remove = mutation({
  args: { groupSlug: v.string(), id: v.id('plannedDinners') },
  handler: async (ctx, args) => {
    const { group, doc } = await requireInGroup(
      ctx,
      args.groupSlug,
      args.id,
      NOT_FOUND,
    )
    await ctx.db.delete(doc._id)
    const recipe = doc.recipeId ? await ctx.db.get(doc.recipeId) : null
    return {
      date: doc.date,
      slot: slotOf(doc),
      title: doc.title,
      prepMinutes: doc.prepMinutes,
      recipeId:
        recipe && isVisibleToGroups(recipe, [group._id]) ? recipe._id : undefined,
      mealEntryId: doc.mealEntryId,
      servings: doc.servings,
      note: doc.note,
      eaterIds: doc.eaterIds,
    }
  },
})

/**
 * Undo for `remove`: puts a meal back as it was, snapshot and all, while its
 * slot is still free. Unlike `plan` it never refuses a meal whose Recipe or
 * quick meal has gone (ADR-0027 keeps the snapshot for exactly that); such a
 * link is dropped, as are eaters who have left the Group, and a Recipe title
 * longer than a meal title may be is cut rather than refused.
 *
 * It takes no idempotency key: like `move`, it is keyed by its slot, so a
 * repeated Undo finds the slot taken and writes nothing (ADR-0046). It is not
 * an MCP tool.
 */
export const restore = mutation({
  args: {
    groupSlug: v.string(),
    date: v.string(),
    slot: mealSlotValidator,
    title: v.string(),
    prepMinutes: v.optional(v.number()),
    recipeId: v.optional(v.id('recipes')),
    mealEntryId: v.optional(v.id('mealEntries')),
    servings: v.optional(v.number()),
    note: v.optional(v.string()),
    eaterIds: v.optional(v.array(v.id('users'))),
  },
  handler: async (ctx, args) => {
    requireDate(args.date)
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const title = args.title.trim().slice(0, MAX_TITLE)
    if (!title) throw new ConvexError('A meal needs a title')
    if (await mealAt(ctx, group._id, args.date, args.slot))
      throw new ConvexError('That slot already has a meal')
    const recipe = args.recipeId ? await ctx.db.get(args.recipeId) : null
    const entry = args.mealEntryId ? await ctx.db.get(args.mealEntryId) : null
    const members = new Set(
      (await membersOf(ctx, group._id)).map((member) => member.userId),
    )
    return await ctx.db.insert('plannedDinners', {
      groupId: group._id,
      date: args.date,
      slot: args.slot,
      title,
      prepMinutes: args.prepMinutes,
      recipeId:
        recipe && isVisibleToGroups(recipe, [group._id]) ? recipe._id : undefined,
      mealEntryId: entry && entry.groupId === group._id ? entry._id : undefined,
      servings: checkedServings(args.servings),
      note: checkedNote(args.note),
      eaterIds: args.eaterIds?.filter((id) => members.has(id)),
    })
  },
})

/**
 * Puts a planned Recipe's ingredient lines on the Group's grocery list,
 * skipping lines the list already has open (same words, any case). The
 * richer sheet with quantities and merging is APP-312's.
 */
export const addToGroceries = mutation({
  args: { groupSlug: v.string(), id: v.id('plannedDinners') },
  handler: async (ctx, args) => {
    const { group, doc, user } = await requireInGroup(
      ctx,
      args.groupSlug,
      args.id,
      NOT_FOUND,
    )
    const recipe = doc.recipeId ? await ctx.db.get(doc.recipeId) : null
    if (!recipe || !isVisibleToGroups(recipe, [group._id]))
      throw new ConvexError('Recipe not found')
    const listId = group.groceryListId
    const list = listId ? await ctx.db.get(listId) : null
    if (!list || list.groupId !== group._id || list.provider !== 'local')
      return { status: 'no-list' as const, added: 0 }
    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_list', (q) => q.eq('listId', list._id))
      .collect()
    const open = new Set(
      tasks
        .filter((task) => !task.done)
        .map((task) => task.title.trim().toLocaleLowerCase()),
    )
    let order = nextOrder(tasks)
    let added = 0
    for (const line of recipe.ingredients) {
      const title = line.trim()
      const key = title.toLocaleLowerCase()
      if (!title || open.has(key)) continue
      open.add(key)
      await ctx.db.insert('tasks', {
        listId: list._id,
        title,
        done: false,
        createdBy: user._id,
        order: order++,
      })
      added++
    }
    return { status: 'added' as const, added, listName: list.name }
  },
})
