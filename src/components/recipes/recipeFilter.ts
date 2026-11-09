/**
 * Which recipes the web list shows once somebody searches or picks a tag.
 *
 * It filters what `recipes.list` already returned rather than asking the
 * server again: the query holds the Current Group's whole collection, so a
 * second round trip would buy nothing but a spinner.
 *
 * The search reads the title only. The phone's collection screen
 * (`apps/mobile/src/modules/recipes/recipeFilter.ts`) also matches tags in its
 * one search field and sorts by title; the web has a separate tag control and
 * keeps the list in the order it arrives, so the two stay separate.
 */

/** As much of a recipe as filtering needs. */
export interface FilterableRecipe {
  title: string
  tags: string[]
}

export interface RecipeFilter {
  /** Matched case-insensitively against the title; blank means no search. */
  query: string
  /** One tag the recipe must carry exactly; empty means every tag. */
  tag: string
}

/** The tags present in the loaded collection, once each, alphabetically. */
export function recipeTags(recipes: readonly FilterableRecipe[]): string[] {
  const tags = new Set(recipes.flatMap((recipe) => recipe.tags))
  return [...tags].sort((a, b) => a.localeCompare(b))
}

/** The recipes matching both the search and the tag, in their given order. */
export function filterRecipes<T extends FilterableRecipe>(
  recipes: readonly T[],
  { query, tag }: RecipeFilter,
): T[] {
  const needle = query.trim().toLocaleLowerCase()
  return recipes.filter(
    (recipe) =>
      (!needle || recipe.title.toLocaleLowerCase().includes(needle)) &&
      (!tag || recipe.tags.includes(tag)),
  )
}
