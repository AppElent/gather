import { createFileRoute } from '@tanstack/react-router'
import { FoodsPage } from '../../../components/foods/FoodsPage'
import { flatFoodNav } from '../../../components/foods/foodNav'

export const Route = createFileRoute('/_app/foods/')({
  component: FoodsIndex,
})

function FoodsIndex() {
  return <FoodsPage nav={flatFoodNav} />
}
