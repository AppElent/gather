import { createFileRoute } from '@tanstack/react-router'
import { BabyDetailPage } from '../../../../../components/baby/BabyDetailPage'
import { groupBabyNav } from '../../../../../components/baby/babyNav'

export const Route = createFileRoute('/_app/g/$groupSlug/baby/$babyId/')({
  component: GroupBabyDetail,
})

function GroupBabyDetail() {
  const { groupSlug, babyId } = Route.useParams()

  return (
    <BabyDetailPage
      babyId={babyId}
      groupSlug={groupSlug}
      nav={groupBabyNav(groupSlug)}
    />
  )
}
