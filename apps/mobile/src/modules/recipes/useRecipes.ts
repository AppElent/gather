/**
 * The Group's collection, and the Group it belongs to.
 *
 * The Group is ambient on the phone (ADR-0015) but every Convex function in
 * this Module still takes a `groupSlug`, because a write happens at the address
 * that names its Group (ADR-0007) — the phone reads that address from the
 * provider instead of from a URL, and nothing else changes.
 *
 * `recipes.list` is live, so a recipe somebody else in the household adds
 * appears here without anyone reaching for a refresh, and the search field
 * filters what has already arrived rather than asking again.
 */
import { useQuery } from 'convex/react'

import { api } from '../../../../../convex/_generated/api'
import { useGroup } from '../../group/GroupProvider'

export function useRecipes() {
  const { group } = useGroup()
  const recipes = useQuery(api.recipes.list, { groupSlug: group.slug })

  return {
    groupSlug: group.slug,
    groupName: group.name,
    /** `undefined` while loading, `[]` when this Group has no recipe yet. */
    recipes,
    loading: recipes === undefined,
  }
}

/** One row of the collection, as the screens read it. */
export type ListedRecipe = NonNullable<
  ReturnType<typeof useRecipes>['recipes']
>[number]
