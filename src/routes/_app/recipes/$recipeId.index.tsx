import { createFileRoute } from '@tanstack/react-router'
import { useRequiredCurrentGroup } from '#/components/app/useCurrentGroup'
import { RecipeDetailPage } from '../../../components/recipes/RecipeDetailPage'
import { groupRecipeNav } from '../../../components/recipes/recipeNav'

export const Route = createFileRoute('/_app/recipes/$recipeId/')({
  component: GroupRecipeDetail,
})

function GroupRecipeDetail() {
  const { recipeId } = Route.useParams()
  const { slug: groupSlug } = useRequiredCurrentGroup()

  return (
    <RecipeDetailPage
      recipeId={recipeId}
      groupSlug={groupSlug}
      nav={groupRecipeNav(groupSlug)}
    />
  )
}
