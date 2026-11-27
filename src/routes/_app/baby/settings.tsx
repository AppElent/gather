import { createFileRoute } from '@tanstack/react-router'
import { BabySettingsPage } from '../../../components/baby/BabySettingsPage'

export const Route = createFileRoute('/_app/baby/settings')({
  component: BabySettingsPage,
})
