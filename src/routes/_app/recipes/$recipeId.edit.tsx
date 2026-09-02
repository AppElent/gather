import { createFileRoute } from '@tanstack/react-router'
import { EditRecipePage } from '../../../components/recipes/EditRecipePage'
import { groupRecipeNav } from '../../../components/recipes/recipeNav'

export const Route = createFileRoute(
  '/_app/recipes/$recipeId/edit',
)({
  component: GroupEditRecipe,
})

function GroupEditRecipe() {
  const { recipeId } = Route.useParams()
  const { slug: groupSlug } = useRequiredCurrentGroup()

  return (
    <EditRecipePage
      recipeId={recipeId}
      groupSlug={groupSlug}
      nav={groupRecipeNav(groupSlug)}
    />
  )
}
import { useRequiredCurrentGroup } from '#/components/app/useCurrentGroup'
