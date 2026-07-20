import { createFileRoute } from '@tanstack/react-router'
import { LegacySpaceRedirect } from '../../components/spaces/LegacySpaceRedirect'

export const Route = createFileRoute('/_app/tasks')({
  component: () => <LegacySpaceRedirect from="/tasks" />,
})
