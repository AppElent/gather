import { createFileRoute } from '@tanstack/react-router'
import { EnergyPriceFeedPage } from '../../../components/energy/EnergyPriceFeedPage'

export const Route = createFileRoute('/_app/energy/price-source')({
  component: EnergyPriceFeedPage,
})
