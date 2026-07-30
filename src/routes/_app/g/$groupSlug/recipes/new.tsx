import { createFileRoute } from '@tanstack/react-router'
import {
  NewRecipePage,
  validateNewRecipeSearch,
} from '../../../../../components/recipes/NewRecipePage'
import { groupRecipeNav } from '../../../../../components/recipes/recipeNav'

export const Route = createFileRoute('/_app/g/$groupSlug/recipes/new')({
  component: GroupNewRecipe,
  validateSearch: validateNewRecipeSearch,
})

function GroupNewRecipe() {
  const { groupSlug } = Route.useParams()
  const { url } = Route.useSearch()

  return <NewRecipePage initialUrl={url} nav={groupRecipeNav(groupSlug)} />
}
