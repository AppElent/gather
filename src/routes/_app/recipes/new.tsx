import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import {
  NewRecipePage,
  validateNewRecipeSearch,
} from '../../../components/recipes/NewRecipePage'
import { flatRecipeNav } from '../../../components/recipes/recipeNav'

export const Route = createFileRoute('/_app/recipes/new')({
  component: NewRecipe,
  validateSearch: validateNewRecipeSearch,
})

/**
 * Adding a recipe from outside any Group.
 *
 * There is no Group in this URL, so this route has to choose one — and the
 * choice is the caller's Personal group, said out loud on the page rather than
 * made quietly. Landing somewhere private is the answer that cannot surprise a
 * household; if it is the wrong Group, #25 moves it. The page does not render
 * until the destination is known, because a form whose destination is still
 * loading can be submitted before it has one.
 *
 * This route and its guess both go in #24.
 */
function NewRecipe() {
  const { url } = Route.useSearch()
  const groups = useQuery(api.groups.myGroups)
  const personal = groups?.find((g) => g.isPersonal)

  if (!personal) {
    return <p className="py-16 text-center text-sm opacity-60">Loading…</p>
  }

  return (
    <NewRecipePage
      initialUrl={url}
      destination={{
        groupSlug: personal.slug,
        groupName: personal.name,
        fallback: true,
      }}
      nav={flatRecipeNav}
    />
  )
}
