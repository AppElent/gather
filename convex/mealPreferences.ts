/**
 * Meal preferences ("Eetvoorkeuren", APP-318): one document per Group.
 *
 * Group content: every Member reads and changes it, and nobody else learns
 * anything about it (ownership-and-access.md). Each write is one small patch
 * from the screen, saved at once; `get` always answers with every default
 * filled, so a Group that never opened the screen reads the defaults and the
 * week (APP-317) can rely on them.
 */
import {
  listChangePatch,
  type MealPreferencesListChange,
  type MealPreferencesPatch,
  normalizeMealPreferencesPatch,
  resolveMealPreferences,
} from '@gather/core/meal-preferences'
import { mealPreferencesRefusal } from '@gather/core/refusals'
import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import {
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from './_generated/server'
import { requireGroupBySlug } from './lib/groupAccess'
import { mealSlotValidator } from './lib/kitchen'
import {
  allergenValidator,
  cuisineValidator,
  dietValidator,
  mealPreferencesPatchValidator,
  weekdayValidator,
} from './lib/mealPreferences'

async function rowOf(ctx: QueryCtx, groupId: Id<'groups'>) {
  return await ctx.db
    .query('mealPreferences')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .unique()
}

/** The Group's Members by name, as `groups.members` lists them. */
async function membersOf(ctx: QueryCtx, groupId: Id<'groups'>) {
  const memberships = await ctx.db
    .query('memberships')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .collect()
  const people = await Promise.all(
    memberships.map((m) => ctx.db.get(m.userId)),
  )
  return people
    .filter((user): user is Doc<'users'> => user !== null)
    .map((user) => ({ userId: user._id, name: user.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * The Group's meal preferences with every default filled, and its Members by
 * name (for the "Who eats" rows). Answers the defaults when no row exists.
 */
export const get = query({
  args: { groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const [row, members] = await Promise.all([
      rowOf(ctx, group._id),
      membersOf(ctx, group._id),
    ])
    return {
      ...resolveMealPreferences(row, members),
      members,
      updatedAt: row?.updatedAt ?? null,
    }
  },
})

/** Write `fields` onto the Group's row, making it on the first change. */
async function write(
  ctx: MutationCtx,
  groupId: Id<'groups'>,
  userId: Id<'users'>,
  fields: Partial<Doc<'mealPreferences'>>,
) {
  const stamp = { updatedBy: userId, updatedAt: Date.now() }
  const row = await rowOf(ctx, groupId)
  if (row) {
    await ctx.db.patch(row._id, { ...fields, ...stamp })
    return
  }
  // `undefined` in an insert is a missing field, which is the default.
  await ctx.db.insert('mealPreferences', { groupId, ...fields, ...stamp })
}

/**
 * Change any subset of the preferences. `null` sets the servings back to
 * "same as who eats" and removes the budget.
 */
export const update = mutation({
  args: { groupSlug: v.string(), patch: mealPreferencesPatchValidator },
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    const normalized = normalizeMealPreferencesPatch(
      args.patch as MealPreferencesPatch,
    )
    if (!normalized.ok)
      throw new ConvexError(mealPreferencesRefusal(normalized.field))
    const { servingsPerMeal, weeklyBudgetCents, ...rest } = normalized.patch
    const fields: Partial<Doc<'mealPreferences'>> = {
      ...(rest as Partial<Doc<'mealPreferences'>>),
    }
    if (servingsPerMeal !== undefined)
      fields.servingsPerMeal = servingsPerMeal ?? undefined
    if (weeklyBudgetCents !== undefined)
      fields.weeklyBudgetCents = weeklyBudgetCents ?? undefined
    await write(ctx, group._id, user._id, fields)
  },
})

/**
 * Whether one Member eats along by default. Its own write, so two people
 * changing two Members at once do not overwrite each other. Somebody who is
 * not a Member of the Group is refused as an invalid value, never as "not a
 * member", so the answer says nothing about who exists elsewhere.
 */
export const setMemberDefault = mutation({
  args: {
    groupSlug: v.string(),
    userId: v.id('users'),
    eatsByDefault: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    const members = await membersOf(ctx, group._id)
    if (!members.some((member) => member.userId === args.userId))
      throw new ConvexError(mealPreferencesRefusal('memberDefault'))
    const row = await rowOf(ctx, group._id)
    const current = resolveMealPreferences(row, members).memberDefaults
    const memberDefaults = current.map((entry) =>
      entry.userId === args.userId
        ? { userId: entry.userId, eatsByDefault: args.eatsByDefault }
        : entry,
    )
    await write(ctx, group._id, user._id, { memberDefaults })
  },
})

/**
 * Switch one item of a safety list on or off, reading the list inside the
 * transaction. Two Members adding two allergens at once both keep theirs,
 * which a whole-list write could not promise.
 */
async function changeList(
  ctx: MutationCtx,
  groupSlug: string,
  change: MealPreferencesListChange,
) {
  const { group, user } = await requireGroupBySlug(ctx, groupSlug)
  const [row, members] = await Promise.all([
    rowOf(ctx, group._id),
    membersOf(ctx, group._id),
  ])
  const result = listChangePatch(resolveMealPreferences(row, members), change)
  if (!result.ok) throw new ConvexError(mealPreferencesRefusal(result.field))
  await write(
    ctx,
    group._id,
    user._id,
    result.patch as Partial<Doc<'mealPreferences'>>,
  )
}

/** One diet on or off. */
export const setDiet = mutation({
  args: { groupSlug: v.string(), diet: dietValidator, on: v.boolean() },
  handler: (ctx, args) =>
    changeList(ctx, args.groupSlug, {
      list: 'diets',
      value: args.diet,
      on: args.on,
    }),
})

/** One allergen on or off. */
export const setAllergen = mutation({
  args: {
    groupSlug: v.string(),
    allergen: allergenValidator,
    on: v.boolean(),
  },
  handler: (ctx, args) =>
    changeList(ctx, args.groupSlug, {
      list: 'allergens',
      value: args.allergen,
      on: args.on,
    }),
})

/**
 * Add a dislike (`on`) or remove it, matched ignoring case. Too long, empty,
 * or one past the limit is refused as `dislikes`.
 */
export const setDislike = mutation({
  args: { groupSlug: v.string(), dislike: v.string(), on: v.boolean() },
  handler: (ctx, args) =>
    changeList(ctx, args.groupSlug, {
      list: 'dislikes',
      value: args.dislike,
      on: args.on,
    }),
})

/**
 * The cuisines, the fish and leftover days and a slot's days and switch are
 * also written one item at a time (APP-446), for the same reason as the safety
 * lists. `update` still takes them as whole lists, so a phone from before
 * these functions keeps saving through it.
 */
export const setCuisine = mutation({
  args: { groupSlug: v.string(), cuisine: cuisineValidator, on: v.boolean() },
  handler: (ctx, args) =>
    changeList(ctx, args.groupSlug, {
      list: 'cuisines',
      value: args.cuisine,
      on: args.on,
    }),
})

/** One weekday on or off the fish nights. */
export const setFishDay = mutation({
  args: { groupSlug: v.string(), day: weekdayValidator, on: v.boolean() },
  handler: (ctx, args) =>
    changeList(ctx, args.groupSlug, {
      list: 'fishDays',
      value: args.day,
      on: args.on,
    }),
})

/** One weekday on or off the cook-double days. */
export const setLeftoverDay = mutation({
  args: { groupSlug: v.string(), day: weekdayValidator, on: v.boolean() },
  handler: (ctx, args) =>
    changeList(ctx, args.groupSlug, {
      list: 'leftoverDays',
      value: args.day,
      on: args.on,
    }),
})

/** One weekday on or off one slot's days. */
export const setSlotDay = mutation({
  args: {
    groupSlug: v.string(),
    slot: mealSlotValidator,
    day: weekdayValidator,
    on: v.boolean(),
  },
  handler: (ctx, args) =>
    changeList(ctx, args.groupSlug, {
      list: 'slotDays',
      slot: args.slot,
      value: args.day,
      on: args.on,
    }),
})

/** One slot planned (`on`) or not. */
export const setSlotEnabled = mutation({
  args: { groupSlug: v.string(), slot: mealSlotValidator, on: v.boolean() },
  handler: (ctx, args) =>
    changeList(ctx, args.groupSlug, {
      list: 'slotEnabled',
      slot: args.slot,
      on: args.on,
    }),
})
