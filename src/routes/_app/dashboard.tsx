import { createFileRoute } from '@tanstack/react-router'
import { CommandFeed } from '../../components/app/CommandFeed'

export const Route = createFileRoute('/_app/dashboard')({
  component: Dashboard,
})

function Dashboard() {
  return <CommandFeed />
}
