/**
 * A grocery item's amount (APP-309): what a typed line becomes when it is
 * added, how the list writes the amount back, and how the Item screen steps
 * it. Recognition itself is `parse.ts`; this is what the apps and Convex do
 * with its answer.
 */

import { type GroceryUnit, parseGroceryLine } from './parse'

/** The largest amount an item may carry: no household buys more of anything. */
export const GROCERY_QUANTITY_MAX = 10_000

/** Amounts are kept to three decimals: "⅓" is 0.333, not a repeating float. */
export function roundGroceryQuantity(quantity: number): number {
  return Math.round(quantity * 1000) / 1000
}

/** Whether a number may be stored as an item's amount. */
export function isGroceryQuantity(quantity: number): boolean {
  return (
    Number.isFinite(quantity) &&
    quantity > 0 &&
    quantity <= GROCERY_QUANTITY_MAX
  )
}

/** The fields a typed line adds to a grocery list with. */
export interface GroceryAddFields {
  title: string
  quantity?: number
  unit?: GroceryUnit
}

/**
 * "2 pakken melk" is added as "melk" with 2 pak; a line without an amount is
 * added as typed. A line that is only an amount keeps its text as the title,
 * so nothing typed is lost.
 */
export function groceryAddFields(line: string): GroceryAddFields {
  const title = line.trim()
  const parsed = parseGroceryLine(title)
  if (parsed.quantity === null && parsed.unit === null) return { title }
  if (!parsed.name) return { title }
  // An amount no household buys keeps the whole line, rather than a unit
  // without its number.
  if (parsed.quantity !== null && !isGroceryQuantity(parsed.quantity))
    return { title }
  return {
    title: parsed.name,
    ...(parsed.quantity !== null
      ? { quantity: roundGroceryQuantity(parsed.quantity) }
      : {}),
    ...(parsed.unit !== null ? { unit: parsed.unit } : {}),
  }
}

/**
 * The item as one line again, in the parser's own words ("2 pak melk",
 * "500 g gehakt"): what its title becomes when it leaves a grocery list for a
 * list that has no amounts, so the amount stays readable and comes back when
 * it is parsed again.
 */
export function groceryLineText(
  title: string,
  quantity: number | undefined,
  unit: GroceryUnit | undefined,
): string {
  if (quantity === undefined && unit === undefined) return title
  const amount = String(quantity ?? 1)
  if (unit === undefined) return `${amount} ${title}`
  return `${amount} ${unit} ${title}`
}

/** A unit's words in one language: singular, and the plural for any other amount. */
export type GroceryUnitWords = Record<GroceryUnit, { one: string; other: string }>

/**
 * The amount as the list shows it, trailing the name: "2 pak", "500 g",
 * "1,5 l", "3". Null when there is nothing to show — no amount, or just one
 * of something without a unit.
 */
export function formatGroceryAmount(
  quantity: number | undefined,
  unit: GroceryUnit | undefined,
  locale: string,
  words: GroceryUnitWords,
): string | null {
  if (quantity === undefined && unit === undefined) return null
  const value = quantity ?? 1
  const counted = unit === undefined || unit === 'stuks'
  if (counted && value === 1) return null
  const number = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(value)
  if (counted) return number
  const word = value === 1 ? words[unit].one : words[unit].other
  return `${number} ${word}`
}

/** How far one tap of − or + moves an amount in this unit. */
export function groceryQuantityStep(unit: GroceryUnit | undefined): number {
  switch (unit) {
    case 'g':
    case 'ml':
      return 50
    case 'cl':
      return 10
    case 'dl':
    case 'kg':
    case 'l':
      return 0.5
    default:
      return 1
  }
}

/**
 * One step up or down from an amount, landing on the step's grid ("1,5 kg" −
 * goes to 1, "250 g" + to 300). Null when the step would go to nothing:
 * removing the amount is its own action.
 */
export function stepGroceryQuantity(
  quantity: number | undefined,
  unit: GroceryUnit | undefined,
  direction: 1 | -1,
): number | null {
  const step = groceryQuantityStep(unit)
  const current = quantity ?? 1
  const onGrid = Math.abs(current / step - Math.round(current / step)) < 1e-9
  const next =
    direction === 1
      ? onGrid
        ? current + step
        : Math.ceil(current / step) * step
      : onGrid
        ? current - step
        : Math.floor(current / step) * step
  const rounded = roundGroceryQuantity(next)
  if (rounded <= 0) return null
  return Math.min(rounded, GROCERY_QUANTITY_MAX)
}
