import { createFileRoute } from '@tanstack/react-router'
import { groupBabyNav } from '../../../components/baby/babyNav'
import { NewBabyPage } from '../../../components/baby/NewBabyPage'

export const Route = createFileRoute('/_app/baby/new')({
  component: GroupNewBaby,
})

function GroupNewBaby() {
  const { slug: groupSlug } = useRequiredCurrentGroup()

  return <NewBabyPage groupSlug={groupSlug} nav={groupBabyNav(groupSlug)} />
}
import { useRequiredCurrentGroup } from '#/components/app/useCurrentGroup'
