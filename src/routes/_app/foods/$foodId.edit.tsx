import { createFileRoute } from '@tanstack/react-router'
import { EditFoodPage } from '../../../components/foods/EditFoodPage'

export const Route = createFileRoute('/_app/foods/$foodId/edit')({
  component: () => <EditFoodPage foodId={Route.useParams().foodId} />,
})
