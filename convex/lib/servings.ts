import { v } from 'convex/values'
import { scaleFacts } from './consumption'
import type { NutritionFacts } from './nutrition'

/**
 * A named amount of a food: what somebody calls a portion of it, and how much
 * of the food's base unit that actually is.
 *
 * The label is **content** — it is what the thing is called, authored in a
 * Catalog fixture or supplied by Open Food Facts — so it is never translated
 * (ADR-0011). "slice" stays "slice" in Dutch for the same reason a recipe
 * called "Shepherd's pie" does.
 */
export interface Serving {
  label: string
  amount: number
}

export const servingValidator = v.object({
  label: v.string(),
  amount: v.number(),
})

/** How many of a person's own past amounts are worth offering back to them. */
const MAX_LOGGED_SERVINGS = 3

/**
 * The servings a food itself declares.
 *
 * A food written before the list existed carried at most one serving, in
 * `servingSize` + `servingLabel`, and this read either shape while both
 * existed. The old pair is gone (#71, docs/migrations/0006-food-servings.md),
 * so there is one shape left and this is now just the accessor — kept because
 * every caller wants "the list, or nothing" and `?? []` at each of them is how
 * that quietly becomes two answers.
 */
export function authoredServings(food: { servings?: Serving[] }): Serving[] {
  return food.servings ?? []
}

/**
 * A person's own amounts for one food, most-used first.
 *
 * This is what covers a Catalog food, which nobody may edit (ADR-0004), and a
 * food whose authored list is empty: your own habits become the shortcut
 * without anybody having to author anything. Ties break towards the larger
 * amount only so that the order is stable rather than dependent on which entry
 * a query happened to return first.
 */
export function rankLoggedAmounts(
  entries: readonly { quantity: number; quantityUnit: string }[],
  baseUnit: 'g' | 'ml',
  limit: number = MAX_LOGGED_SERVINGS,
): Serving[] {
  const counts = new Map<number, number>()
  for (const entry of entries) {
    // Only amounts already in the food's base unit mean anything here. A
    // 'serving' or 'piece' entry counts something else — how many portions —
    // and reoffering its number as a weight would be a different amount
    // wearing the same digits.
    if (entry.quantityUnit !== baseUnit) continue
    if (!(entry.quantity > 0)) continue
    const amount = Math.round(entry.quantity * 100) / 100
    counts.set(amount, (counts.get(amount) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])
    .slice(0, limit)
    .map(([amount]) => ({ label: `${amount} ${baseUnit}`, amount }))
}

/** How many things each section of the empty add sheet offers (#76). */
export const MAX_MEAL_SUGGESTIONS = 8

/**
 * How far back the empty add sheet looks for a habit.
 *
 * Bounded on purpose: a year of entries is not needed to know what somebody
 * has for breakfast, and the alternative is collecting a diary of unbounded
 * length on every open of the sheet. Two months is long enough that a habit
 * kept a few times a week is obvious and short enough that one abandoned in
 * spring is not still the first thing offered in autumn.
 */
export const SUGGESTION_WINDOW_DAYS = 60

/**
 * The earliest day the empty sheet counts, given the day being logged.
 *
 * Days rather than timestamps because that is what a diary entry stores — an
 * ISO `YYYY-MM-DD` string, which compares and sorts as a date without being
 * parsed. A date this cannot parse yields itself, so a broken argument narrows
 * the window to a single day rather than quietly widening it to everything.
 */
export function suggestionWindowStart(
  date: string,
  days: number = SUGGESTION_WINDOW_DAYS,
): string {
  const start = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(start.getTime())) return date
  start.setUTCDate(start.getUTCDate() - days)
  return start.toISOString().slice(0, 10)
}

/** As much of a diary entry as ranking a meal's habits depends on. */
export interface MealChoiceEntry<F extends string, R extends string> {
  meal: string
  date: string
  foodId?: F
  recipeId?: R
}

/**
 * What somebody usually has at this meal, most-chosen first (#76, #73).
 *
 * The empty add sheet's whole point is that the common case needs no typing,
 * and "the thing I eat every breakfast" is a far better guess than "the thing
 * I logged last night" — so this ranks a person's distinct foods and recipes
 * by *how often* they logged each one in this meal slot, and breaks ties on
 * recency so that a new habit overtakes an old one of equal count. The final
 * tie-break on the id itself is not meaningful; it is there so the order does
 * not depend on which entry a query happened to return first.
 *
 * Foods and recipes are counted separately because they are offered as two
 * sections and logged in different units — they are never ranked against each
 * other. A one-off entry references neither and counts towards nothing: there
 * is nothing to offer back.
 *
 * Pure, and given the window rather than computing it, so the same bound the
 * caller's index range applies is applied again here — the two cannot drift,
 * and a test can state the window without a database.
 */
export function rankMealChoices<F extends string, R extends string>(
  entries: readonly MealChoiceEntry<F, R>[],
  options: { meal: string; since?: string; limit?: number },
): { foodIds: F[]; recipeIds: R[] } {
  const limit = options.limit ?? MAX_MEAL_SUGGESTIONS
  const foods = new Map<F, Tally>()
  const recipes = new Map<R, Tally>()
  for (const entry of entries) {
    if (entry.meal !== options.meal) continue
    if (options.since !== undefined && entry.date < options.since) continue
    if (entry.foodId !== undefined) tally(foods, entry.foodId, entry.date)
    if (entry.recipeId !== undefined) tally(recipes, entry.recipeId, entry.date)
  }
  return {
    foodIds: mostChosen(foods, limit),
    recipeIds: mostChosen(recipes, limit),
  }
}

interface Tally {
  count: number
  last: string
}

function tally<K extends string>(counts: Map<K, Tally>, key: K, date: string) {
  const seen = counts.get(key)
  if (!seen) {
    counts.set(key, { count: 1, last: date })
    return
  }
  seen.count += 1
  if (date > seen.last) seen.last = date
}

function mostChosen<K extends string>(counts: Map<K, Tally>, limit: number): K[] {
  return [...counts.entries()]
    .sort(
      ([aKey, a], [bKey, b]) =>
        b.count - a.count ||
        compare(b.last, a.last) ||
        compare(aKey as string, bKey as string),
    )
    .slice(0, limit)
    .map(([key]) => key)
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** A serving on offer, and whether it came from the food or from your own logging. */
export interface OfferedServing extends Serving {
  own: boolean
}

/**
 * What an expanded food card offers: what the food declares, then what you
 * have actually logged, with the amounts that are already on offer left out
 * rather than repeated under a second heading.
 */
export function offeredServings(
  food: { servings?: Serving[] },
  loggedAmounts: readonly Serving[] = [],
): OfferedServing[] {
  const authored = authoredServings(food).map((serving) => ({
    ...serving,
    own: false,
  }))
  const taken = new Set(authored.map((serving) => serving.amount))
  const own = loggedAmounts
    .filter((serving) => !taken.has(serving.amount))
    .map((serving) => ({ ...serving, own: true }))
  return [...authored, ...own]
}

/**
 * A custom amount as somebody typed it: Dutch decimal commas accepted, and
 * anything that is not a positive number refused rather than coerced. The
 * caller keeps its confirm disabled on `undefined`, which is why this says
 * nothing about *why* — there is exactly one reason.
 */
export function parseServingAmount(input: string): number | undefined {
  const trimmed = input.trim().replace(',', '.')
  if (!trimmed) return undefined
  const value = Number(trimmed)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

/** What the card has selected, in the two shapes it can be in. */
export type AmountChoice =
  | { kind: 'serving'; serving: Serving }
  | { kind: 'custom'; value: number; unit: 'base' }
  | { kind: 'custom'; value: number; unit: 'serving'; serving: Serving }

export interface ResolvedAmount {
  /** In the food's base unit — what the diary entry stores as its quantity. */
  amount: number
  /** What to call it afterwards: the serving's own name, or the amount itself. */
  label: string
  nutrition: NutritionFacts
}

/**
 * Turn a chosen chip or a typed amount into the amount, the label and the
 * nutrients that go with it.
 *
 * One function, imported directly by the client as well as read on the server,
 * because the alternative is the same arithmetic in two places disagreeing
 * about rounding. Returns `undefined` for anything that does not resolve to a
 * positive amount — there is nothing to log and nothing to show.
 *
 * The label it builds is not a translated sentence: a serving's own name is
 * content, and the fallback is a number next to a unit symbol, which reads the
 * same in both locales (ADR-0011).
 */
export function resolveAmount(
  food: { baseUnit: 'g' | 'ml'; nutritionPer100: NutritionFacts },
  choice: AmountChoice,
): ResolvedAmount | undefined {
  const { amount, label } = describe(food, choice)
  if (!Number.isFinite(amount) || amount <= 0) return undefined
  const rounded = Math.round(amount * 100) / 100
  return {
    amount: rounded,
    label,
    nutrition: scaleFacts(food.nutritionPer100, rounded / 100),
  }
}

function describe(
  food: { baseUnit: 'g' | 'ml' },
  choice: AmountChoice,
): { amount: number; label: string } {
  if (choice.kind === 'serving') {
    return { amount: choice.serving.amount, label: choice.serving.label }
  }
  if (choice.unit === 'base') {
    return {
      amount: choice.value,
      label: `${choice.value} ${food.baseUnit}`,
    }
  }
  return {
    amount: choice.value * choice.serving.amount,
    label: `${choice.value} × ${choice.serving.label}`,
  }
}
