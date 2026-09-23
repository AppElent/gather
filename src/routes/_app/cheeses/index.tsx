import { createFileRoute } from '@tanstack/react-router'
import { useRequiredCurrentGroup } from '../../../components/app/useCurrentGroup'
import { TastingIndexPage } from '../../../components/tastings/TastingIndexPage'
import { groupTastingNav } from '../../../components/tastings/tastingNav'

export const Route = createFileRoute('/_app/cheeses/')({
  component: CheesesPage,
})

function CheesesPage() {
  const group = useRequiredCurrentGroup()
  return (
    <TastingIndexPage
      kind="cheese"
      groupSlug={group.slug}
      groupName={group.name}
      nav={groupTastingNav('cheese', group.slug)}
    />
  )
}
