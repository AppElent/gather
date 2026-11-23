import { createFileRoute } from '@tanstack/react-router'
import { EnergyContractPage } from '../../../components/energy/EnergyContractPage'

export const Route = createFileRoute('/_app/energy/contract')({
  component: EnergyContractPage,
})
