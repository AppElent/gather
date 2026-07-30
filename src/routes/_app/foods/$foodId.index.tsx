import { createFileRoute } from '@tanstack/react-router'
import { FoodDetailPage } from '../../../components/foods/FoodDetailPage'
import { flatFoodNav } from '../../../components/foods/foodNav'

export const Route = createFileRoute('/_app/foods/$foodId/')({
  component: FoodDetail,
})

function FoodDetail() {
  const { foodId } = Route.useParams()

  return <FoodDetailPage foodId={foodId} nav={flatFoodNav} />
}
