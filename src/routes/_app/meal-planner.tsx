import { createFileRoute } from '@tanstack/react-router'
import { LegacySpaceRedirect } from '../../components/spaces/LegacySpaceRedirect'

export const Route = createFileRoute('/_app/meal-planner')({
  component: () => <LegacySpaceRedirect from="/meal-planner" />,
})
