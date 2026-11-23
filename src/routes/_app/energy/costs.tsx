import { createFileRoute } from '@tanstack/react-router'
import { EnergyCostsPage } from '../../../components/energy/EnergyCostsPage'

export const Route = createFileRoute('/_app/energy/costs')({
  component: EnergyCostsPage,
})
