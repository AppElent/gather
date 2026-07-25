import { ConvexError } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { requireActiveSpace } from './spaceAuth'

/** Reject unless the Space has the Baby log module switched on. */
export async function requireBabyLogModuleEnabled(
  ctx: QueryCtx | MutationCtx,
  spaceId: Id<'spaces'>,
) {
  const module = await ctx.db
    .query('spaceModules')
    .withIndex('by_space_module', (q) =>
      q.eq('spaceId', spaceId).eq('moduleId', 'baby-log'),
    )
    .unique()
  if (!module || module.state !== 'enabled') {
    throw new ConvexError('Baby log is not enabled')
  }
}

/** Resolve the caller and the Space, asserting the module is enabled. */
export async function requireBabyLogSpace(
  ctx: QueryCtx | MutationCtx,
  spaceSlug: string,
) {
  const { space, user, role } = await requireActiveSpace(ctx, { spaceSlug })
  await requireBabyLogModuleEnabled(ctx, space._id)
  return { space, user, role }
}

/** Resolve the caller, the Space and the baby, asserting the baby lives in it. */
export async function requireBabyAccess(
  ctx: QueryCtx | MutationCtx,
  spaceSlug: string,
  babyId: Id<'babies'>,
) {
  const { space, user, role } = await requireBabyLogSpace(ctx, spaceSlug)
  const baby = await ctx.db.get(babyId)
  if (!baby) throw new ConvexError('Baby not found')
  if (baby.spaceId !== space._id) throw new ConvexError('Baby not found')
  return { user, space, role, baby }
}
