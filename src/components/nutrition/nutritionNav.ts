import type { MealName } from '../../../convex/lib/consumption'
import type { AppLink } from '../../lib/appLink'
import { groupLink } from '../../lib/groupPaths'
import { groupFoodNav, type NewFoodIntent } from '../foods/foodNav'
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
  /**
   * Adding a food the Catalog does not have yet — a scanned barcode, an Open
   * Food Facts result being reviewed before it is saved (#93), or the words a
   * search matched nothing for (#79). `returnTo` is what brings the person
   * back to the meal they were adding to once it is saved.
   */
  createFood: (intent?: NewFoodIntent) => AppLink
  /**
   * The add sheet, which is an address of its own carrying the day and the
   * meal. It is inside Nutrition rather than out of it, but it arrives the same
   * way as the rest for the same reason: the page has no slug to build one
   * with.
   *
   * `foodId` is the food a just-finished form handed back: the sheet opens with
   * that card expanded and ready to log, which is what makes reviewing an
   * import feel like a step in logging rather than a detour through the
   * Catalog.
   */
  addEntry: (date: string, meal: MealName, foodId?: string) => AppLink
}

export function groupNutritionNav(groupSlug: string): NutritionNav {
  const recipes = groupRecipeNav(groupSlug)
  const foods = groupFoodNav(groupSlug)
  return {
    recipe: recipes.detail,
    food: foods.detail,
    createFood: foods.create,
    addEntry: (date, meal, foodId) => ({
      ...groupLink('addFood', groupSlug),
      // The food only when there is one: a key carrying `undefined` is a query
      // parameter in some serialisers and nothing in others, and the sheet's
      // address should not depend on which.
      search: { date, meal, ...(foodId ? { food: foodId } : {}) },
    }),
  }
}
