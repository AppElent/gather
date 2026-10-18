/**
 * The daily cap on AI calls.
 *
 * Gather reaches Anthropic from two actions — the recipe importer's fallback
 * (`recipeImport.importFromUrl`) and the nutrition estimate
 * (`recipeNutrition.estimateNutrition`) — and both spend from this one budget,
 * per person per UTC day. Any new action that calls a model takes a call from
 * `takeAiCall` first; the limit is not per feature on purpose, so a new one
 * cannot quietly double what a person may spend.
 *
 * The call is taken *before* the request and not refunded when it fails: the
 * cap exists to bound spend, and a request that reached the provider cost
 * something whether or not it produced a recipe.
 */

import { AI_LIMIT_KIND } from '@gather/core/ai-limit'
import { ConvexError } from 'convex/values'
import { internal } from '../_generated/api'
import type { ActionCtx } from '../_generated/server'

/** AI calls one person may make per UTC day, across every AI action. */
export const DAILY_AI_CALLS = 30

/**
 * What an AI action throws once the day's budget is spent. The success return
 * of the action is untouched, so a client built before the cap reads it as a
 * generic failure rather than a result (`@gather/core/ai-limit`).
 */
export function aiLimitReached(): never {
  throw new ConvexError({ kind: AI_LIMIT_KIND })
}

/** `YYYY-MM-DD`, in UTC: the day a call is counted against. */
export function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10)
}

/**
 * Take one call from the signed-in person's budget for today, or throw
 * `aiLimitReached` — so the provider is never reached over the limit.
 * `clerkId` is the identity subject the action already resolved.
 */
export async function takeAiCall(
  ctx: ActionCtx,
  clerkId: string,
): Promise<void> {
  const taken = await ctx.runMutation(internal.aiUsage.take, { clerkId })
  if (!taken) aiLimitReached()
}
