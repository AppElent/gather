import { createFileRoute } from '@tanstack/react-router'
import { BabyDetailPage } from '../../../components/baby/BabyDetailPage'
import { flatBabyNav } from '../../../components/baby/babyNav'

export const Route = createFileRoute('/_app/baby/$babyId/')({
  component: BabyDetail,
})

function BabyDetail() {
  const { babyId } = Route.useParams()

  return <BabyDetailPage babyId={babyId} nav={flatBabyNav} />
}
