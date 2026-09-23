import { createFileRoute } from '@tanstack/react-router'
import { useRequiredCurrentGroup } from '../../../components/app/useCurrentGroup'
import { TastingSubjectPage } from '../../../components/tastings/TastingSubjectPage'
import { groupTastingNav } from '../../../components/tastings/tastingNav'

export const Route = createFileRoute('/_app/wines/$subjectId/')({
  component: WineSubjectRoute,
})

function WineSubjectRoute() {
  const { subjectId } = Route.useParams()
  const group = useRequiredCurrentGroup()
  return (
    <TastingSubjectPage
      kind="wine"
      subjectId={subjectId}
      groupSlug={group.slug}
      groupName={group.name}
      nav={groupTastingNav('wine', group.slug)}
    />
  )
}
