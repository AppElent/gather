import { createFileRoute } from '@tanstack/react-router'
import { LegacySpaceRedirect } from '../../components/spaces/LegacySpaceRedirect'

export const Route = createFileRoute('/_app/wines')({
  component: () => <LegacySpaceRedirect from="/wines" />,
})
