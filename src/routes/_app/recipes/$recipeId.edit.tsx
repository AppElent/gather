import { createFileRoute } from '@tanstack/react-router'
import { EditRecipePage } from '../../../components/recipes/EditRecipePage'
import { flatRecipeNav } from '../../../components/recipes/recipeNav'

export const Route = createFileRoute('/_app/recipes/$recipeId/edit')({
  component: EditRecipe,
})

function EditRecipe() {
  const { recipeId } = Route.useParams()

  return <EditRecipePage recipeId={recipeId} nav={flatRecipeNav} />
}
