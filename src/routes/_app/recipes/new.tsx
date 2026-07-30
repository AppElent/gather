import { createFileRoute } from '@tanstack/react-router'
import {
  NewRecipePage,
  validateNewRecipeSearch,
} from '../../../components/recipes/NewRecipePage'
import { flatRecipeNav } from '../../../components/recipes/recipeNav'

export const Route = createFileRoute('/_app/recipes/new')({
  component: NewRecipe,
  validateSearch: validateNewRecipeSearch,
})

function NewRecipe() {
  const { url } = Route.useSearch()

  return <NewRecipePage initialUrl={url} nav={flatRecipeNav} />
}
