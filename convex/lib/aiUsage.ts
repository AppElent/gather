/**
 * The daily cap on AI calls.
 *
 * Gather reaches Anthropic for a person from these actions — the recipe
 * importer's fallback (`recipeImport.importFromUrl`), the nutrition estimate
 * (`recipeNutrition.estimateNutrition`), reading recipe lines for the
 * grocery list (`groceryLines.read`, APP-312), Plan mijn week
 * (`mealPlanDrafts.propose` and `.regenerate`, APP-319) and Iets anders /
 * Nieuw idee (`mealIdeas.swap` and `.idea`, APP-320) — and all spend from this one
 * budget, per person per UTC day. Any new action that calls a model takes a
 * call from `takeAiCall` (or `aiUsage.takeCounted`) first; the limit is not
 * per feature on purpose, so a new one cannot quietly double what a person
 * may spend.
 *
 * The call is taken *before* the request and not refunded when it fails: the
 * cap exists to bound spend, and a request that reached the provider cost
 * something whether or not it produced a recipe. The exceptions are the
 * meal planner's AI actions (Plan mijn week, Iets anders, Nieuw idee), whose
 * fallback is promised to cost nothing: they give the call back with
 * `aiUsage.refund` when no key is set or the model could not be reached,
 * through `takeRefundableAiCall`, so the refund lands on the day the call was
 * counted against.
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

/**
 * Take one call as `takeAiCall` does, or null over the cap, with a `refund`
 * that gives it back to the day it was counted against (a take just before
 * UTC midnight is not refunded from the next day, APP-460). `used` is how
 * many calls that day has used with this one.
 */
export async function takeRefundableAiCall(
  ctx: ActionCtx,
  clerkId: string,
): Promise<{ used: number; refund: () => Promise<void> } | null> {
  const taken: { used: number; day: string } | null = await ctx.runMutation(
    internal.aiUsage.takeDated,
    { clerkId },
  )
  if (!taken) return null
  return {
    used: taken.used,
    refund: async () => {
      await ctx.runMutation(internal.aiUsage.refund, { clerkId, day: taken.day })
    },
  }
}
