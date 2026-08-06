import type { QuantityUnit } from './consumption'
import {
  computeFoodEntryNutrition,
  computeRecipeEntryNutrition,
  scaleFacts,
} from './consumption'
import type { NutritionFacts } from './nutrition'
import type { Serving } from './servings'

/**
 * One component of a Combo, as the client gets it: what was saved, plus
 * whatever the thing it points at currently says.
 *
 * The reference is resolved on read and permitted to dangle (ADR-0003). A
 * Recipe in a Group you have since left, or a food that has been retired from
 * the Catalog, comes back with no `food`/`recipe` and `available: false` — the
 * component still renders, by its saved label, and simply is not logged.
 */
export interface ComboComponent {
  id: string
  label: string
  quantity: number
  quantityUnit: QuantityUnit
  foodId?: string
  recipeId?: string
  /** The food as it is *now*, when it is still reachable. */
  food?: {
    baseUnit: 'g' | 'ml'
    nutritionPer100: NutritionFacts
    servingSize?: number
    servings?: Serving[]
  }
  /** The recipe's per-serving nutrition as it is *now*, when still reachable. */
  recipe?: { nutrition: NutritionFacts }
  /** Figures of its own — only a one-off has these, because only a one-off needs them. */
  nutrition?: NutritionFacts
  available: boolean
}

/** What one confirmed component becomes: a diary entry, minus the day and the meal. */
export interface ComboEntryInput {
  foodId?: string
  recipeId?: string
  label: string
  quantity: number
  quantityUnit: QuantityUnit
  nutrition: NutritionFacts
}

/**
 * How many of a component's own serving is being logged this time.
 *
 * One means "as saved". Zero means removed — the stepper reaching zero *is*
 * the remove control, which is why there is no second one beside it. Anything
 * missing from the map is one.
 */
export type ComboCounts = Record<string, number>

export function countOf(counts: ComboCounts, id: string): number {
  const count = counts[id]
  return count === undefined ? 1 : count
}

/**
 * Turn a Combo, as adjusted for today, into the diary entries to write.
 *
 * Nutrition comes from the *reference* wherever there is one, so a corrected
 * food corrects every future log of every Combo containing it; a one-off has
 * only its own saved figures and is scaled from those. A component that is
 * unreachable or stepped to zero produces nothing, and the rest still log —
 * losing access to one thing does not break the whole shortcut.
 *
 * Pure, and imported directly by the client, so what the expanded card shows
 * and what the mutation writes cannot drift apart.
 */
export function comboEntries(
  components: readonly ComboComponent[],
  counts: ComboCounts = {},
): ComboEntryInput[] {
  const entries: ComboEntryInput[] = []
  for (const component of components) {
    const count = countOf(counts, component.id)
    if (!(count > 0) || !component.available) continue
    const quantity = Math.round(component.quantity * count * 100) / 100
    const nutrition = componentNutrition(component, quantity)
    if (!nutrition) continue
    entries.push({
      foodId: component.foodId,
      recipeId: component.recipeId,
      label: component.label,
      quantity,
      quantityUnit: component.quantityUnit,
      nutrition,
    })
  }
  return entries
}

function componentNutrition(
  component: ComboComponent,
  quantity: number,
): NutritionFacts | undefined {
  if (component.food) {
    const unit = component.quantityUnit
    if (unit === 'serving') return undefined
    return computeFoodEntryNutrition(component.food, quantity, unit)
  }
  if (component.recipe) {
    return computeRecipeEntryNutrition(component.recipe.nutrition, quantity)
  }
  if (component.nutrition) {
    // A one-off's figures are for the amount it was saved at, so scaling is by
    // how many of *those* are being logged rather than by the raw quantity.
    return scaleFacts(component.nutrition, quantity / component.quantity)
  }
  return undefined
}

/** Whether anything about this logging differs from what the Combo has saved. */
export function isModified(
  components: readonly ComboComponent[],
  counts: ComboCounts,
): boolean {
  return components.some((component) => countOf(counts, component.id) !== 1)
}
