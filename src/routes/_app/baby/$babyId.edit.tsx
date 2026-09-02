import { createFileRoute } from '@tanstack/react-router'
import { groupBabyNav } from '../../../components/baby/babyNav'
import { EditBabyPage } from '../../../components/baby/EditBabyPage'

export const Route = createFileRoute('/_app/baby/$babyId/edit')({
  component: GroupEditBaby,
})

function GroupEditBaby() {
  const { babyId } = Route.useParams()
  const { slug: groupSlug } = useRequiredCurrentGroup()

  return (
    <EditBabyPage
      babyId={babyId}
      groupSlug={groupSlug}
      nav={groupBabyNav(groupSlug)}
    />
  )
}
import { useRequiredCurrentGroup } from '#/components/app/useCurrentGroup'
