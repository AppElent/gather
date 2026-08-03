import { createFileRoute } from '@tanstack/react-router'
import { BabyListPage } from '../../../../../components/baby/BabyListPage'
import { groupBabyNav } from '../../../../../components/baby/babyNav'

/**
 * The baby log inside a Group. Unlike Nutrition, this one really is that
 * Group's content: the slug goes to Convex as well as into the links, so the
 * page shows this household's children and no other household's.
 */
export const Route = createFileRoute('/_app/g/$groupSlug/baby/')({
  component: GroupBabyList,
})

function GroupBabyList() {
  const { groupSlug } = Route.useParams()

  return <BabyListPage groupSlug={groupSlug} nav={groupBabyNav(groupSlug)} />
}
