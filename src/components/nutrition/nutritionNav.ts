import type { MealName } from '@gather/core/domain'
import { type AppLink, linkTo } from '../../lib/links'

/**
 * The add sheet, which is an address of its own carrying the day and the meal.
 *
 * `foodId` is the food a just-finished form handed back: the sheet opens with
 * that card expanded and ready to log, which is what makes reviewing an import
 * feel like a step in logging rather than a detour through the Catalog.
 */
export function addFoodLink(
  date: string,
  meal: MealName,
  foodId?: string,
): AppLink {
  return {
    ...linkTo('addFood'),
    // The food only when there is one: a key carrying `undefined` is a query
    // parameter in some serialisers and nothing in others, and the sheet's
    // address should not depend on which.
    search: { date, meal, ...(foodId ? { food: foodId } : {}) },
  }
}
