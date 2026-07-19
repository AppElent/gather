import { ConvexError } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { cleanupRecipesForSpace } from './recipesLifecycle'

export type ModuleCleanup = (
  ctx: MutationCtx,
  spaceId: Id<'spaces'>,
) => Promise<void>

export const moduleCleanupRegistry: Partial<Record<string, ModuleCleanup>> = {
  recipes: cleanupRecipesForSpace,
}

export async function runModuleCleanup(
  ctx: MutationCtx,
  moduleId: string,
  spaceId: Id<'spaces'>,
) {
  const cleanup = moduleCleanupRegistry[moduleId]
  if (!cleanup) {
    throw new ConvexError(`No cleanup handler registered for ${moduleId}`)
  }
  await cleanup(ctx, spaceId)
}