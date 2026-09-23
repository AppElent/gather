import { createFileRoute } from '@tanstack/react-router'
import { useRequiredCurrentGroup } from '../../../components/app/useCurrentGroup'
import { EditTastingSubjectPage } from '../../../components/tastings/EditTastingSubjectPage'
import { groupTastingNav } from '../../../components/tastings/tastingNav'

export const Route = createFileRoute('/_app/cheeses/$subjectId/edit')({
  component: EditCheeseRoute,
})

function EditCheeseRoute() {
  const { subjectId } = Route.useParams()
  const group = useRequiredCurrentGroup()
  return (
    <EditTastingSubjectPage
      kind="cheese"
      subjectId={subjectId}
      groupSlug={group.slug}
      nav={groupTastingNav('cheese', group.slug)}
    />
  )
}
