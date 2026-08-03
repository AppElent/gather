import type { AppLink } from '../../lib/appLink'
import { groupLink } from '../../lib/groupPaths'

/**
 * Everywhere the Recipes pages can send you.
 *
 * The pages take every destination as a prop rather than building one, because
 * a page cannot know which Group it is being read in without asking the URL —
 * the thing ADR-0002 exists to stop it doing. So a link that forgets the Group
 * can only be written here, once, where a test can see it.
 */
export interface RecipeNav {
  list: AppLink
  create: AppLink
  detail: (recipeId: string) => AppLink
  edit: (recipeId: string) => AppLink
}

/** Recipes inside a Group. Every destination carries the slug. */
export function groupRecipeNav(groupSlug: string): RecipeNav {
  return {
    list: groupLink('recipes', groupSlug),
    create: groupLink('newRecipe', groupSlug),
    detail: (recipeId) => groupLink('recipe', groupSlug, { recipeId }),
    edit: (recipeId) => groupLink('editRecipe', groupSlug, { recipeId }),
  }
}
