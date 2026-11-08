import { createFileRoute } from '@tanstack/react-router'
import { EditBabyPage } from '../../../components/baby/EditBabyPage'

export const Route = createFileRoute('/_app/baby/$babyId/edit')({
  component: () => <EditBabyPage babyId={Route.useParams().babyId} />,
})
