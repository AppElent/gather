import { createFileRoute } from '@tanstack/react-router'
import { EditTastingSubjectPage } from '../../../components/tastings/EditTastingSubjectPage'

export const Route = createFileRoute('/_app/wines/$subjectId/edit')({
  component: () => (
    <EditTastingSubjectPage
      kind="wine"
      subjectId={Route.useParams().subjectId}
    />
  ),
})
