import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { deleteBabyCascade } from '../babies'

export async function cleanupBabyLogForSpace(
  ctx: MutationCtx,
  spaceId: Id<'spaces'>,
) {
  const babies = await ctx.db
    .query('babies')
    .withIndex('by_space', (q) => q.eq('spaceId', spaceId))
    .collect()
  for (const baby of babies) {
    await deleteBabyCascade(ctx, baby)
  }
}
