/**
 * Iets anders and Nieuw idee (APP-320, designs/meal-planner section 4).
 *
 * `swap` answers three alternatives for one slot from the Group's own recipes
 * (and its quick meals when those run out); `choose` puts one in the slot and
 * `unchoose` is its Undo. `idea` asks the model for one new recipe, shown as a
 * draft on the phone and never stored until `saveIdea` makes it an ordinary
 * Recipe in the Group, tagged `AI_RECIPE_TAG`, and plans it if asked.
 *
 * Both asks are Plan mijn week's machinery (`mealPlanDrafts.planContext`,
 * `lib/weekPlanAi`): one AI call each from the person's daily cap, taken
 * before the model is asked; over the cap nothing is asked. A call that never
 * reached the model is given back: `swap` then answers by the rules alone
 * (`fallback`), `idea` says it is `unavailable`. The model only picks recipe
 * ids it was shown, and an idea with a certain allergen, diet or dislike
 * clash is dropped; one with nutrition lines loses them (ADR-0041).
 *
 * The calls are the phone's own: connected apps are refused (ADR-0046).
 */
import { isIsoDate, mondayStart } from '@gather/core/civil-date'
import {
  AI_RECIPE_TAG,
  claimsNutrition,
  completeSwaps,
  IDEA_LIMITS,
  ideaClashes,
  type RecipeIdea,
  rulesSwaps,
  SWAP_CHIPS,
  type SwapInput,
  type SwapPick,
  swapPool,
} from '@gather/core/meal-ideas'
import type { MealSlot } from '@gather/core/meal-planner'
import { WISH_MAX } from '@gather/core/week-plan'
import { ConvexError, type Infer, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import {
  type ActionCtx,
  action,
  internalQuery,
  mutation,
} from './_generated/server'
import { DAILY_AI_CALLS } from './lib/aiUsage'
import { anthropicApiKey } from './lib/anthropic'
import { rejectConnectedApps } from './lib/connectedApps'
import {
  isVisibleToGroups,
  requireGroupBySlug,
  requireInGroup,
} from './lib/groupAccess'
import { mealSlotValidator, quickLimitValidator } from './lib/kitchen'
import { askIdea, askSwaps, type MealIdeaPromptInput } from './lib/mealIdeasAi'
import { mealAt, mealPreferencesOf, membersOf } from './lib/mealPlan'
import { recipesVisibleIn } from './lib/recipeShares'
import { requireIdentity } from './lib/sharing'
import { planMeal } from './mealPlan'
import { planContext } from './mealPlanDrafts'

const NOT_FOUND = 'Meal not found'
/** Titles Nieuw idee is told not to repeat. */
const AVOID_TITLES_MAX = 40
const MAX_TITLE = 200

const localeValidator = v.union(v.literal('nl'), v.literal('en'))
const chipValidator = v.union(...SWAP_CHIPS.map((chip) => v.literal(chip)))

const askArgs = {
  groupSlug: v.string(),
  date: v.string(),
  slot: mealSlotValidator,
  locale: localeValidator,
  wish: v.optional(v.string()),
  chip: v.optional(chipValidator),
}
const askArgsObject = v.object(askArgs)

function requireDate(date: string) {
  if (!isIsoDate(date)) throw new ConvexError('Use a YYYY-MM-DD day')
}

/**
 * The slot asked about, as Plan mijn week's planners see it, with what is
 * there now: the planned meal, else the open draft of the proposal.
 */
export const context = internalQuery({
  args: askArgsObject,
  handler: async (ctx, args) => {
    requireDate(args.date)
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const meal = await mealAt(ctx, group._id, args.date, args.slot)
    const recipe = meal?.recipeId ? await ctx.db.get(meal.recipeId) : null
    const liveRecipe = recipe && isVisibleToGroups(recipe, [group._id]) ? recipe : null
    const weekStart = mondayStart(args.date)
    const draft = meal
      ? null
      : (
          await ctx.db
            .query('mealPlanDrafts')
            .withIndex('by_group_week', (q) =>
              q.eq('groupId', group._id).eq('weekStart', weekStart),
            )
            .collect()
        ).find(
          (row) =>
            row.date === args.date &&
            row.slot === args.slot &&
            row.expiresAt > Date.now(),
        )
    const draftRecipe = draft?.recipeId ? await ctx.db.get(draft.recipeId) : null
    const input = await planContext(ctx, {
      groupSlug: args.groupSlug,
      weekStart,
      dates: [args.date],
      slots: [args.slot],
      locale: args.locale,
      wishes: [],
      wish: args.wish,
      avoidRecipeIds: draft?.recipeId ? [draft.recipeId] : [],
      swapping: true,
    })
    const current = meal
      ? {
          recipeId: liveRecipe?._id as string | undefined,
          quickMeal: meal.recipeId ? undefined : meal.title,
          title: liveRecipe ? liveRecipe.title : meal.title,
          prepMinutes: liveRecipe ? liveRecipe.prepMinutes : meal.prepMinutes,
        }
      : draft
        ? {
            recipeId: draftRecipe?._id as string | undefined,
            quickMeal: draft.recipeId ? undefined : draft.quickMeal,
            title: draftRecipe ? draftRecipe.title : (draft.quickMeal ?? ''),
            prepMinutes: draftRecipe ? draftRecipe.prepMinutes : draft.prepMinutes,
          }
        : null
    const titles = (await recipesVisibleIn(ctx, group._id))
      .map((row) => row.title)
      .slice(0, AVOID_TITLES_MAX)
    return { input, current, titles }
  },
})

type AskContext = {
  input: MealIdeaPromptInput
  current: {
    recipeId?: string
    quickMeal?: string
    title: string
    prepMinutes?: number
  } | null
  titles: string[]
}

/** The alternatives as the phone shows them: with each recipe's photo. */
export const view = internalQuery({
  args: {
    groupSlug: v.string(),
    picks: v.array(
      v.object({
        recipeId: v.optional(v.string()),
        quickMealId: v.optional(v.string()),
        reason: v.optional(v.string()),
        source: v.union(v.literal('ai'), v.literal('rules')),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const rows = await Promise.all(
      args.picks.map(async (pick) => {
        if (pick.recipeId) {
          const id = ctx.db.normalizeId('recipes', pick.recipeId)
          const recipe = id ? await ctx.db.get(id) : null
          if (!recipe || !isVisibleToGroups(recipe, [group._id])) return null
          return {
            recipeId: recipe._id,
            mealEntryId: undefined,
            title: recipe.title,
            prepMinutes: recipe.prepMinutes,
            rating: recipe.rating,
            imageUrl: recipe.imageId ? await ctx.storage.getUrl(recipe.imageId) : null,
            reason: pick.reason,
            source: pick.source,
          }
        }
        const id = pick.quickMealId ? ctx.db.normalizeId('mealEntries', pick.quickMealId) : null
        const entry = id ? await ctx.db.get(id) : null
        if (!entry || entry.groupId !== group._id) return null
        return {
          recipeId: undefined,
          mealEntryId: entry._id,
          title: entry.title,
          prepMinutes: entry.prepMinutes,
          rating: undefined,
          imageUrl: null,
          reason: pick.reason,
          source: pick.source,
        }
      }),
    )
    return rows.filter((row) => row !== null)
  },
})

function cleanWish(wish: string | undefined) {
  return wish?.replace(/\s+/g, ' ').trim().slice(0, WISH_MAX) || undefined
}

/**
 * Who asks, their context, and one call taken from today's cap (or null).
 * The caller has already rejected connected apps.
 */
async function begin(ctx: ActionCtx, args: Infer<typeof askArgsObject>) {
  const identity = await requireIdentity(ctx)
  const context: AskContext = await ctx.runQuery(internal.mealIdeas.context, {
    ...args,
    wish: cleanWish(args.wish),
  })
  const used: number | null = await ctx.runMutation(internal.aiUsage.takeCounted, {
    clerkId: identity.subject,
  })
  return { identity, context, used }
}

const alternativeValidator = v.object({
  recipeId: v.optional(v.id('recipes')),
  mealEntryId: v.optional(v.id('mealEntries')),
  title: v.string(),
  prepMinutes: v.optional(v.number()),
  rating: v.optional(v.number()),
  imageUrl: v.union(v.string(), v.null()),
  reason: v.optional(v.string()),
  source: v.union(v.literal('ai'), v.literal('rules')),
})

const swapResult = v.union(
  v.object({ status: v.literal('limit'), limit: v.number() }),
  v.object({
    status: v.union(v.literal('ai'), v.literal('fallback')),
    alternatives: v.array(alternativeValidator),
    left: v.number(),
    limit: v.number(),
  }),
)
type SwapResult = Infer<typeof swapResult>

/**
 * Iets anders: three alternatives for one slot, steered by an optional wish
 * and one chip. One AI call; without an answer from the model, the rules
 * choose and the call is given back.
 */
export const swap = action({
  args: askArgs,
  returns: swapResult,
  handler: async (ctx, args): Promise<SwapResult> => {
    await rejectConnectedApps(ctx)
    const { identity, context, used } = await begin(ctx, args)
    if (used === null) return { status: 'limit', limit: DAILY_AI_CALLS }
    const input: SwapInput = {
      ...context.input,
      current: context.current ?? undefined,
      chip: args.chip,
    }
    const apiKey = anthropicApiKey()
    const aiPicks = apiKey
      ? await askSwaps(
          {
            ...context.input,
            chip: args.chip,
            currentTitle: context.current?.title,
            currentMinutes: context.current?.prepMinutes,
          },
          swapPool(input),
          apiKey,
        )
      : null
    let picks: (SwapPick & { source: 'ai' | 'rules' })[]
    let spent = used
    if (aiPicks === null) {
      await ctx.runMutation(internal.aiUsage.refund, { clerkId: identity.subject })
      spent = used - 1
      picks = rulesSwaps(input).map((pick) => ({ ...pick, source: 'rules' as const }))
    } else picks = completeSwaps(aiPicks, input)
    const alternatives = await ctx.runQuery(internal.mealIdeas.view, {
      groupSlug: args.groupSlug,
      picks: picks.map((pick) => ({
        recipeId: pick.recipeId,
        quickMealId: pick.quickMealId,
        reason: pick.reason,
        source: pick.source,
      })),
    })
    return {
      status: aiPicks === null ? 'fallback' : 'ai',
      alternatives,
      left: DAILY_AI_CALLS - spent,
      limit: DAILY_AI_CALLS,
    }
  },
})

const ideaValidator = v.object({
  title: v.string(),
  ingredients: v.array(
    v.object({
      name: v.string(),
      quantity: v.optional(v.number()),
      unit: v.optional(v.string()),
    }),
  ),
  steps: v.array(v.string()),
  prepMinutes: v.optional(v.number()),
  servings: v.number(),
  why: v.optional(v.string()),
})

const ideaResult = v.union(
  v.object({ status: v.literal('limit'), limit: v.number() }),
  v.object({
    status: v.union(v.literal('unavailable'), v.literal('none')),
    left: v.number(),
    limit: v.number(),
  }),
  v.object({
    status: v.literal('ai'),
    idea: ideaValidator,
    left: v.number(),
    limit: v.number(),
  }),
)
type IdeaResult = Infer<typeof ideaResult>

/**
 * Nieuw idee: one new recipe for the slot, as a draft the phone shows. One AI
 * call. `unavailable` when the model was not reached (given back), `none`
 * when its answer held no usable recipe clear of the Group's allergens,
 * diets and dislikes (counted). `avoidTitles` are ideas just turned down.
 */
export const idea = action({
  args: { ...askArgs, avoidTitles: v.optional(v.array(v.string())) },
  returns: ideaResult,
  handler: async (ctx, args): Promise<IdeaResult> => {
    await rejectConnectedApps(ctx)
    const { avoidTitles, ...ask } = args
    const { identity, context, used } = await begin(ctx, ask)
    if (used === null) return { status: 'limit', limit: DAILY_AI_CALLS }
    const apiKey = anthropicApiKey()
    const answer = apiKey
      ? await askIdea(
          {
            ...context.input,
            chip: args.chip,
            currentTitle: context.current?.title,
            currentMinutes: context.current?.prepMinutes,
          },
          [
            ...(avoidTitles ?? []).slice(0, 10).map((title) => title.slice(0, 80)),
            ...context.titles,
          ],
          apiKey,
        )
      : ({ kind: 'unreached' } as const)
    if (answer.kind === 'unreached') {
      await ctx.runMutation(internal.aiUsage.refund, { clerkId: identity.subject })
      return { status: 'unavailable', left: DAILY_AI_CALLS - used + 1, limit: DAILY_AI_CALLS }
    }
    if (answer.kind === 'none')
      return { status: 'none', left: DAILY_AI_CALLS - used, limit: DAILY_AI_CALLS }
    return {
      status: 'ai',
      idea: answer.idea satisfies RecipeIdea,
      left: DAILY_AI_CALLS - used,
      limit: DAILY_AI_CALLS,
    }
  },
})

const snapshotValidator = v.object({
  title: v.string(),
  prepMinutes: v.optional(v.number()),
  recipeId: v.optional(v.id('recipes')),
  mealEntryId: v.optional(v.id('mealEntries')),
  quickLimit: v.optional(quickLimitValidator),
})

/**
 * Kies: an alternative into the slot. With `replaceId` it replaces that
 * planned meal, keeping its servings, note and eaters, and answers what it
 * was for Undo; without, the slot must be empty (a proposal's draft slot),
 * and the draft stays hidden behind the meal until Undo takes the meal away.
 */
export const choose = mutation({
  args: {
    groupSlug: v.string(),
    date: v.string(),
    slot: mealSlotValidator,
    recipeId: v.optional(v.id('recipes')),
    mealEntryId: v.optional(v.id('mealEntries')),
    replaceId: v.optional(v.id('plannedDinners')),
  },
  returns: v.object({
    id: v.id('plannedDinners'),
    previous: v.union(snapshotValidator, v.null()),
  }),
  handler: async (ctx, args) => {
    await rejectConnectedApps(ctx)
    const replaced = args.replaceId
      ? (await requireInGroup(ctx, args.groupSlug, args.replaceId, NOT_FOUND)).doc
      : null
    const id = await planMeal(ctx, {
      groupSlug: args.groupSlug,
      date: args.date,
      slot: args.slot,
      recipeId: args.recipeId,
      mealEntryId: args.mealEntryId,
      replace: replaced !== null,
      replaceId: args.replaceId,
    })
    return {
      id,
      previous: replaced
        ? {
            title: replaced.title,
            prepMinutes: replaced.prepMinutes,
            recipeId: replaced.recipeId,
            mealEntryId: replaced.mealEntryId,
            quickLimit: replaced.quickLimit,
          }
        : null,
    }
  },
})

/**
 * Undo for `choose`: the meal back as it was, or gone again when the slot was
 * empty. Only while the meal still holds what was chosen, so an Undo after
 * someone else changed it writes nothing. A Recipe or quick meal the Group
 * can no longer see is dropped from the snapshot; its title stays.
 */
export const unchoose = mutation({
  args: {
    groupSlug: v.string(),
    id: v.id('plannedDinners'),
    chosen: v.object({
      recipeId: v.optional(v.id('recipes')),
      mealEntryId: v.optional(v.id('mealEntries')),
    }),
    previous: v.union(snapshotValidator, v.null()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    await rejectConnectedApps(ctx)
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const meal = await ctx.db.get(args.id)
    if (!meal || meal.groupId !== group._id) return false
    if (
      meal.recipeId !== args.chosen.recipeId ||
      meal.mealEntryId !== args.chosen.mealEntryId
    )
      return false
    if (!args.previous) {
      await ctx.db.delete(meal._id)
      return true
    }
    const title = args.previous.title.trim().slice(0, MAX_TITLE)
    if (!title) return false
    const recipe = args.previous.recipeId ? await ctx.db.get(args.previous.recipeId) : null
    const entry = args.previous.mealEntryId ? await ctx.db.get(args.previous.mealEntryId) : null
    await ctx.db.patch(meal._id, {
      title,
      prepMinutes: args.previous.prepMinutes,
      recipeId: recipe && isVisibleToGroups(recipe, [group._id]) ? recipe._id : undefined,
      mealEntryId: entry && entry.groupId === group._id ? entry._id : undefined,
      quickLimit: args.previous.quickLimit,
    })
    return true
  },
})

function cleanLines(lines: readonly string[], max: number, count: number) {
  const kept = lines.map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean)
  if (kept.length === 0 || kept.length > count || kept.some((line) => line.length > max))
    throw new ConvexError('That recipe is too long')
  if (kept.some(claimsNutrition))
    throw new ConvexError('A recipe idea has no nutrition values')
  return kept
}

/**
 * Bewaar (en zet op {weekday}): the idea as an ordinary Recipe in the Group,
 * tagged `AI_RECIPE_TAG` and without nutrition. With `plan` it goes in that
 * slot: replacing `replaceId` when given, else only while the slot is empty
 * (`planned: false` otherwise; the recipe is saved either way). The idea is
 * checked again here against the Group's allergens, diets and dislikes.
 */
export const saveIdea = mutation({
  args: {
    groupSlug: v.string(),
    title: v.string(),
    ingredients: v.array(v.string()),
    steps: v.array(v.string()),
    prepMinutes: v.optional(v.number()),
    servings: v.optional(v.number()),
    plan: v.optional(
      v.object({
        date: v.string(),
        slot: mealSlotValidator,
        replaceId: v.optional(v.id('plannedDinners')),
      }),
    ),
  },
  returns: v.object({
    recipeId: v.id('recipes'),
    mealId: v.union(v.id('plannedDinners'), v.null()),
  }),
  handler: async (ctx, args) => {
    await rejectConnectedApps(ctx)
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    const title = args.title.replace(/\s+/g, ' ').trim()
    if (!title || title.length > IDEA_LIMITS.title || claimsNutrition(title))
      throw new ConvexError('A recipe needs a short title')
    const ingredients = cleanLines(args.ingredients, IDEA_LIMITS.ingredient + 20, IDEA_LIMITS.ingredients)
    const steps = cleanLines(args.steps, IDEA_LIMITS.step, IDEA_LIMITS.steps)
    const whole = (value: number | undefined, max: number) =>
      value !== undefined && Number.isInteger(value) && value >= 1 && value <= max
        ? value
        : undefined
    const prefs = await mealPreferencesOf(ctx, group._id, await membersOf(ctx, group._id))
    if (
      ideaClashes(
        { title, ingredients: ingredients.map((name) => ({ name })) },
        prefs,
      ).length > 0
    )
      throw new ConvexError('That recipe clashes with your meal preferences')
    const recipeId = await ctx.db.insert('recipes', {
      groupId: group._id,
      sharedGroupIds: [],
      createdByUserId: user._id,
      title,
      ingredients,
      steps,
      tags: [AI_RECIPE_TAG],
      prepMinutes: whole(args.prepMinutes, IDEA_LIMITS.minutes),
      servings: whole(args.servings, IDEA_LIMITS.servings),
    })
    if (!args.plan) return { recipeId, mealId: null }
    requireDate(args.plan.date)
    // The meal it was to replace may be gone meanwhile: then it is planned
    // like into an empty slot, and never over what someone put there since.
    const replacing = args.plan.replaceId ? await ctx.db.get(args.plan.replaceId) : null
    const replaceId = replacing?.groupId === group._id ? replacing._id : undefined
    if (!replaceId && (await mealAt(ctx, group._id, args.plan.date, args.plan.slot)))
      return { recipeId, mealId: null }
    const mealId: Id<'plannedDinners'> = await planMeal(ctx, {
      groupSlug: args.groupSlug,
      date: args.plan.date,
      slot: args.plan.slot as MealSlot,
      recipeId,
      replace: replaceId !== undefined,
      replaceId,
    })
    return { recipeId, mealId }
  },
})
