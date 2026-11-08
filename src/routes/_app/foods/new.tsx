import { createFileRoute } from '@tanstack/react-router'
import {
  NewFoodPage,
  validateNewFoodSearch,
} from '../../../components/foods/NewFoodPage'

export const Route = createFileRoute('/_app/foods/new')({
  component: () => <NewFoodPage {...Route.useSearch()} />,
  validateSearch: validateNewFoodSearch,
})
