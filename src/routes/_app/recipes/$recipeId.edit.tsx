import { createFileRoute } from '@tanstack/react-router'
import { EditRecipePage } from '../../../components/recipes/EditRecipePage'

export const Route = createFileRoute('/_app/recipes/$recipeId/edit')({
  component: () => <EditRecipePage recipeId={Route.useParams().recipeId} />,
})
