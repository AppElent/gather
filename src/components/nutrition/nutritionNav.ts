import type { MealName } from '../../../convex/lib/consumption'
import type { AppLink } from '../../lib/appLink'
import { groupLink } from '../../lib/groupPaths'
import { groupFoodNav } from '../foods/foodNav'
import { groupRecipeNav } from '../recipes/recipeNav'

/**
 * The links the Nutrition pages point *out* of themselves with.
 *
 * A diary entry keeps provenance back to the recipe or food it came from
 * (CONTEXT.md), and those are the only destinations Nutrition reaches. The
 * diary itself is Personal and identical in every Group; where its provenance
 * links land is not — they have to stay in the Group the reader opened — which
 * is why they arrive as props rather than being written inline in the page.
 */
export interface NutritionNav {
  recipe: (recipeId: string) => AppLink
  food: (foodId: string) => AppLink
  /** Adding a scanned barcode the Catalog does not have yet. */
  createFood: (barcode?: string) => AppLink
  /**
   * The add sheet, which is an address of its own carrying the day and the
   * meal. It is inside Nutrition rather than out of it, but it arrives the same
   * way as the rest for the same reason: the page has no slug to build one
   * with.
   */
  addEntry: (date: string, meal: MealName) => AppLink
}

export function groupNutritionNav(groupSlug: string): NutritionNav {
  const recipes = groupRecipeNav(groupSlug)
  const foods = groupFoodNav(groupSlug)
  return {
    recipe: recipes.detail,
    food: foods.detail,
    createFood: foods.create,
    addEntry: (date, meal) => ({
      ...groupLink('addFood', groupSlug),
      search: { date, meal },
    }),
  }
}
