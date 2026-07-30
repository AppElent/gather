import type { AppLink } from '../../lib/appLink'
import { flatRecipeNav, groupRecipeNav } from '../recipes/recipeNav'

/**
 * The links the Nutrition pages point *out* of themselves with.
 *
 * A diary entry keeps provenance back to the recipe or food it came from
 * (CONTEXT.md), and those are the only destinations Nutrition reaches. The
 * diary itself is Personal and identical in every Group; where its provenance
 * links land is not, which is exactly why they arrive as props rather than
 * being written inline in a component both trees render.
 */
export interface NutritionNav {
  recipe: (recipeId: string) => AppLink
}

export const flatNutritionNav: NutritionNav = {
  recipe: flatRecipeNav.detail,
}

export function groupNutritionNav(groupSlug: string): NutritionNav {
  return { recipe: groupRecipeNav(groupSlug).detail }
}
