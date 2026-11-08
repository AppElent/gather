import { createFileRoute } from '@tanstack/react-router'
import { BabyDetailPage } from '../../../components/baby/BabyDetailPage'

export const Route = createFileRoute('/_app/baby/$babyId/')({
  component: () => <BabyDetailPage babyId={Route.useParams().babyId} />,
})
