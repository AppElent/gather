import { createFileRoute } from '@tanstack/react-router'
import { LegacySpaceRedirect } from '../../components/spaces/LegacySpaceRedirect'

export const Route = createFileRoute('/_app/notes')({
  component: () => <LegacySpaceRedirect from="/notes" />,
})
