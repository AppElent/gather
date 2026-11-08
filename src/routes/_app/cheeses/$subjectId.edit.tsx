import { createFileRoute } from '@tanstack/react-router'
import { EditTastingSubjectPage } from '../../../components/tastings/EditTastingSubjectPage'

export const Route = createFileRoute('/_app/cheeses/$subjectId/edit')({
  component: () => (
    <EditTastingSubjectPage
      kind="cheese"
      subjectId={Route.useParams().subjectId}
    />
  ),
})
