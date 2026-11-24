import { createFileRoute } from '@tanstack/react-router'
import { EnergySourcesPage } from '../../../components/energy/EnergySourcesPage'

export const Route = createFileRoute('/_app/energy/sources')({
  component: EnergySourcesPage,
})
