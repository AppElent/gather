import { createFileRoute } from '@tanstack/react-router'
import { EditFoodPage } from '../../../../../components/foods/EditFoodPage'
import { groupFoodNav } from '../../../../../components/foods/foodNav'

export const Route = createFileRoute('/_app/g/$groupSlug/foods/$foodId/edit')({
  component: GroupEditFood,
})

function GroupEditFood() {
  const { groupSlug, foodId } = Route.useParams()

  return <EditFoodPage foodId={foodId} nav={groupFoodNav(groupSlug)} />
}
