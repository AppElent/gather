import { createFileRoute } from '@tanstack/react-router'
import { BabyDetailPage } from '../../../components/baby/BabyDetailPage'
import { groupBabyNav } from '../../../components/baby/babyNav'

export const Route = createFileRoute('/_app/baby/$babyId/')({
  component: GroupBabyDetail,
})

function GroupBabyDetail() {
  const { babyId } = Route.useParams()
  const { slug: groupSlug } = useRequiredCurrentGroup()

  return (
    <BabyDetailPage
      babyId={babyId}
      groupSlug={groupSlug}
      nav={groupBabyNav(groupSlug)}
    />
  )
}
import { useRequiredCurrentGroup } from '#/components/app/useCurrentGroup'
