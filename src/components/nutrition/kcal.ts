import type { NutritionFacts } from '../../../convex/lib/nutrition'

/**
 * Calories as they are shown: a whole number.
 *
 * Display only, and only for calories: a fraction of a kcal is noise nobody
 * acts on, while 12.5 g of protein is a real amount and keeps its decimal. The
 * stored figure is untouched.
 */
export function roundKcal(calories: number): number {
  return Math.round(calories)
}

/**
 * The calories of a set of entries: each one rounded, then added.
 *
 * Rounding the *sum* is the obvious thing and it is wrong, because it lets
 * what you can see stop adding up — two meals of 97.5 kcal each show 98 and
 * 98 above a day that shows 195. Every figure on the page would be correctly
 * rounded and the page would still look broken, because the only arithmetic a
 * reader can check is the one between the numbers in front of them.
 *
 * So the rounding happens once, at the entry, and every total above it is a
 * sum of figures already shown. A meal is exactly its rows added up, the day
 * is exactly its meals added up, and the cost is at most a kcal of drift from
 * the stored total — which nobody can see.
 *
 * What comes back is then the *only* calorie figure the day view has: what is
 * left against a target and how full the bar is are reckoned from this, not
 * from the stored sum. That is deliberate — a total shown as `2000 / 2000`
 * while claiming `0.4 left` is two answers to one question.
 *
 * Undefined when nothing here carries calories at all, so a meal with none
 * shows nothing rather than a fabricated zero.
 */
export function sumKcal(facts: readonly NutritionFacts[]): number | undefined {
  let total: number | undefined
  for (const fact of facts) {
    if (fact.calories === undefined) continue
    total = (total ?? 0) + roundKcal(fact.calories)
  }
  return total
}
