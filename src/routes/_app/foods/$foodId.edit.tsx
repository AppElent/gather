import { createFileRoute } from '@tanstack/react-router'
import { EditFoodPage } from '../../../components/foods/EditFoodPage'
import { groupFoodNav } from '../../../components/foods/foodNav'

export const Route = createFileRoute('/_app/foods/$foodId/edit')({
  component: GroupEditFood,
})

function GroupEditFood() {
  const { foodId } = Route.useParams()
  const { slug: groupSlug } = useRequiredCurrentGroup()

  return <EditFoodPage foodId={foodId} nav={groupFoodNav(groupSlug)} />
}
import { useRequiredCurrentGroup } from '#/components/app/useCurrentGroup'
