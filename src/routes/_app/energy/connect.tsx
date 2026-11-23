import { createFileRoute } from '@tanstack/react-router'
import { EnergyConnectPage } from '../../../components/energy/EnergyConnectPage'

export const Route = createFileRoute('/_app/energy/connect')({
  component: EnergyConnectPage,
})
