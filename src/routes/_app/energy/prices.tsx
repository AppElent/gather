import { createFileRoute } from '@tanstack/react-router'
import { EnergyPricesPage } from '../../../components/energy/EnergyPricesPage'

export const Route = createFileRoute('/_app/energy/prices')({
  component: EnergyPricesPage,
})
