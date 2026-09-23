import { createFileRoute } from '@tanstack/react-router'
import { useRequiredCurrentGroup } from '../../../components/app/useCurrentGroup'
import { EditTastingSubjectPage } from '../../../components/tastings/EditTastingSubjectPage'
import { groupTastingNav } from '../../../components/tastings/tastingNav'

export const Route = createFileRoute('/_app/wines/$subjectId/edit')({
  component: EditWineRoute,
})

function EditWineRoute() {
  const { subjectId } = Route.useParams()
  const group = useRequiredCurrentGroup()
  return (
    <EditTastingSubjectPage
      kind="wine"
      subjectId={subjectId}
      groupSlug={group.slug}
      nav={groupTastingNav('wine', group.slug)}
    />
  )
}
