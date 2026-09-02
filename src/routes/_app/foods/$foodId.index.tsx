import { createFileRoute } from '@tanstack/react-router'
import { FoodDetailPage } from '../../../components/foods/FoodDetailPage'
import { groupFoodNav } from '../../../components/foods/foodNav'

export const Route = createFileRoute('/_app/foods/$foodId/')({
  component: GroupFoodDetail,
})

function GroupFoodDetail() {
  const { foodId } = Route.useParams()
  const { slug: groupSlug } = useRequiredCurrentGroup()

  return <FoodDetailPage foodId={foodId} nav={groupFoodNav(groupSlug)} />
}
import { useRequiredCurrentGroup } from '#/components/app/useCurrentGroup'
