import { createFileRoute } from '@tanstack/react-router'
import { groupBabyNav } from '../../../../../components/baby/babyNav'
import { EditBabyPage } from '../../../../../components/baby/EditBabyPage'

export const Route = createFileRoute('/_app/g/$groupSlug/baby/$babyId/edit')({
  component: GroupEditBaby,
})

function GroupEditBaby() {
  const { groupSlug, babyId } = Route.useParams()

  return (
    <EditBabyPage
      babyId={babyId}
      groupSlug={groupSlug}
      nav={groupBabyNav(groupSlug)}
    />
  )
}
