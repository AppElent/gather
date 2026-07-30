import { createFileRoute } from '@tanstack/react-router'
import { flatBabyNav } from '../../../components/baby/babyNav'
import { EditBabyPage } from '../../../components/baby/EditBabyPage'

export const Route = createFileRoute('/_app/baby/$babyId/edit')({
  component: EditBaby,
})

function EditBaby() {
  const { babyId } = Route.useParams()

  return <EditBabyPage babyId={babyId} nav={flatBabyNav} />
}
