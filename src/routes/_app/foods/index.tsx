import { createFileRoute } from '@tanstack/react-router'
import { FoodsPage } from '../../../components/foods/FoodsPage'

export const Route = createFileRoute('/_app/foods/')({
  component: FoodsPage,
})
