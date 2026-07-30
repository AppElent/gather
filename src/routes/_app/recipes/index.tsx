import { createFileRoute } from '@tanstack/react-router'
import { RecipesPage } from '../../../components/recipes/RecipesPage'
import { flatRecipeNav } from '../../../components/recipes/recipeNav'

export const Route = createFileRoute('/_app/recipes/')({
  component: RecipeList,
})

function RecipeList() {
  return <RecipesPage nav={flatRecipeNav} />
}
