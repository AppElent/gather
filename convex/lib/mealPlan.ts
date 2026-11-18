import type { MealSlot } from '@gather/core/meal-planner'
import {
  type ResolvedMealPreferences,
  resolveMealPreferences,
} from '@gather/core/meal-preferences-stand-in'
import type { Doc, Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'

/** A day's Planned meals, every slot. At most three rows. */
export async function mealsOn(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  date: string,
): Promise<Doc<'plannedDinners'>[]> {
  return await ctx.db
    .query('plannedDinners')
    .withIndex('by_group_date', (q) =>
      q.eq('groupId', groupId).eq('date', date),
    )
    .collect()
}

/** The Planned meal in one slot of one day, if any. A row without a slot is a dinner. */
export async function mealAt(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  date: string,
  slot: MealSlot,
): Promise<Doc<'plannedDinners'> | null> {
  const meals = await mealsOn(ctx, groupId, date)
  return meals.find((meal) => (meal.slot ?? 'dinner') === slot) ?? null
}

/** A day's dinner, for the functions phones from before slots call. */
export async function dinnerOn(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  date: string,
) {
  return await mealAt(ctx, groupId, date, 'dinner')
}

/** The Group's Members by name, as the planner shows them. */
export async function membersOf(ctx: QueryCtx, groupId: Id<'groups'>) {
  const memberships = await ctx.db
    .query('memberships')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .collect()
  const users = await Promise.all(
    memberships.map((membership) => ctx.db.get(membership.userId)),
  )
  return users
    .filter((user): user is Doc<'users'> => user !== null)
    .map((user) => ({ userId: user._id, name: user.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * The Group's meal preferences with every default filled in.
 *
 * Stand-in for APP-318: there is no stored row yet, so this always answers
 * the defaults. When APP-318's `mealPreferences` table lands, read its row by
 * `by_group` here and pass it instead of `null` (the same row its
 * `mealPreferences.get({ groupSlug })` resolves).
 */
export async function mealPreferencesOf(
  _ctx: QueryCtx,
  _groupId: Id<'groups'>,
  members: readonly { userId: Id<'users'> }[],
): Promise<ResolvedMealPreferences> {
  return resolveMealPreferences(null, members)
}
