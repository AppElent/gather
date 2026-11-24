import type { MealSlot } from '@gather/core/meal-planner'
import {
  type ResolvedMealPreferences,
  resolveMealPreferences,
} from '@gather/core/meal-preferences'
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

/** The Planned meal in one slot of one day, if any. */
export async function mealAt(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  date: string,
  slot: MealSlot,
): Promise<Doc<'plannedDinners'> | null> {
  const meals = await mealsOn(ctx, groupId, date)
  return meals.find((meal) => meal.slot === slot) ?? null
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
 * The Group's meal preferences with every default filled in: its
 * `mealPreferences` row (APP-318), the same one `mealPreferences.get` resolves.
 */
export async function mealPreferencesOf(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  members: readonly { userId: Id<'users'> }[],
): Promise<ResolvedMealPreferences<Id<'users'>>> {
  const row = await ctx.db
    .query('mealPreferences')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .unique()
  return resolveMealPreferences(row, members)
}
