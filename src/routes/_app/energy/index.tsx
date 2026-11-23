import { createFileRoute } from '@tanstack/react-router'
import { EnergyPage } from '../../../components/energy/EnergyPage'

export const Route = createFileRoute('/_app/energy/')({
  component: EnergyPage,
})
