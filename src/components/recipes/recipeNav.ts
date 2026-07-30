import type { AppLink } from '../../lib/appLink'
import { groupLink } from '../../lib/groupPaths'

/**
 * Everywhere the Recipes pages can send you.
 *
 * There are two of these and they are the only difference between the flat
 * `/recipes/…` routes and the Group-scoped `/g/<slug>/recipes/…` ones: the
 * pages themselves are shared, so a link that forgets the Group can only be
 * written here, once, where a test can see it.
 */
export interface RecipeNav {
  list: AppLink
  create: AppLink
  detail: (recipeId: string) => AppLink
  edit: (recipeId: string) => AppLink
}

/** Recipes outside any Group — the pre-ADR-0002 URLs, kept working. */
export const flatRecipeNav: RecipeNav = {
  list: { to: '/recipes' },
  create: { to: '/recipes/new' },
  detail: (recipeId) => ({ to: '/recipes/$recipeId', params: { recipeId } }),
  edit: (recipeId) => ({
    to: '/recipes/$recipeId/edit',
    params: { recipeId },
  }),
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
