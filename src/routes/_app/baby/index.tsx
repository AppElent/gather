import { createFileRoute } from '@tanstack/react-router'
import { BabyListPage } from '../../../components/baby/BabyListPage'

export const Route = createFileRoute('/_app/baby/')({
  component: BabyListPage,
})
