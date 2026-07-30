import { createFileRoute } from '@tanstack/react-router'
import { BabyListPage } from '../../../components/baby/BabyListPage'
import { flatBabyNav } from '../../../components/baby/babyNav'

export const Route = createFileRoute('/_app/baby/')({
  component: BabyList,
})

function BabyList() {
  return <BabyListPage nav={flatBabyNav} />
}
