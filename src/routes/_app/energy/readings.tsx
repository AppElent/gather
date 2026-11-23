import { createFileRoute } from '@tanstack/react-router'
import { EnergyReadingsPage } from '../../../components/energy/EnergyReadingsPage'

export const Route = createFileRoute('/_app/energy/readings')({
  component: EnergyReadingsPage,
})
