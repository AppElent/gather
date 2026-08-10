/**
 * Calories as they are shown: a whole number.
 *
 * The stored figure keeps its two decimals — it is arithmetic, and rounding it
 * would compound across a day's worth of entries. This is only the display
 * rule, and only for calories: a fraction of a kcal is noise nobody acts on,
 * while 12.5 g of protein is a real amount and keeps its decimal.
 *
 * Applied everywhere kcal is rendered — the meal subtotal, the per-entry
 * figure and the day's total — because one of the three showing decimals while
 * the others do not reads as a bug rather than as precision.
 */
export function roundKcal(calories: number): number {
  return Math.round(calories)
}
