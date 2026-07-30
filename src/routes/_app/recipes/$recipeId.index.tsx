import { createFileRoute } from '@tanstack/react-router'
import { RecipeDetailPage } from '../../../components/recipes/RecipeDetailPage'
import { flatRecipeNav } from '../../../components/recipes/recipeNav'

export const Route = createFileRoute('/_app/recipes/$recipeId/')({
  component: RecipeDetail,
})

function RecipeDetail() {
  const { recipeId } = Route.useParams()

  return <RecipeDetailPage recipeId={recipeId} nav={flatRecipeNav} />
}
