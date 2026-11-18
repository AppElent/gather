/**
 * `recipeShares`: the index of `recipes.sharedGroupIds`.
 *
 * `sharedGroupIds` stays the source of truth, and `isVisibleToGroups` still
 * decides visibility from it. The table only answers the one question the
 * array cannot be indexed for: which recipes are Shared *into* a Group. So
 * every write that changes `sharedGroupIds`, or deletes a recipe, goes through
 * here, and every read re-checks the recipe it found, so a row that lags the
 * array never shows anybody a recipe.
 */

import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { isVisibleToGroups } from './groupAccess'

/**
 * How the recipe's share rows differ from `sharedGroupIds`: the rows to
 * delete (stale or duplicate) and the Groups that have none yet.
 */
export async function recipeShareDiff(
  ctx: QueryCtx,
  recipeId: Id<'recipes'>,
  sharedGroupIds: readonly Id<'groups'>[],
): Promise<{ stale: Id<'recipeShares'>[]; missing: Id<'groups'>[] }> {
  const rows = await ctx.db
    .query('recipeShares')
    .withIndex('by_recipe_group', (q) => q.eq('recipeId', recipeId))
    .collect()
  const wanted = new Set(sharedGroupIds)
  const kept = new Set<Id<'groups'>>()
  const stale: Id<'recipeShares'>[] = []
  for (const row of rows) {
    if (wanted.has(row.groupId) && !kept.has(row.groupId)) kept.add(row.groupId)
    else stale.push(row._id)
  }
  return { stale, missing: [...wanted].filter((id) => !kept.has(id)) }
}

/**
 * Make the recipe's share rows match `sharedGroupIds`: insert the missing,
 * delete the rest.
 */
export async function syncRecipeShares(
  ctx: MutationCtx,
  recipeId: Id<'recipes'>,
  sharedGroupIds: readonly Id<'groups'>[],
): Promise<{ created: number; removed: number }> {
  const { stale, missing } = await recipeShareDiff(ctx, recipeId, sharedGroupIds)
  for (const id of stale) await ctx.db.delete(id)
  for (const groupId of missing)
    await ctx.db.insert('recipeShares', { recipeId, groupId })
  return { created: missing.length, removed: stale.length }
}

/** Set a recipe's `sharedGroupIds` and its share rows together. */
export async function setSharedGroups(
  ctx: MutationCtx,
  recipeId: Id<'recipes'>,
  patch: { groupId?: Id<'groups'>; sharedGroupIds: Id<'groups'>[] },
): Promise<void> {
  await ctx.db.patch(recipeId, patch)
  await syncRecipeShares(ctx, recipeId, patch.sharedGroupIds)
}

/** Delete a recipe's share rows, for a recipe that is being deleted. */
export async function dropRecipeShares(
  ctx: MutationCtx,
  recipeId: Id<'recipes'>,
): Promise<void> {
  await syncRecipeShares(ctx, recipeId, [])
}

/**
 * Every recipe visible in a Group, read by index: its own (`by_group`) and
 * those Shared into it (`recipeShares.by_group`). A recipe of an unrelated
 * Group is never read.
 */
export async function recipesVisibleIn(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
): Promise<Doc<'recipes'>[]> {
  const [own, shares] = await Promise.all([
    ctx.db
      .query('recipes')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect(),
    ctx.db
      .query('recipeShares')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect(),
  ])
  const sharedIds = [...new Set(shares.map((share) => share.recipeId))]
  const sharedIn = (
    await Promise.all(sharedIds.map((id) => ctx.db.get(id)))
  ).filter(
    (recipe): recipe is Doc<'recipes'> =>
      recipe !== null &&
      recipe.groupId !== groupId &&
      isVisibleToGroups(recipe, [groupId]),
  )
  return [...own, ...sharedIn]
}
