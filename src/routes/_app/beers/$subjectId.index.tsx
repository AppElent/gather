import { createFileRoute } from '@tanstack/react-router'
import { TastingSubjectPage } from '../../../components/tastings/TastingSubjectPage'

export const Route = createFileRoute('/_app/beers/$subjectId/')({
  component: () => (
    <TastingSubjectPage kind="beer" subjectId={Route.useParams().subjectId} />
  ),
})
