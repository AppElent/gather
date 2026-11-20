/**
 * Plan mijn week's one model call (APP-319). The model gets a small, numbered
 * picture of the week (no names, no event titles, no Group): the slots to fill
 * with their time budget, the Group's plannable recipes as id, title, minutes,
 * tags, rating and how long ago they were cooked, the rules, what is in stock
 * and the person's wish. It answers through one tool, and
 * `acceptAiPicks` (@gather/core/week-plan) keeps only valid picks.
 */

import { daysBetween } from '@gather/core/civil-date'
import { weekdayIndex } from '@gather/core/meal-planner'
import type { Allergen, Diet } from '@gather/core/meal-preferences'
import {
  AI_RECIPES_MAX,
  acceptAiPicks,
  QUICK_MEAL_NAME_MAX,
  REASON_MAX,
  targetLimit,
  type WeekPlanInput,
  type WeekPlanPick,
  type WeekPlanWish,
} from '@gather/core/week-plan'
import { type AnthropicTool, callAnthropicTool } from './anthropic'

const PLAN_TOOL: AnthropicTool = {
  name: 'propose_week_plan',
  description:
    'Propose one meal for each slot to fill: a recipe id from the list, or a quick meal by name.',
  input_schema: {
    type: 'object',
    properties: {
      meals: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'YYYY-MM-DD, from the slots' },
            slot: { type: 'string', enum: ['breakfast', 'lunch', 'dinner'] },
            recipeId: {
              type: 'string',
              description: 'An id from the recipe list, exactly as given',
            },
            quickMeal: {
              type: 'string',
              description: `Only when no recipe fits: a simple meal without a recipe, at most ${QUICK_MEAL_NAME_MAX} characters`,
            },
            minutes: { type: 'number', description: 'Minutes, for a quick meal' },
            reason: {
              type: 'string',
              description: `One short, concrete reason from the data, at most ${REASON_MAX} characters, without the minutes`,
            },
          },
          required: ['date', 'slot', 'reason'],
        },
      },
    },
    required: ['meals'],
  },
}

const WEEKDAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export interface WeekPlanPromptInput extends WeekPlanInput {
  /** The person's language: the reasons are written in it. */
  locale: 'nl' | 'en'
  wish?: string
  diets: readonly Diet[]
  allergens: readonly Allergen[]
  dislikes: readonly string[]
  /** Titles already planned this week, for variety. */
  plannedTitles: readonly string[]
  /** The day the plan is made, for "cooked N days ago". */
  today: string
}

const WISH_WORDS: Record<WeekPlanWish, string> = {
  moreVeg: 'lots of vegetables',
  somethingNew: 'one recipe they have not cooked before',
  useLow: 'use what is running low',
}

/** The recipe list as the model sees it: id | title | minutes | rating | last cooked | tags. */
export function recipeLines(
  recipes: WeekPlanPromptInput['recipes'],
  today: string,
): string[] {
  return recipes.slice(0, AI_RECIPES_MAX).map((recipe) => {
    const parts = [
      recipe.id,
      JSON.stringify(recipe.title.slice(0, 80)),
      recipe.prepMinutes !== undefined ? `${recipe.prepMinutes} min` : 'time unknown',
    ]
    if (recipe.rating !== undefined) parts.push(`rated ${recipe.rating}/5`)
    parts.push(
      recipe.lastCooked
        ? `cooked ${daysBetween(recipe.lastCooked, today)} days ago`
        : 'never planned',
    )
    if (recipe.tags.length > 0)
      parts.push(`tags: ${recipe.tags.slice(0, 5).join(', ').slice(0, 60)}`)
    return `- ${parts.join(' | ')}`
  })
}

/** The Group's rules, one line each, for any meal planner prompt. */
export function ruleLines(input: WeekPlanPromptInput): string[] {
  return [
    input.diets.length > 0 && `Diets: ${input.diets.join(', ')}.`,
    input.allergens.length > 0 &&
      `Allergies (already filtered out of the list; never suggest a quick meal with them; a quick meal you name yourself is dropped, so use a recipe or one of the household's own quick meals): ${input.allergens.join(', ')}.`,
    input.dislikes.length > 0 &&
      `Disliked (never in a quick meal): ${input.dislikes.slice(0, 20).join(', ')}.`,
    input.prefs.noRepeatDays > 0 &&
      `Variety: avoid recipes cooked in the last ${input.prefs.noRepeatDays} days.`,
    input.prefs.meatFreeNights > 0 &&
      `${input.prefs.meatFreeNights} meat-free dinners this week.`,
    input.prefs.smart.preferHighRated &&
      'Prefer higher rated recipes and ones not cooked for a long time.',
    input.prefs.smart.useStock &&
      input.stock.inStock.length + input.stock.low.length > 0 &&
      'Prefer recipes that use what is in stock, especially what is running low.',
  ].filter((line): line is string => typeof line === 'string')
}

/** A slot as the model sees it: day, slot, time, eaters, busy evening, fish day. */
export function slotLine(target: WeekPlanPromptInput['targets'][number], input: WeekPlanPromptInput): string {
    const limit = targetLimit(target)
    const parts = [
      `${target.date} ${WEEKDAYS_EN[weekdayIndex(target.date)]} ${target.slot}`,
      limit === null ? 'no time limit' : `max ${limit} min`,
      `${target.eaters} eating`,
    ]
    if (target.busyAt !== undefined)
      parts.push(
        `busy evening from ${String(Math.floor(target.busyAt / 60)).padStart(2, '0')}:${String(target.busyAt % 60).padStart(2, '0')}`,
      )
    const weekday = weekdayIndex(target.date)
    if (input.prefs.fishDays.some((day) => day === weekday)) parts.push('fish day')
    if (input.prefs.leftoverDays.some((day) => day === weekday))
      parts.push('cook double for leftovers tomorrow')
    return `- ${parts.join(', ')}`
}

/** The prompt: rules first, then the data, as compact lines. */
export function weekPlanPrompt(input: WeekPlanPromptInput): string {
  const language = input.locale === 'nl' ? 'Dutch' : 'English'
  const slots = input.targets.map((target) => slotLine(target, input))
  const recipes = recipeLines(input.recipes, input.today)
  const rules = ruleLines(input)
  const planned = new Set(input.plannedTitles)
  const turnedDown = input.skipQuickMeals.filter((title) => !planned.has(title))
  const wishes = [
    ...input.wishes.map((wish) => WISH_WORDS[wish]),
    input.wish ? JSON.stringify(input.wish) : null,
  ].filter(Boolean)
  return [
    'You plan a household week menu from their own recipes.',
    'Fill every slot below with exactly one meal. Use a recipe id from the list whenever one fits; never invent an id. Use each recipe at most once. Keep within each slot\'s time limit. Match the meal: a recipe tagged for breakfast only at breakfast, never a dessert or a bake. On a busy evening choose something quick. Only when no recipe fits, name a simple quick meal instead.',
    `Write each reason in ${language}: short and concrete, from the data (busy evening, time, how many eat, stock item used, rating, last cooked, fish day, variety). Do not mention minutes; the app adds them.`,
    '',
    'Slots to fill:',
    ...slots,
    '',
    rules.length > 0 ? `Rules:\n${rules.join('\n')}` : 'Rules: none.',
    input.plannedTitles.length > 0
      ? `Already planned this week: ${input.plannedTitles.slice(0, 21).map((t) => JSON.stringify(t.slice(0, 60))).join(', ')}.`
      : '',
    turnedDown.length > 0
      ? `Not again (just turned down or proposed for another day): ${turnedDown.slice(0, 21).map((t) => JSON.stringify(t.slice(0, 60))).join(', ')}.`
      : '',
    input.stock.low.length > 0
      ? `Running low: ${input.stock.low.slice(0, 20).join(', ')}.`
      : '',
    input.stock.inStock.length > 0
      ? `In stock: ${input.stock.inStock.slice(0, 40).join(', ')}.`
      : '',
    input.quickMeals.length > 0
      ? `The household's own quick meals: ${input.quickMeals.slice(0, 20).map((q) => JSON.stringify(q.title)).join(', ')}.`
      : '',
    wishes.length > 0 ? `Wish for this week: ${wishes.join('; ')}.` : '',
    '',
    'Recipes (id | title | minutes | rating | last cooked | tags):',
    ...(recipes.length > 0 ? recipes : ['(none)']),
  ]
    .filter((line, index, lines) => line !== '' || lines[index - 1] !== '')
    .join('\n')
}

/**
 * Ask the model for the week, or null when the model was never reached (no
 * response, a network error, a refused call). Once it answered, the call was
 * paid for: an answer without usable picks (the tool not used, cut off at
 * the token limit, malformed) is an empty list, and the rules fill the week.
 * Without this a wish that makes the model answer badly would plan for free.
 */
export async function askWeekPlan(
  input: WeekPlanPromptInput,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<WeekPlanPick[] | null> {
  const { reached, answer } = await askModel({
    apiKey,
    tool: PLAN_TOOL,
    maxTokens: 2048,
    prompt: weekPlanPrompt(input),
    fetchImpl,
  })
  if (!answer || !Array.isArray(answer.meals)) return reached ? [] : null
  return acceptAiPicks(answer.meals, {
    ...input,
    recipes: input.recipes.slice(0, AI_RECIPES_MAX),
  })
}

/**
 * One tool call, and whether the model was reached at all: a reached model
 * was paid for even when its answer is unusable, so only an unreached one is
 * given back to the daily cap (Plan mijn week, Iets anders, Nieuw idee).
 * Reached means a 2xx response whose body is JSON: a 2xx that isn't (a proxy
 * page, a body cut off in transit) is no answer from the model (APP-460).
 */
export async function askModel(args: {
  apiKey: string
  tool: AnthropicTool
  maxTokens: number
  prompt: string
  fetchImpl?: typeof fetch
}): Promise<{ reached: boolean; answer: Record<string, unknown> | null }> {
  const fetchImpl = args.fetchImpl ?? fetch
  let reached = false
  const answer = await callAnthropicTool({
    apiKey: args.apiKey,
    tool: args.tool,
    maxTokens: args.maxTokens,
    prompt: args.prompt,
    fetchImpl: (async (url: URL | RequestInfo, init?: RequestInit) => {
      const response = await fetchImpl(url, init)
      if (!response.ok) return response
      // The body is read here, once, to tell a JSON answer from one that isn't.
      let body: unknown
      try {
        body = await response.json()
      } catch {
        return { ok: false, status: response.status } as Response
      }
      reached = true
      return { ok: true, status: response.status, json: async () => body } as Response
    }) as typeof fetch,
  })
  return { reached, answer }
}
