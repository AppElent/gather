import { createFileRoute } from '@tanstack/react-router'
import { TastingSubjectPage } from '../../../components/tastings/TastingSubjectPage'

export const Route = createFileRoute('/_app/cheeses/$subjectId/')({
  component: () => (
    <TastingSubjectPage kind="cheese" subjectId={Route.useParams().subjectId} />
  ),
})
