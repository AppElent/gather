import { createFileRoute } from '@tanstack/react-router'
import { TastingSubjectPage } from '../../../components/tastings/TastingSubjectPage'

export const Route = createFileRoute('/_app/wines/$subjectId/')({
  component: () => (
    <TastingSubjectPage kind="wine" subjectId={Route.useParams().subjectId} />
  ),
})
