import { createFileRoute } from '@tanstack/react-router'
import { groupFoodNav } from '../../../../../components/foods/foodNav'
import {
  NewFoodPage,
  validateNewFoodSearch,
} from '../../../../../components/foods/NewFoodPage'

export const Route = createFileRoute('/_app/g/$groupSlug/foods/new')({
  component: GroupNewFood,
  validateSearch: validateNewFoodSearch,
})

function GroupNewFood() {
  const { groupSlug } = Route.useParams()
  const { barcode } = Route.useSearch()

  return <NewFoodPage barcode={barcode} nav={groupFoodNav(groupSlug)} />
}
