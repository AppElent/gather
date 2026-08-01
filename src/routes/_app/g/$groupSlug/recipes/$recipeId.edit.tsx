import { createFileRoute } from '@tanstack/react-router'
import { EditRecipePage } from '../../../../../components/recipes/EditRecipePage'
import { groupRecipeNav } from '../../../../../components/recipes/recipeNav'

export const Route = createFileRoute(
  '/_app/g/$groupSlug/recipes/$recipeId/edit',
)({
  component: GroupEditRecipe,
})

function GroupEditRecipe() {
  const { groupSlug, recipeId } = Route.useParams()

  return (
    <EditRecipePage
      recipeId={recipeId}
      groupSlug={groupSlug}
      nav={groupRecipeNav(groupSlug)}
    />
  )
}
