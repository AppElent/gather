import { createFileRoute } from '@tanstack/react-router'
import { FoodDetailPage } from '../../../../../components/foods/FoodDetailPage'
import { groupFoodNav } from '../../../../../components/foods/foodNav'

export const Route = createFileRoute('/_app/g/$groupSlug/foods/$foodId/')({
  component: GroupFoodDetail,
})

function GroupFoodDetail() {
  const { groupSlug, foodId } = Route.useParams()

  return <FoodDetailPage foodId={foodId} nav={groupFoodNav(groupSlug)} />
}
