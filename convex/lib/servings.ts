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
 * **Compatibility shim.** A food written before `servings` existed carries at
 * most one serving, in `servingSize` + `servingLabel`. Rather than backfill
 * every row, this reads either shape and produces the new one, so the reader
 * side of the expand–contract is a single function instead of a condition at
 * every call site.
 *
 * **End condition:** this shim, and the two fields it reads, go together in
 * #71 — once docs/migrations/0006-food-servings.md records the servings list
 * as written everywhere it needs to be. Nothing else here is one-shot code.
 */
export function authoredServings(food: {
  baseUnit: 'g' | 'ml'
  servings?: Serving[]
  servingSize?: number
  servingLabel?: string
}): Serving[] {
  if (food.servings?.length) return food.servings
  if (food.servingSize === undefined || !(food.servingSize > 0)) return []
  return [
    {
      label: food.servingLabel?.trim() || `${food.servingSize} ${food.baseUnit}`,
      amount: food.servingSize,
    },
  ]
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
  food: {
    baseUnit: 'g' | 'ml'
    servings?: Serving[]
    servingSize?: number
    servingLabel?: string
  },
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
