import { createFileRoute } from '@tanstack/react-router'
import { useRequiredCurrentGroup } from '../../../components/app/useCurrentGroup'
import { EditTastingSubjectPage } from '../../../components/tastings/EditTastingSubjectPage'
import { groupTastingNav } from '../../../components/tastings/tastingNav'

export const Route = createFileRoute('/_app/beers/$subjectId/edit')({
  component: EditBeerRoute,
})

function EditBeerRoute() {
  const { subjectId } = Route.useParams()
  const group = useRequiredCurrentGroup()
  return (
    <EditTastingSubjectPage
      kind="beer"
      subjectId={subjectId}
      groupSlug={group.slug}
      nav={groupTastingNav('beer', group.slug)}
    />
  )
}
