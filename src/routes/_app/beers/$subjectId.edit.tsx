import { createFileRoute } from '@tanstack/react-router'
import { EditTastingSubjectPage } from '../../../components/tastings/EditTastingSubjectPage'

export const Route = createFileRoute('/_app/beers/$subjectId/edit')({
  component: () => (
    <EditTastingSubjectPage
      kind="beer"
      subjectId={Route.useParams().subjectId}
    />
  ),
})
