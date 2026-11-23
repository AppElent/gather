/**
 * Iets anders and Nieuw idee (APP-320, designs/meal-planner section 4),
 * without React and without Convex.
 *
 * Iets anders: three alternatives for one slot, from the Group's own recipes
 * (and, when those run out, its own quick meals). The pool is the week plan's
 * (`plannableRecipes`, so a certain allergen, diet or dislike clash never gets
 * in), minus what is already planned that week, minus what the chip rules
 * out. The model may only pick from that pool (`acceptAiSwaps`); the rules
 * (`rulesSwaps`) fill what it leaves, and are the whole answer when the model
 * is not reachable.
 *
 * Nieuw idee: one new recipe the model writes. `acceptAiIdea` keeps it to
 * title, ingredients, steps and minutes, drops any line that talks nutrition
 * (ADR-0041: Gather never claims nutrition values), and refuses an idea with a
 * certain clash with the Group's allergens, diets or dislikes. What the
 * matcher cannot rule out is left to the person: the draft always says
 * "Controleer zelf op allergieën".
 */
import {
  normalizeText,
  type RecipeClash,
  recipeClashes,
} from './mealPreferenceMatching'
import type { ResolvedMealPreferences } from './mealPreferences'
import {
  cleanText,
  fitsSlot,
  fitsTime,
  isMeatFree,
  quickMealKey,
  score,
  stockUsed,
  targetLimit,
  type WeekPlanInput,
  type WeekPlanQuickMeal,
  type WeekPlanRecipe,
} from './weekPlan'

/** Alternatives one ask shows. */
export const SWAP_COUNT = 3
/** The Swap sheet's three single-select chips. */
export const SWAP_CHIPS = ['chickenQuick', 'meatFree', 'faster'] as const
export type SwapChip = (typeof SWAP_CHIPS)[number]
/** "Met kip, snel": at most this long. */
export const QUICK_CHICKEN_MINUTES = 30

/**
 * The tag a recipe written by Nieuw idee is saved with: "bron AI". A tag, not
 * a field, so the saved recipe is an ordinary Recipe in every app build; the
 * phone shows it as "Door AI bedacht".
 */
export const AI_RECIPE_TAG = 'AI'

/** Whether a recipe's tags say Nieuw idee wrote it. */
export function isAiRecipe(recipe: { tags: readonly string[] }): boolean {
  return recipe.tags.some((tag) => tag.trim() === AI_RECIPE_TAG)
}

/** What a saved idea may hold at most. */
export const IDEA_LIMITS = {
  title: 80,
  ingredients: 25,
  ingredient: 80,
  steps: 12,
  step: 400,
  why: 200,
  minutes: 240,
  servings: 20,
} as const

/** Plan mijn week's input, its one target the slot being swapped. */
export interface SwapInput extends WeekPlanInput {
  /** What is there now, kept out of the alternatives. */
  current?: { recipeId?: string; quickMeal?: string; prepMinutes?: number }
  chip?: SwapChip
}

/** One alternative. Exactly one of `recipeId` and `quickMealId` is set. */
export interface SwapPick {
  recipeId?: string
  quickMealId?: string
  title: string
  prepMinutes?: number
  rating?: number
  /** The model's reason line, in the Group's language. */
  reason?: string
  /** Why the rules chose it, for the phone to word (see `rulesReason`). */
  rulesReason?: SwapRulesReason
}

/** Stock names a rules reason names at most. */
export const REASON_STOCK_MAX = 2

/**
 * Why the rules offered an alternative, as facts the phone words: the stock it
 * uses (running low first) and the evening's time it fits. Empty when the
 * rules have nothing to say beyond "volgens jullie regels".
 */
export interface SwapRulesReason {
  /** Running-low names its ingredient lines mention. */
  low: string[]
  /** In-stock names its ingredient lines mention, after `low`. */
  inStock: string[]
  /** The evening's limit in minutes, when it has one and the pick fits it. */
  fitsMinutes?: number
}

/**
 * The rules' reason for one alternative. Stock counts only when the Group
 * plans with stock (`smart.useStock`), as `score` weighs it; time only when
 * the evening has a limit and the minutes are known and fit.
 */
export function rulesReason(
  pick: { ingredients?: readonly string[]; prepMinutes?: number },
  input: SwapInput,
): SwapRulesReason {
  const limit = targetLimit(input.targets[0])
  const fits =
    limit !== null && pick.prepMinutes !== undefined && pick.prepMinutes <= limit
  let low: string[] = []
  let inStock: string[] = []
  if (input.prefs.smart.useStock && pick.ingredients?.length) {
    const recipe = { ingredients: pick.ingredients }
    low = stockUsed(recipe, input.stock.low).slice(0, REASON_STOCK_MAX)
    inStock = stockUsed(recipe, input.stock.inStock)
      .filter((name) => !low.includes(name))
      .slice(0, REASON_STOCK_MAX - low.length)
  }
  return { low, inStock, ...(fits ? { fitsMinutes: limit } : {}) }
}

/** "kip", "kipfilet", "kippendijen", "chicken": the chip's meat, in a title or line. */
const CHICKEN = /(^|\s)(kip|chicken)/

function mentionsChicken(recipe: Pick<WeekPlanRecipe, 'title' | 'ingredients'>): boolean {
  return [recipe.title, ...recipe.ingredients].some((line) =>
    CHICKEN.test(normalizeText(line)),
  )
}

/** The most a "Sneller" alternative may take: less than what is there now. */
function fasterThan(input: SwapInput): number {
  const now = input.current?.prepMinutes ?? targetLimit(input.targets[0]) ?? 30
  return Math.max(5, now - 5)
}

function chipFits(recipe: WeekPlanRecipe, input: SwapInput): boolean {
  switch (input.chip) {
    case 'chickenQuick':
      return (
        mentionsChicken(recipe) &&
        recipe.prepMinutes !== undefined &&
        recipe.prepMinutes <= QUICK_CHICKEN_MINUTES
      )
    case 'meatFree':
      return isMeatFree(recipe)
    case 'faster':
      return recipe.prepMinutes !== undefined && recipe.prepMinutes <= fasterThan(input)
    default:
      return true
  }
}

/**
 * The recipes an alternative may be: plannable (the caller filtered hard
 * clashes), right for the slot, not what is there now nor elsewhere in the
 * week, and what the chip asks for. Time is weighed, not filtered: a recipe
 * over the evening's time may still be offered, last.
 */
export function swapPool(input: SwapInput): WeekPlanRecipe[] {
  const target = input.targets[0]
  const planned = new Set(input.plannedRecipeIds)
  if (input.current?.recipeId) planned.add(input.current.recipeId)
  return input.recipes.filter(
    (recipe) =>
      !planned.has(recipe.id) &&
      fitsSlot(recipe, target.slot) &&
      chipFits(recipe, input),
  )
}

/** The Group's own quick meals an alternative may be, when recipes run out. */
function quickPool(input: SwapInput): WeekPlanQuickMeal[] {
  const skip = new Set(input.skipQuickMeals.map(quickMealKey))
  if (input.current?.quickMeal) skip.add(quickMealKey(input.current.quickMeal))
  // A quick meal has no ingredients, so the chips that need them leave it out.
  if (input.chip === 'chickenQuick' || input.chip === 'meatFree') return []
  const limit =
    input.chip === 'faster' ? fasterThan(input) : targetLimit(input.targets[0])
  return input.quickMeals.filter(
    (meal) => !skip.has(quickMealKey(meal.title)) && fitsTime(meal.prepMinutes, limit),
  )
}

/** Best first: within the evening's time before anything over it. */
function ranked(input: SwapInput, pool: readonly WeekPlanRecipe[]): WeekPlanRecipe[] {
  const target = input.targets[0]
  const limit = targetLimit(target)
  return pool
    .map((recipe) => ({
      recipe,
      fits: fitsTime(recipe.prepMinutes, limit),
      value: score(recipe, target, input),
    }))
    .sort(
      (a, b) =>
        Number(b.fits) - Number(a.fits) ||
        b.value - a.value ||
        a.recipe.title.localeCompare(b.recipe.title),
    )
    .map((entry) => entry.recipe)
}

function recipePick(recipe: WeekPlanRecipe, reason?: string): SwapPick {
  return {
    recipeId: recipe.id,
    title: recipe.title,
    prepMinutes: recipe.prepMinutes,
    rating: recipe.rating,
    reason,
  }
}

/**
 * The rules' alternatives: the best `SWAP_COUNT` recipes of the pool, then the
 * Group's quick meals that fit, quickest first. `exclude` keeps out what the
 * model already picked.
 */
export function rulesSwaps(
  input: SwapInput,
  exclude: ReadonlySet<string> = new Set(),
  count: number = SWAP_COUNT,
): SwapPick[] {
  if (count <= 0) return []
  const recipes = ranked(input, swapPool(input))
    .filter((recipe) => !exclude.has(recipe.id))
    .slice(0, count)
    .map((recipe) => ({ ...recipePick(recipe), rulesReason: rulesReason(recipe, input) }))
  if (recipes.length >= count) return recipes
  const quick = quickPool(input)
    .filter((meal) => !exclude.has(meal.id))
    .sort(
      (a, b) =>
        (a.prepMinutes ?? 99) - (b.prepMinutes ?? 99) || a.title.localeCompare(b.title),
    )
    .slice(0, count - recipes.length)
    .map((meal) => ({
      quickMealId: meal.id,
      title: meal.title,
      prepMinutes: meal.prepMinutes,
      rulesReason: rulesReason(meal, input),
    }))
  return [...recipes, ...quick]
}

/**
 * The model's alternatives, kept to what it may say: a recipe id from the
 * pool it was shown, each once, at most `SWAP_COUNT`. Anything else, an
 * invented id above all, is dropped.
 */
export function acceptAiSwaps(raw: unknown, pool: readonly WeekPlanRecipe[]): SwapPick[] {
  if (!Array.isArray(raw)) return []
  const byId = new Map(pool.map((recipe) => [recipe.id, recipe]))
  const seen = new Set<string>()
  const picks: SwapPick[] = []
  for (const entry of raw) {
    if (picks.length >= SWAP_COUNT) break
    if (typeof entry !== 'object' || entry === null) continue
    const item = entry as Record<string, unknown>
    const id = typeof item.recipeId === 'string' ? item.recipeId.trim() : ''
    const recipe = byId.get(id)
    if (!recipe || seen.has(id)) continue
    seen.add(id)
    picks.push(recipePick(recipe, cleanText(item.reason, 90)))
  }
  return picks
}

/** The model's picks, then the rules' for every place it left. */
export function completeSwaps(
  aiPicks: readonly SwapPick[],
  input: SwapInput,
): (SwapPick & { source: 'ai' | 'rules' })[] {
  const taken = new Set(aiPicks.flatMap((pick) => (pick.recipeId ? [pick.recipeId] : [])))
  return [
    ...aiPicks.map((pick) => ({ ...pick, source: 'ai' as const })),
    ...rulesSwaps(input, taken, SWAP_COUNT - aiPicks.length).map((pick) => ({
      ...pick,
      source: 'rules' as const,
    })),
  ]
}

/** One ingredient of an idea: a name, and an amount when it has one. */
export interface IdeaIngredient {
  name: string
  quantity?: number
  unit?: string
}

/** A recipe Nieuw idee wrote, as the draft shows it. */
export interface RecipeIdea {
  title: string
  ingredients: IdeaIngredient[]
  steps: string[]
  prepMinutes?: number
  /** The servings the amounts are for. */
  servings: number
  /** "Op je wens …. Gebruikt de pompoen …": why this idea. */
  why?: string
}

/**
 * Words that claim nutrition. A line with one is dropped from an idea:
 * Gather gives no nutrition values (ADR-0041), and a model asked not to may
 * still add "± 450 kcal per portie".
 */
const NUTRITION =
  /(^|[^a-z])(kcal|kj|kilocalorie\w*|kilojoule\w*|calorie\w*|calorieen|voedingswaarde\w*|nutrition\w*|nutrient\w*|macro\w*|eiwitten|proteine\w*|protein\w*|koolhydraten|carbs?|carbohydrates?|vetten|fat grams)([^a-z]|$)/

/** Whether a line talks nutrition (see `NUTRITION`). */
export function claimsNutrition(line: string): boolean {
  return NUTRITION.test(normalizeText(line))
}

function cleanLine(value: unknown, max: number): string | undefined {
  const text = cleanText(value, max)
  return text && !claimsNutrition(text) ? text : undefined
}

function cleanUnit(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const unit = value.trim().toLocaleLowerCase()
  return unit && unit.length <= 12 ? unit : undefined
}

/** The preferences an idea is checked against. */
export interface IdeaPrefs {
  allergens: readonly ResolvedMealPreferences['allergens'][number][]
  diets: readonly ResolvedMealPreferences['diets'][number][]
  dislikes: readonly string[]
}

/** The certain clashes that refuse an idea; time is not one of them. */
export function ideaClashes(
  idea: Pick<RecipeIdea, 'title' | 'ingredients'>,
  prefs: IdeaPrefs,
): RecipeClash[] {
  return recipeClashes(
    {
      title: idea.title,
      ingredients: idea.ingredients.map((ingredient) => ingredient.name),
      tags: [],
    },
    {
      allergens: [...prefs.allergens],
      diets: [...prefs.diets],
      dislikes: [...prefs.dislikes],
      cookingMinutes: [null, null, null, null, null, null, null],
    },
    0,
  ).filter((clash) => clash.kind !== 'time' && clash.uncertain !== true)
}

/**
 * The model's idea, or null when there is no usable recipe in it (no title,
 * no ingredients or no steps), or when it certainly clashes with the Group's
 * allergens, diets or dislikes. Nutrition lines are dropped; the rest is
 * trimmed to `IDEA_LIMITS`.
 */
export function acceptAiIdea(
  raw: unknown,
  prefs: IdeaPrefs,
  servings: number,
): RecipeIdea | null {
  if (typeof raw !== 'object' || raw === null) return null
  const item = raw as Record<string, unknown>
  const title = cleanLine(item.title, IDEA_LIMITS.title)
  if (!title) return null
  const ingredients: IdeaIngredient[] = []
  for (const entry of Array.isArray(item.ingredients) ? item.ingredients : []) {
    if (ingredients.length >= IDEA_LIMITS.ingredients) break
    const row: Record<string, unknown> =
      typeof entry === 'object' && entry !== null
        ? (entry as Record<string, unknown>)
        : { name: entry }
    const name = cleanLine(row.name, IDEA_LIMITS.ingredient)
    if (!name) continue
    const quantity =
      typeof row.quantity === 'number' && Number.isFinite(row.quantity) && row.quantity > 0 && row.quantity <= 10000
        ? Math.round(row.quantity * 100) / 100
        : undefined
    ingredients.push({
      name,
      ...(quantity !== undefined ? { quantity } : {}),
      ...(quantity !== undefined && cleanUnit(row.unit) ? { unit: cleanUnit(row.unit) } : {}),
    })
  }
  const steps = (Array.isArray(item.steps) ? item.steps : [])
    .map((step) => cleanLine(step, IDEA_LIMITS.step))
    .filter((step): step is string => step !== undefined)
    .slice(0, IDEA_LIMITS.steps)
  if (ingredients.length === 0 || steps.length === 0) return null
  const minutes =
    typeof item.minutes === 'number' &&
    Number.isInteger(item.minutes) &&
    item.minutes > 0 &&
    item.minutes <= IDEA_LIMITS.minutes
      ? item.minutes
      : undefined
  const idea: RecipeIdea = {
    title,
    ingredients,
    steps,
    prepMinutes: minutes,
    servings: Math.min(Math.max(1, Math.round(servings)), IDEA_LIMITS.servings),
    why: cleanLine(item.why, IDEA_LIMITS.why),
  }
  return ideaClashes(idea, prefs).length > 0 ? null : idea
}
