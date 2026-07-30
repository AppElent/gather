import { createFileRoute } from '@tanstack/react-router'
import { RecipeDetailPage } from '../../../../../components/recipes/RecipeDetailPage'
import { groupRecipeNav } from '../../../../../components/recipes/recipeNav'

export const Route = createFileRoute('/_app/g/$groupSlug/recipes/$recipeId/')({
  component: GroupRecipeDetail,
})

function GroupRecipeDetail() {
  const { groupSlug, recipeId } = Route.useParams()

  return (
    <RecipeDetailPage recipeId={recipeId} nav={groupRecipeNav(groupSlug)} />
  )
}
