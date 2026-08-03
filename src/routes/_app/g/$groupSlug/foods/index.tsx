import { createFileRoute } from '@tanstack/react-router'
import { FoodsPage } from '../../../../../components/foods/FoodsPage'
import { groupFoodNav } from '../../../../../components/foods/foodNav'

/**
 * Foods inside a Group. The Catalog belongs to nobody, so this shows exactly
 * what `/foods` shows; the Group segment keeps the links — and therefore
 * whoever follows them — inside the Group they started in (ADR-0002).
 */
export const Route = createFileRoute('/_app/g/$groupSlug/foods/')({
  component: GroupFoodsIndex,
})

function GroupFoodsIndex() {
  const { groupSlug } = Route.useParams()

  return <FoodsPage nav={groupFoodNav(groupSlug)} />
}
