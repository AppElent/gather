import { createFileRoute } from '@tanstack/react-router'
import { useRequiredCurrentGroup } from '#/components/app/useCurrentGroup'
import {
  NewRecipePage,
  validateNewRecipeSearch,
} from '../../../components/recipes/NewRecipePage'
import { groupRecipeNav } from '../../../components/recipes/recipeNav'

export const Route = createFileRoute('/_app/recipes/new')({
  component: GroupNewRecipe,
  validateSearch: validateNewRecipeSearch,
})

function GroupNewRecipe() {
  const { url } = Route.useSearch()
  // The Group in the address bar is the destination, and it is already resolved
  // — the gate above this route has its name and has checked the membership.
  const group = useRequiredCurrentGroup()

  return (
    <NewRecipePage
      initialUrl={url}
      destination={{
        groupSlug: group.slug,
        groupName: group.name,
        fallback: false,
      }}
      nav={groupRecipeNav(group.slug)}
    />
  )
}
