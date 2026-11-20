/**
 * Plan mijn week (APP-319): which recipe or quick meal goes in each empty slot
 * of a week, without React and without Convex.
 *
 * Two planners share one input. The model's answer goes through
 * `acceptAiPicks`, which keeps only what it was allowed to say: a recipe id
 * from the list it was given, or a quick meal by name, once per slot asked
 * for. `rulesPlan` is the deterministic plan used when the model is not
 * reachable, and to fill a slot the model left empty or got wrong. Both only
 * ever look at the slots they were asked to fill, so a planned meal is never
 * touched.
 *
 * Hard rules (a recipe that certainly clashes with the Group's allergens,
 * diets or dislikes) are applied before either planner sees a recipe:
 * `plannableRecipes`. Everything else (time per weekday, variety, busy
 * evenings, stock, rating) is a preference the rules planner weighs and the
 * model is asked to weigh.
 *
 * Weekdays are 0..6, Monday first, as in `meal-preferences`.
 */
import { daysBetween } from './civilDate'
import { MEAL_SLOTS, type MealSlot, weekdayIndex } from './mealPlanner'
import {
  normalizeText,
  recipeClashes,
} from './mealPreferenceMatching'
import type { ResolvedMealPreferences } from './mealPreferences'

/** The longest a busy evening's meal may take, whatever the weekday allows. */
export const BUSY_EVENING_MINUTES = 20
/** A quick meal's name as the model or a person may give it. */
export const QUICK_MEAL_NAME_MAX = 60
/** A reason line: one short sentence. */
export const REASON_MAX = 90
/** A wish typed on the start sheet. */
export const WISH_MAX = 200
/** Recipes the model is shown at most; the best by the rules go first. */
export const AI_RECIPES_MAX = 80
/** Drafts are kept this long (design section 3). */
export const DRAFT_LIFETIME_MS = 24 * 60 * 60 * 1000

/** The start sheet's three toggle chips. */
export const WEEK_PLAN_WISHES = ['moreVeg', 'somethingNew', 'useLow'] as const
export type WeekPlanWish = (typeof WEEK_PLAN_WISHES)[number]

export interface WeekPlanRecipe {
  id: string
  title: string
  prepMinutes?: number
  tags: readonly string[]
  ingredients: readonly string[]
  rating?: number
  /** `YYYY-MM-DD` of the last day it was planned before the week, if ever. */
  lastCooked?: string
}

export interface WeekPlanQuickMeal {
  id: string
  title: string
  prepMinutes?: number
}

/** One slot to fill, with what that evening allows. */
export interface WeekPlanTarget {
  date: string
  slot: MealSlot
  /** The weekday's cooking time; null is no maximum. */
  maxMinutes: number | null
  /** Start of the first evening event, in minutes after midnight. */
  busyAt?: number
  /** How many eat along. */
  eaters: number
}

export interface WeekPlanInput {
  targets: readonly WeekPlanTarget[]
  recipes: readonly WeekPlanRecipe[]
  quickMeals: readonly WeekPlanQuickMeal[]
  /** Recipe ids already planned in the week, kept out of the proposal. */
  plannedRecipeIds: readonly string[]
  /** Dinners already planned in the week, by date, for leftovers. */
  plannedDinnerDates: readonly string[]
  /** Names of what is in stock, and of what is running low. */
  stock: { inStock: readonly string[]; low: readonly string[] }
  prefs: Pick<
    ResolvedMealPreferences,
    | 'allergens'
    | 'diets'
    | 'dislikes'
    | 'cookingMinutes'
    | 'noRepeatDays'
    | 'meatFreeNights'
    | 'fishDays'
    | 'leftoverDays'
    | 'smart'
  >
  wishes: readonly WeekPlanWish[]
  /**
   * Quick meals by name that must not be proposed: those already in the
   * week, and on regenerate the one being replaced and the other drafts'.
   */
  skipQuickMeals: readonly string[]
  /** The quick meal a leftover evening gets, in the reader's language. */
  leftoversName: string
}

/** One proposed meal. Exactly one of `recipeId` and `quickMeal` is set. */
export interface WeekPlanPick {
  date: string
  slot: MealSlot
  recipeId?: string
  /** A quick meal by name; `quickMealId` when it is one the Group has. */
  quickMeal?: string
  quickMealId?: string
  prepMinutes?: number
  /** The model's reason line; the rules planner leaves it out. */
  reason?: string
}

/**
 * The recipes a plan may draw from: those with no certain clash with the
 * Group's allergens, diets or dislikes. Time is left out here: it depends on
 * the evening, and the planners weigh it per slot.
 */
export function plannableRecipes<T extends WeekPlanRecipe>(
  recipes: readonly T[],
  prefs: Pick<ResolvedMealPreferences, 'allergens' | 'diets' | 'dislikes'>,
): T[] {
  const noTime = [null, null, null, null, null, null, null]
  return recipes.filter((recipe) =>
    recipeClashes(recipe, { ...prefs, cookingMinutes: noTime }, 0).every(
      (clash) => clash.uncertain === true,
    ),
  )
}

/**
 * The Group's own quick meals a plan may draw from: like `plannableRecipes`,
 * those whose name has no certain clash. A quick meal has no ingredients, so
 * only its name is read.
 */
export function plannableQuickMeals<T extends WeekPlanQuickMeal>(
  quickMeals: readonly T[],
  prefs: Pick<ResolvedMealPreferences, 'allergens' | 'diets' | 'dislikes'>,
): T[] {
  return quickMeals.filter((meal) =>
    nameClashes(meal.title, prefs).every((clash) => clash.uncertain === true),
  )
}

/**
 * Whether the model may propose a quick meal it made up. Stricter than for a
 * recipe or the Group's own quick meal: a name says too little to clear an
 * allergy, so any allergy the matcher can't rule out ("controleer zelf")
 * drops it, as does any certain diet or dislike clash. The rules then fill the
 * slot. With any allergy set, that is every made-up name.
 */
export function inventedQuickMealFits(
  name: string,
  prefs: Pick<ResolvedMealPreferences, 'allergens' | 'diets' | 'dislikes'>,
): boolean {
  return nameClashes(name, prefs).every(
    (clash) => clash.uncertain === true && clash.kind !== 'allergen',
  )
}

function nameClashes(
  name: string,
  prefs: Pick<ResolvedMealPreferences, 'allergens' | 'diets' | 'dislikes'>,
) {
  return recipeClashes(
    { title: name, ingredients: [], tags: [] },
    { ...prefs, cookingMinutes: NO_TIME },
    0,
  )
}

/** A quick meal's name as compared: lower case, accents and punctuation gone. */
export function quickMealKey(name: string): string {
  return normalizeText(name).replace(/\s+/g, ' ').trim()
}

/** The longest a target's meal may take: its weekday, or less when busy. */
export function targetLimit(target: WeekPlanTarget): number | null {
  if (target.busyAt === undefined) return target.maxMinutes
  return Math.min(target.maxMinutes ?? BUSY_EVENING_MINUTES, BUSY_EVENING_MINUTES)
}

export function fitsTime(minutes: number | undefined, limit: number | null): boolean {
  return limit === null || minutes === undefined || minutes <= limit
}

/** The stock names a recipe's ingredient lines mention, in stock order. */
export function stockUsed(
  recipe: Pick<WeekPlanRecipe, 'ingredients'>,
  names: readonly string[],
): string[] {
  const lines = recipe.ingredients.map(normalizeText).join(' ')
  return names.filter((name) => {
    const needle = normalizeText(name).trim()
    return needle.length >= 3 && lines.includes(needle)
  })
}

const NO_TIME = [null, null, null, null, null, null, null]

/**
 * The tags that say which meal a recipe is for, English and Dutch. A recipe
 * with any of them is planned only in those slots; one tagged as a dessert,
 * bake or snack and for no meal is never planned; any other recipe fits every
 * slot. Without this the rules would put Overnight oats on a dinner.
 */
const SLOT_TAGS: Record<MealSlot, readonly string[]> = {
  breakfast: ['breakfast', 'ontbijt', 'brunch'],
  lunch: ['lunch', 'brunch'],
  dinner: ['dinner', 'diner', 'avondeten', 'avondmaal', 'hoofdgerecht', 'main', 'weeknight'],
}
const NOT_A_MEAL_TAGS = [
  'dessert',
  'nagerecht',
  'toetje',
  'baking',
  'bakken',
  'gebak',
  'snack',
  'tussendoortje',
  'drink',
  'drankje',
]

/** Whether a recipe's tags allow it in this slot (see `SLOT_TAGS`). */
export function fitsSlot(recipe: Pick<WeekPlanRecipe, 'tags'>, slot: MealSlot): boolean {
  const tags = new Set(recipe.tags.map((tag) => tag.trim().toLocaleLowerCase()))
  const meals = MEAL_SLOTS.filter((meal) => SLOT_TAGS[meal].some((tag) => tags.has(tag)))
  if (meals.length > 0) return meals.includes(slot)
  return !NOT_A_MEAL_TAGS.some((tag) => tags.has(tag))
}


function isFish(recipe: WeekPlanRecipe): boolean {
  return recipeClashes(
    recipe,
    { allergens: ['fish'], diets: [], dislikes: [], cookingMinutes: NO_TIME },
    0,
  ).some((clash) => !clash.uncertain)
}

export function isMeatFree(recipe: WeekPlanRecipe): boolean {
  if (recipe.ingredients.length === 0 && recipe.tags.length === 0) return false
  return recipeClashes(
    recipe,
    { allergens: [], diets: ['vegetarian'], dislikes: [], cookingMinutes: NO_TIME },
    0,
  ).every((clash) => clash.uncertain === true && clash.label !== 'vegetarian')
}

/** Whether a recipe was cooked within the variety window before `date`. */
function cookedRecently(
  recipe: WeekPlanRecipe,
  date: string,
  noRepeatDays: number,
): boolean {
  if (!recipe.lastCooked || noRepeatDays <= 0) return false
  return daysBetween(recipe.lastCooked, date) < noRepeatDays
}

/**
 * The rules planner's score for one recipe on one evening: higher is better.
 * Every term is from the Group's own data, so the same week always gives the
 * same plan.
 */
export function score(
  recipe: WeekPlanRecipe,
  target: WeekPlanTarget,
  input: WeekPlanInput,
): number {
  const { smart } = input.prefs
  let total = 0
  if (smart.preferHighRated) total += (recipe.rating ?? 2.5) * 2
  const since = recipe.lastCooked
    ? daysBetween(recipe.lastCooked, target.date)
    : 42
  total += Math.min(since, 60) / 14
  if (smart.useStock) {
    total += stockUsed(recipe, input.stock.inStock).length * 1.5
    total += stockUsed(recipe, input.stock.low).length * 2
  }
  if (input.wishes.includes('useLow'))
    total += stockUsed(recipe, input.stock.low).length * 3
  if (input.wishes.includes('somethingNew') && !recipe.lastCooked) total += 3
  if (input.wishes.includes('moreVeg') && isMeatFree(recipe)) total += 2
  const weekday = weekdayIndex(target.date)
  if (input.prefs.fishDays.some((day) => day === weekday) && isFish(recipe))
    total += 6
  // The tighter the evening, the more a quick recipe is worth.
  const limit = targetLimit(target)
  if (limit !== null && recipe.prepMinutes !== undefined)
    total += (limit - recipe.prepMinutes) / 30
  return total
}

/** The evening before was a cook-double day with a dinner: eat the rest. */
function isLeftoverEvening(
  target: WeekPlanTarget,
  input: WeekPlanInput,
  dinners: ReadonlySet<string>,
): boolean {
  if (target.slot !== 'dinner') return false
  const weekday = weekdayIndex(target.date)
  const before = (weekday + 6) % 7
  if (!input.prefs.leftoverDays.some((day) => day === before)) return false
  const [y, m, d] = target.date.split('-').map(Number)
  const previous = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
  return dinners.has(previous)
}

/**
 * The deterministic plan: per target, the best scoring plannable recipe that
 * fits the evening's time, is not already in the week and was not cooked
 * within the variety window; else a quick meal that fits; else nothing. A
 * dinner after a cook-double day is the leftover quick meal.
 */
export function rulesPlan(input: WeekPlanInput): WeekPlanPick[] {
  const used = new Set(input.plannedRecipeIds)
  const usedQuick = new Set<string>()
  const skipQuick = new Set(input.skipQuickMeals.map(quickMealKey))
  const dinners = new Set(input.plannedDinnerDates)
  const picks: WeekPlanPick[] = []
  let meatFreeLeft = input.prefs.meatFreeNights
  const dinnersLeft = () =>
    input.targets.filter(
      (t) => t.slot === 'dinner' && !picks.some((p) => p.date === t.date && p.slot === 'dinner'),
    ).length

  for (const target of sorted(input.targets)) {
    if (isLeftoverEvening(target, input, dinners)) {
      picks.push({ date: target.date, slot: target.slot, quickMeal: input.leftoversName })
      continue
    }
    const limit = targetLimit(target)
    let pool = input.recipes.filter(
      (recipe) =>
        !used.has(recipe.id) &&
        fitsSlot(recipe, target.slot) &&
        fitsTime(recipe.prepMinutes, limit) &&
        !cookedRecently(recipe, target.date, input.prefs.noRepeatDays),
    )
    // Keep enough evenings for the meat-free nights the Group asked for.
    if (target.slot === 'dinner' && meatFreeLeft > 0 && meatFreeLeft >= dinnersLeft()) {
      const meatFree = pool.filter(isMeatFree)
      if (meatFree.length > 0) pool = meatFree
    }
    const best = pool
      .map((recipe) => ({ recipe, value: score(recipe, target, input) }))
      .sort((a, b) => b.value - a.value || a.recipe.title.localeCompare(b.recipe.title))[0]
    if (best) {
      used.add(best.recipe.id)
      if (target.slot === 'dinner') {
        dinners.add(target.date)
        if (isMeatFree(best.recipe)) meatFreeLeft--
      }
      picks.push({
        date: target.date,
        slot: target.slot,
        recipeId: best.recipe.id,
        prepMinutes: best.recipe.prepMinutes,
      })
      continue
    }
    const quick = input.quickMeals
      .filter(
        (meal) =>
          !usedQuick.has(meal.id) &&
          !skipQuick.has(quickMealKey(meal.title)) &&
          fitsTime(meal.prepMinutes, limit),
      )
      .sort((a, b) => (a.prepMinutes ?? 99) - (b.prepMinutes ?? 99) || a.title.localeCompare(b.title))[0]
    if (quick) {
      usedQuick.add(quick.id)
      if (target.slot === 'dinner') dinners.add(target.date)
      picks.push({
        date: target.date,
        slot: target.slot,
        quickMeal: quick.title,
        quickMealId: quick.id,
        prepMinutes: quick.prepMinutes,
      })
    }
  }
  return picks
}

const SLOT_ORDER: Record<MealSlot, number> = { breakfast: 0, lunch: 1, dinner: 2 }

function sorted(targets: readonly WeekPlanTarget[]): WeekPlanTarget[] {
  return [...targets].sort(
    (a, b) => a.date.localeCompare(b.date) || SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot],
  )
}

export function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.replace(/\s+/g, ' ').trim()
  if (!text) return undefined
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/**
 * The model's answer, kept to what it may say. A pick survives only when its
 * slot was asked for and not picked before, and it names either a recipe id
 * from `recipes` (the list it was given) that is not already in the week and
 * fits the evening's time, or a quick meal by name. A quick meal by name is
 * dropped when it is in `skipQuickMeals` or named twice, and, unless it is
 * one of the Group's own, when `inventedQuickMealFits` says no. Anything
 * else, an invented id above all, is dropped; `rulesPlan` fills what is left.
 */
export function acceptAiPicks(
  raw: unknown,
  input: Pick<
    WeekPlanInput,
    'targets' | 'recipes' | 'quickMeals' | 'plannedRecipeIds' | 'prefs' | 'skipQuickMeals'
  >,
): WeekPlanPick[] {
  if (!Array.isArray(raw)) return []
  const targets = new Map(input.targets.map((t) => [`${t.date}|${t.slot}`, t]))
  const recipes = new Map(input.recipes.map((r) => [r.id, r]))
  const quickByName = new Map(input.quickMeals.map((q) => [quickMealKey(q.title), q]))
  // Names already in the week or turned down, then each name once.
  const namedQuick = new Set(input.skipQuickMeals.map(quickMealKey))
  const used = new Set(input.plannedRecipeIds)
  const taken = new Set<string>()
  const picks: WeekPlanPick[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue
    const item = entry as Record<string, unknown>
    if (typeof item.date !== 'string' || typeof item.slot !== 'string') continue
    const key = `${item.date}|${item.slot}`
    const target = targets.get(key)
    if (!target || taken.has(key)) continue
    const reason = cleanText(item.reason, REASON_MAX)
    const recipeId = typeof item.recipeId === 'string' ? item.recipeId.trim() : ''
    if (recipeId) {
      const recipe = recipes.get(recipeId)
      if (!recipe || used.has(recipe.id) || !fitsSlot(recipe, target.slot)) continue
      if (!fitsTime(recipe.prepMinutes, targetLimit(target))) continue
      used.add(recipe.id)
      taken.add(key)
      picks.push({
        date: target.date,
        slot: target.slot,
        recipeId: recipe.id,
        prepMinutes: recipe.prepMinutes,
        reason,
      })
      continue
    }
    const name = cleanText(item.quickMeal, QUICK_MEAL_NAME_MAX)
    if (!name) continue
    const nameKey = quickMealKey(name)
    if (!nameKey || namedQuick.has(nameKey)) continue
    const known = quickByName.get(nameKey)
    if (!known && !inventedQuickMealFits(name, input.prefs)) continue
    namedQuick.add(nameKey)
    const minutes =
      known?.prepMinutes ??
      (typeof item.minutes === 'number' &&
      Number.isInteger(item.minutes) &&
      item.minutes > 0 &&
      item.minutes <= 240
        ? item.minutes
        : undefined)
    taken.add(key)
    picks.push({
      date: target.date,
      slot: target.slot,
      quickMeal: known?.title ?? name,
      quickMealId: known?.id,
      prepMinutes: minutes,
      reason,
    })
  }
  return picks
}

/**
 * The plan for a week: the model's valid picks, then the rules planner for
 * every slot they left open. `source` says which planner chose each pick.
 */
export function completePlan(
  aiPicks: readonly WeekPlanPick[],
  input: WeekPlanInput,
): (WeekPlanPick & { source: 'ai' | 'rules' })[] {
  const filled = new Set(aiPicks.map((p) => `${p.date}|${p.slot}`))
  const rest = rulesPlan({
    ...input,
    targets: input.targets.filter((t) => !filled.has(`${t.date}|${t.slot}`)),
    quickMeals: input.quickMeals.filter(
      (meal) => !aiPicks.some((pick) => pick.quickMealId === meal.id),
    ),
    plannedRecipeIds: [
      ...input.plannedRecipeIds,
      ...aiPicks.flatMap((p) => (p.recipeId ? [p.recipeId] : [])),
    ],
    plannedDinnerDates: [
      ...input.plannedDinnerDates,
      ...aiPicks.filter((p) => p.slot === 'dinner').map((p) => p.date),
    ],
  })
  return [
    ...aiPicks.map((pick) => ({ ...pick, source: 'ai' as const })),
    ...rest.map((pick) => ({ ...pick, source: 'rules' as const })),
  ].sort(
    (a, b) => a.date.localeCompare(b.date) || SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot],
  )
}
