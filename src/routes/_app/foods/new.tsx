import { createFileRoute } from '@tanstack/react-router'
import { flatFoodNav } from '../../../components/foods/foodNav'
import {
  NewFoodPage,
  validateNewFoodSearch,
} from '../../../components/foods/NewFoodPage'

export const Route = createFileRoute('/_app/foods/new')({
  component: NewFood,
  validateSearch: validateNewFoodSearch,
})

function NewFood() {
  const { barcode } = Route.useSearch()

  return <NewFoodPage barcode={barcode} nav={flatFoodNav} />
}
