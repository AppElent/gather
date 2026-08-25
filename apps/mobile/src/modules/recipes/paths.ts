/**
 * Where a Recipes screen can send you, given which tab it is mounted under.
 *
 * Modules live inside the tab stacks (ADR-0023), so every screen in this Module
 * exists at two addresses — under Home and under All — and each keeps its own
 * back stack. The screens themselves must not know which: they take a `base`
 * and build from it, which is what lets one component serve both route trees
 * instead of one per tab.
 *
 * The cast is the price of that, and it lives here alone, exactly as it does
 * for the Baby log. Typed routes cannot check a template string, so this
 * function is the single place where a path is assembled by hand — and the
 * `RecipeBase` union is what keeps the two halves of it honest, since a tab
 * that has no `recipes/` subtree cannot be named.
 *
 * A recipe is addressed by a query parameter rather than a path segment, for
 * the reason `baby-log/entry` is: it keeps five files per tab instead of a
 * dynamic segment nested inside a static one, and nothing on the phone ever
 * shows a URL to anybody.
 */
import type { Href } from 'expo-router'

/** The tab stacks this Module is mounted in. */
export type RecipeBase = '/all/recipes'

export type RecipeScreen = '' | '/recipe' | '/import' | '/new' | '/edit'

export function recipeHref(
  base: RecipeBase,
  screen: RecipeScreen,
  params?: Record<string, string>,
): Href {
  const path = `${base}${screen}`
  return (params ? { pathname: path, params } : path) as Href
}

/**
 * Which tab the Add launcher hands a recipe import to.
 *
 * Home, always, and not whichever tab happened to be in front. The launcher is
 * an app-level control that opens over any tab — including Add itself, which
 * has no stack of its own — so "the tab you were in" is not always a place a
 * pushed screen can go back to. Home is the guaranteed-present tab root, so
 * back from the recipe you just made always lands somewhere real.
 */
export const ADD_TAB_BASE: RecipeBase = '/all/recipes'
