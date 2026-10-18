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

import { internal } from '../_generated/api'
import type { ActionCtx } from '../_generated/server'

/** AI calls one person may make per UTC day, across every AI action. */
export const DAILY_AI_CALLS = 30

/**
 * What an AI action returns instead of a result once the day's budget is
 * spent. A value, not a throw, so every client narrows on it rather than
 * parsing a message — the sentence is the client's, in the reader's language.
 */
export type AiLimitReached = { ok: false; reason: 'limitReached' }

export const AI_LIMIT_REACHED: AiLimitReached = {
  ok: false,
  reason: 'limitReached',
}

/** `YYYY-MM-DD`, in UTC: the day a call is counted against. */
export function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10)
}

/**
 * Take one call from the signed-in person's budget for today.
 *
 * `false` means the budget is spent and the provider must not be called.
 * `clerkId` is the identity subject the action already resolved.
 */
export async function takeAiCall(
  ctx: ActionCtx,
  clerkId: string,
): Promise<boolean> {
  return await ctx.runMutation(internal.aiUsage.take, { clerkId })
}
