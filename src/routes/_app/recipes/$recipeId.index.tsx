import { createFileRoute } from '@tanstack/react-router'
import { RecipeDetailPage } from '../../../components/recipes/RecipeDetailPage'

export const Route = createFileRoute('/_app/recipes/$recipeId/')({
  component: () => <RecipeDetailPage recipeId={Route.useParams().recipeId} />,
})
