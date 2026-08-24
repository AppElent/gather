/**
 * Which recipes a search field is asking for, and in what order.
 *
 * The search is *in* the collection screen rather than in the Search tab, and
 * it filters what the screen already has rather than asking the server again.
 * `recipes.list` is a live query that returns the whole Group's collection, so
 * a second round trip would buy nothing but a spinner — and "nothing found"
 * then means what somebody typed, never that the connection is slow.
 *
 * Two fields are searched and no more: the title, and the tags. Not the
 * ingredients, and deliberately — a phone's collection is scanned by the name
 * of the dish, and matching "salt" against the ingredients of forty recipes
 * returns thirty-eight of them, which is a worse answer than none.
 *
 * The ordering lives here too, so the screen has no arithmetic in it at all.
 * `recipes.list` answers in insertion order with the Group's own recipes ahead
 * of the ones shared into it, which is an artefact of how it is assembled and
 * not something a reader should be asked to learn.
 */

/** As much of a recipe as searching and sorting need. */
export interface FilterableRecipe {
  title: string
  tags: string[]
}

/**
 * The collection as the screen should draw it: matches only, by title.
 *
 * A blank or whitespace-only query is not a filter — it is the absence of one
 * — so it answers with everything rather than with nothing. That distinction
 * is what keeps the *Nothing found* empty state from appearing the instant
 * somebody taps the field and hasn't typed yet.
 */
export function recipeCollection<T extends FilterableRecipe>(
  recipes: readonly T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase()
  const matches = needle
    ? recipes.filter((recipe) => matchesQuery(recipe, needle))
    : [...recipes]
  return matches.sort((a, b) => a.title.localeCompare(b.title))
}

/**
 * Whether one recipe answers a search.
 *
 * `needle` is expected already trimmed and lower-cased — `recipeCollection`
 * does it once for the whole list rather than once per row.
 */
function matchesQuery(recipe: FilterableRecipe, needle: string): boolean {
  if (recipe.title.toLowerCase().includes(needle)) return true
  return recipe.tags.some((tag) => tag.toLowerCase().includes(needle))
}
