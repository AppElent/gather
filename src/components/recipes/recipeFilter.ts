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
  /** One tag the recipe must carry, in any case; empty means every tag. */
  tag: string
}

/**
 * Whether two tags are the same tag. Tags are typed by hand and imported by
 * AI, so "Soup" and "soup" both turn up; they are one tag, not two.
 */
export function sameTag(a: string, b: string): boolean {
  return a.toLocaleLowerCase() === b.toLocaleLowerCase()
}

/**
 * The tags present in the loaded collection, once each, alphabetically. A tag
 * spelled in more than one case is offered in the first spelling met.
 */
export function recipeTags(recipes: readonly FilterableRecipe[]): string[] {
  const tags = new Map<string, string>()
  for (const tag of recipes.flatMap((recipe) => recipe.tags)) {
    const key = tag.toLocaleLowerCase()
    if (!tags.has(key)) tags.set(key, tag)
  }
  return [...tags.values()].sort((a, b) => a.localeCompare(b))
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
      (!tag || recipe.tags.some((own) => sameTag(own, tag))),
  )
}
