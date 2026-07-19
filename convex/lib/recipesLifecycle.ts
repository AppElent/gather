import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

export async function cleanupRecipesForSpace(
  ctx: MutationCtx,
  spaceId: Id<'spaces'>,
) {
  const recipes = await ctx.db
    .query('recipes')
    .withIndex('by_space', (q) => q.eq('spaceId', spaceId))
    .collect()
  for (const recipe of recipes) {
    if (recipe.imageId) await ctx.storage.delete(recipe.imageId)
    await ctx.db.delete(recipe._id)
  }
}