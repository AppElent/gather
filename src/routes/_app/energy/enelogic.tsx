import { createFileRoute } from '@tanstack/react-router'
import { EnergyEnelogicPage } from '../../../components/energy/EnergyEnelogicPage'

export const Route = createFileRoute('/_app/energy/enelogic')({
  component: EnergyEnelogicPage,
})
