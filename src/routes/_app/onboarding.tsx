import { createFileRoute } from '@tanstack/react-router'
import { SpaceOnboarding } from '../../components/spaces/SpaceOnboarding'

export const Route = createFileRoute('/_app/onboarding')({
  component: SpaceOnboarding,
})
