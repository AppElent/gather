/**
 * Iets anders and Nieuw idee's model calls (APP-320). Built on Plan mijn
 * week's prompt pieces (`weekPlanAi`): the same slot line, recipe list and
 * rules, and the same `askModel`, so a call that never reached the model is
 * the only one given back to the daily cap. The model sees no names, no
 * event titles and no Group.
 */
import {
  acceptAiIdea,
  acceptAiSwaps,
  IDEA_LIMITS,
  type RecipeIdea,
  SWAP_COUNT,
  type SwapChip,
  type SwapPick,
} from '@gather/core/meal-ideas'
import { REASON_MAX, type WeekPlanRecipe } from '@gather/core/week-plan'
import type { AnthropicTool } from './anthropic'
import {
  askModel,
  recipeLines,
  ruleLines,
  slotLine,
  type WeekPlanPromptInput,
} from './weekPlanAi'

/** Plan mijn week's input with one target: the slot asked about. */
export interface MealIdeaPromptInput extends WeekPlanPromptInput {
  chip?: SwapChip
  /** What the slot holds now. */
  currentTitle?: string
  currentMinutes?: number
}

const CHIP_WORDS: Record<SwapChip, string> = {
  chickenQuick: 'with chicken, and quick',
  meatFree: 'meat-free',
  faster: 'quicker than what is planned now',
}

const SWAP_TOOL: AnthropicTool = {
  name: 'propose_alternatives',
  description: `Propose ${SWAP_COUNT} alternatives for one meal, each a recipe id from the list.`,
  input_schema: {
    type: 'object',
    properties: {
      alternatives: {
        type: 'array',
        maxItems: SWAP_COUNT,
        items: {
          type: 'object',
          properties: {
            recipeId: { type: 'string', description: 'An id from the recipe list, exactly as given' },
            reason: {
              type: 'string',
              description: `One short, concrete reason from the data, at most ${REASON_MAX} characters, without the minutes`,
            },
          },
          required: ['recipeId', 'reason'],
        },
      },
    },
    required: ['alternatives'],
  },
}

const IDEA_TOOL: AnthropicTool = {
  name: 'write_recipe',
  description: 'Write one new home-cooking recipe.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: `At most ${IDEA_LIMITS.title} characters` },
      why: {
        type: 'string',
        description: `One or two short sentences on why it fits: the wish, the stock it uses, an allergy it avoids. At most ${IDEA_LIMITS.why} characters`,
      },
      minutes: { type: 'integer', description: 'Total minutes from start to table' },
      ingredients: {
        type: 'array',
        maxItems: IDEA_LIMITS.ingredients,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'The ingredient, without the amount' },
            quantity: { type: 'number', description: 'For the servings asked' },
            unit: {
              type: 'string',
              description: 'g, kg, ml, l, el, tl, stuks, blik, teentje, bos or snuf; leave out for a count',
            },
          },
          required: ['name'],
        },
      },
      steps: {
        type: 'array',
        maxItems: IDEA_LIMITS.steps,
        items: { type: 'string' },
      },
    },
    required: ['title', 'ingredients', 'steps', 'minutes'],
  },
}

function language(input: MealIdeaPromptInput) {
  return input.locale === 'nl' ? 'Dutch' : 'English'
}

/** What the slot holds and what the person asked for. */
function askLines(input: MealIdeaPromptInput): string[] {
  const asked = [
    input.chip ? CHIP_WORDS[input.chip] : null,
    input.wish ? JSON.stringify(input.wish) : null,
  ].filter(Boolean)
  return [
    'The slot:',
    slotLine(input.targets[0], input),
    input.currentTitle
      ? `Planned now: ${JSON.stringify(input.currentTitle.slice(0, 80))}${input.currentMinutes ? `, ${input.currentMinutes} min` : ''}.`
      : '',
    asked.length > 0 ? `They ask for: ${asked.join('; ')}.` : '',
  ]
}

function stockLines(input: MealIdeaPromptInput): string[] {
  return [
    input.stock.low.length > 0 ? `Running low: ${input.stock.low.slice(0, 20).join(', ')}.` : '',
    input.stock.inStock.length > 0 ? `In stock: ${input.stock.inStock.slice(0, 40).join(', ')}.` : '',
  ]
}

function compact(lines: string[]): string {
  return lines
    .filter((line, index, all) => line !== '' || all[index - 1] !== '')
    .join('\n')
}

/** Iets anders: pick three from the pool it is shown. */
export function swapPrompt(input: MealIdeaPromptInput, pool: readonly WeekPlanRecipe[]): string {
  const rules = ruleLines(input)
  return compact([
    'A household wants something else for one planned meal.',
    `Pick ${SWAP_COUNT} different recipes from the list below for this slot. Use only ids from the list; never invent one. Follow what they ask for. Prefer recipes within the time limit; on a busy evening, quick ones.`,
    `Write each reason in ${language(input)}: short and concrete, from the data (time against the evening, stock item used, rating, last cooked, what they asked for). Say so when it takes longer than the limit. Do not mention minutes otherwise; the app adds them.`,
    '',
    ...askLines(input),
    '',
    rules.length > 0 ? `Rules:\n${rules.join('\n')}` : 'Rules: none.',
    ...stockLines(input),
    '',
    'Recipes (id | title | minutes | rating | last cooked | tags):',
    ...(pool.length > 0 ? recipeLines(pool, input.today) : ['(none)']),
  ])
}

/** Nieuw idee: one new recipe, never with nutrition. */
export function ideaPrompt(input: MealIdeaPromptInput, avoidTitles: readonly string[]): string {
  const target = input.targets[0]
  return compact([
    'A household wants a new recipe idea for one meal: nothing in their collection fits.',
    `Write one simple home-cooking recipe for ${target.eaters} ${target.eaters === 1 ? 'person' : 'people'}, in ${language(input)}: a title, the ingredients with amounts for ${target.eaters}, short numbered-style steps, and the total minutes. Keep within the time limit. Use what is in stock where it fits, above all what is running low.`,
    'Never give nutrition values: no calories, kcal, protein, carbohydrates, fat or other nutrients, anywhere.',
    input.allergens.length > 0
      ? `Allergies: never use an ingredient with ${input.allergens.join(', ')}, nor one that may contain it.`
      : '',
    input.diets.length > 0 ? `Diets: the recipe must be ${input.diets.join(', ')}.` : '',
    input.dislikes.length > 0 ? `Never use: ${input.dislikes.slice(0, 20).join(', ')}.` : '',
    'In "why", say in a sentence or two why it fits: their wish, the stock it uses, the allergy it avoids.',
    '',
    ...askLines(input),
    ...stockLines(input),
    avoidTitles.length > 0
      ? `Not one of these (already in their collection, or just turned down): ${avoidTitles.slice(0, 40).map((t) => JSON.stringify(t.slice(0, 60))).join(', ')}.`
      : '',
  ])
}

/**
 * Ask for alternatives, or null when the model was never reached. A reached
 * model's unusable answer is an empty list: paid for, and the rules fill it.
 */
export async function askSwaps(
  input: MealIdeaPromptInput,
  pool: readonly WeekPlanRecipe[],
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SwapPick[] | null> {
  const shown = pool.slice(0, 80)
  const { reached, answer } = await askModel({
    apiKey,
    tool: SWAP_TOOL,
    maxTokens: 512,
    prompt: swapPrompt(input, shown),
    fetchImpl,
  })
  if (!answer) return reached ? [] : null
  return acceptAiSwaps(answer.alternatives, shown)
}

/**
 * Ask for a new recipe: `unreached` when the model never answered, `none`
 * when it answered without a recipe that is usable and clear of the Group's
 * allergens, diets and dislikes (counted: the call was made).
 */
export async function askIdea(
  input: MealIdeaPromptInput,
  avoidTitles: readonly string[],
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ kind: 'idea'; idea: RecipeIdea } | { kind: 'none' } | { kind: 'unreached' }> {
  const { reached, answer } = await askModel({
    apiKey,
    tool: IDEA_TOOL,
    maxTokens: 2048,
    prompt: ideaPrompt(input, avoidTitles),
    fetchImpl,
  })
  if (!reached) return { kind: 'unreached' }
  const idea = answer ? acceptAiIdea(answer, input, input.targets[0].eaters) : null
  return idea ? { kind: 'idea', idea } : { kind: 'none' }
}
