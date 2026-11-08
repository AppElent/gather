import { createFileRoute } from '@tanstack/react-router'
import {
  NewRecipePage,
  validateNewRecipeSearch,
} from '../../../components/recipes/NewRecipePage'

export const Route = createFileRoute('/_app/recipes/new')({
  component: () => <NewRecipePage initialUrl={Route.useSearch().url} />,
  validateSearch: validateNewRecipeSearch,
})
