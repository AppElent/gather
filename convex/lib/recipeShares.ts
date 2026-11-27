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
 * Make the recipe's share rows match `sharedGroupIds`: insert the missing,
 * delete the stale and duplicate.
 */
async function syncRecipeShares(
  ctx: MutationCtx,
  recipeId: Id<'recipes'>,
  sharedGroupIds: readonly Id<'groups'>[],
): Promise<void> {
  const rows = await ctx.db
    .query('recipeShares')
    .withIndex('by_recipe_group', (q) => q.eq('recipeId', recipeId))
    .collect()
  const missing = new Set(sharedGroupIds)
  for (const row of rows)
    if (!missing.delete(row.groupId)) await ctx.db.delete(row._id)
  for (const groupId of missing)
    await ctx.db.insert('recipeShares', { recipeId, groupId })
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
 * The recipes of other Groups Shared into this one, oldest recipe first, read
 * by index (`recipeShares.by_group`). A row that lags `sharedGroupIds` costs one `get`
 * and is dropped by the visibility check.
 */
export async function recipesSharedInto(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
): Promise<Doc<'recipes'>[]> {
  const shares = await ctx.db
    .query('recipeShares')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .collect()
  const ids = [...new Set(shares.map((share) => share.recipeId))]
  return (await Promise.all(ids.map((id) => ctx.db.get(id))))
    .filter(
      (recipe): recipe is Doc<'recipes'> =>
        recipe !== null &&
        recipe.groupId !== groupId &&
        isVisibleToGroups(recipe, [groupId]),
    )
    .sort((a, b) => a._creationTime - b._creationTime)
}

/**
 * Every recipe visible in a Group: its own (`by_group`) and those Shared into
 * it. A recipe of an unrelated Group is never read while the share rows match
 * `sharedGroupIds`.
 */
export async function recipesVisibleIn(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
): Promise<Doc<'recipes'>[]> {
  const [own, sharedIn] = await Promise.all([
    ctx.db
      .query('recipes')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect(),
    recipesSharedInto(ctx, groupId),
  ])
  return [...own, ...sharedIn]
}
