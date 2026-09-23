import { createFileRoute } from '@tanstack/react-router'
import { useRequiredCurrentGroup } from '../../../components/app/useCurrentGroup'
import { TastingSubjectPage } from '../../../components/tastings/TastingSubjectPage'
import { groupTastingNav } from '../../../components/tastings/tastingNav'

export const Route = createFileRoute('/_app/cheeses/$subjectId/')({
  component: CheeseSubjectRoute,
})

function CheeseSubjectRoute() {
  const { subjectId } = Route.useParams()
  const group = useRequiredCurrentGroup()
  return (
    <TastingSubjectPage
      kind="cheese"
      subjectId={subjectId}
      groupSlug={group.slug}
      groupName={group.name}
      nav={groupTastingNav('cheese', group.slug)}
    />
  )
}
