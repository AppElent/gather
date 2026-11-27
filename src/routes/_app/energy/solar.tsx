import { createFileRoute } from '@tanstack/react-router'
import { EnergySolarPage } from '../../../components/energy/EnergySolarPage'

export const Route = createFileRoute('/_app/energy/solar')({
  component: EnergySolarPage,
})
