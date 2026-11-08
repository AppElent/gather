import { createFileRoute } from '@tanstack/react-router'
import { FoodDetailPage } from '../../../components/foods/FoodDetailPage'

export const Route = createFileRoute('/_app/foods/$foodId/')({
  component: () => <FoodDetailPage foodId={Route.useParams().foodId} />,
})
