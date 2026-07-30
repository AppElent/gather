import { createFileRoute } from '@tanstack/react-router'
import { flatBabyNav } from '../../../components/baby/babyNav'
import { NewBabyPage } from '../../../components/baby/NewBabyPage'

export const Route = createFileRoute('/_app/baby/new')({
  component: NewBaby,
})

function NewBaby() {
  return <NewBabyPage nav={flatBabyNav} />
}
