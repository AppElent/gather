import { createFileRoute } from '@tanstack/react-router'
import { useRequiredCurrentGroup } from '../../../components/app/useCurrentGroup'
import { TastingIndexPage } from '../../../components/tastings/TastingIndexPage'
import { groupTastingNav } from '../../../components/tastings/tastingNav'

export const Route = createFileRoute('/_app/wines/')({
  component: WinesPage,
})

function WinesPage() {
  const group = useRequiredCurrentGroup()
  return (
    <TastingIndexPage
      kind="wine"
      groupSlug={group.slug}
      groupName={group.name}
      nav={groupTastingNav('wine', group.slug)}
    />
  )
}
