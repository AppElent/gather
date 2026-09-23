import { createFileRoute } from '@tanstack/react-router'
import { useRequiredCurrentGroup } from '../../../components/app/useCurrentGroup'
import { TastingIndexPage } from '../../../components/tastings/TastingIndexPage'
import { groupTastingNav } from '../../../components/tastings/tastingNav'

export const Route = createFileRoute('/_app/beers/')({
  component: BeersPage,
})

function BeersPage() {
  const group = useRequiredCurrentGroup()
  return (
    <TastingIndexPage
      kind="beer"
      groupSlug={group.slug}
      groupName={group.name}
      nav={groupTastingNav('beer', group.slug)}
    />
  )
}
