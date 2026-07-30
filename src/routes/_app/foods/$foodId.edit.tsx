import { createFileRoute } from '@tanstack/react-router'
import { EditFoodPage } from '../../../components/foods/EditFoodPage'
import { flatFoodNav } from '../../../components/foods/foodNav'

export const Route = createFileRoute('/_app/foods/$foodId/edit')({
  component: EditFood,
})

function EditFood() {
  const { foodId } = Route.useParams()

  return <EditFoodPage foodId={foodId} nav={flatFoodNav} />
}
