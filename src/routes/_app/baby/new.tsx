import { createFileRoute } from '@tanstack/react-router'
import { NewBabyPage } from '../../../components/baby/NewBabyPage'

export const Route = createFileRoute('/_app/baby/new')({
  component: NewBabyPage,
})
