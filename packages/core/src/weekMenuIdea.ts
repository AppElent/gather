/**
 * Nieuw idee's ingredient rows, without React (APP-320): each amount scaled
 * to the servings chosen, as it reads in the draft and as the line a saved
 * Recipe keeps.
 */
import {
  formatGroceryAmount,
  GROCERY_UNITS,
  type GroceryUnit,
  groceryLineText,
  scaleGroceryQuantity,
} from './groceries'
import { stockUsed } from './weekPlan'

/** Fewest and most servings an idea scales to. */
export const IDEA_SERVINGS = { min: 1, max: 20 } as const

const UNITS = new Set<string>(GROCERY_UNITS)
const asUnit = (unit: string | undefined) =>
  unit && UNITS.has(unit) ? (unit as GroceryUnit) : undefined

export interface IdeaRow {
  name: string
  /** "400 g", or `null` when the idea gives no amount. */
  amount: string | null
  /** The ingredient line a saved Recipe keeps. */
  line: string
  inStock: boolean
}

export function ideaRows({
  idea,
  servings,
  stockNames,
  locale,
  units,
}: {
  idea: {
    servings: number
    ingredients: readonly { name: string; quantity?: number; unit?: string }[]
  }
  servings: number
  stockNames: string[]
  locale: string
  units: Parameters<typeof formatGroceryAmount>[3]
}): IdeaRow[] {
  return idea.ingredients.map((ingredient) => {
    const unit = asUnit(ingredient.unit)
    const quantity =
      ingredient.quantity === undefined
        ? undefined
        : scaleGroceryQuantity(
            ingredient.quantity,
            unit,
            servings / idea.servings,
          )
    const amount =
      quantity === undefined
        ? null
        : unit || !ingredient.unit
          ? (formatGroceryAmount(quantity, unit, locale, units) ??
            String(quantity))
          : `${quantity} ${ingredient.unit}`
    const line =
      quantity === undefined
        ? ingredient.name
        : unit || !ingredient.unit
          ? groceryLineText(ingredient.name, quantity, unit)
          : `${quantity} ${ingredient.unit} ${ingredient.name}`
    return {
      name: ingredient.name,
      amount,
      line,
      inStock:
        stockUsed({ ingredients: [ingredient.name] }, stockNames).length > 0,
    }
  })
}
