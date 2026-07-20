import { createFileRoute } from '@tanstack/react-router'
import { LegacySpaceRedirect } from '../../components/spaces/LegacySpaceRedirect'

export const Route = createFileRoute('/_app/dashboard')({
  component: Dashboard,
})

function Dashboard() {
  return <LegacySpaceRedirect from="/dashboard" />
}
