import { createFileRoute } from '@tanstack/react-router'
import { AllModules } from '../../../../components/modules/AllModules'

export const Route = createFileRoute('/_app/s/$spaceSlug/modules')({
  component: AllModules,
})
