import { createFileRoute } from '@tanstack/react-router'
import { ModuleSettings } from '../../../../../components/settings/ModuleSettings'

export const Route = createFileRoute('/_app/s/$spaceSlug/settings/modules')({
  component: ModuleSettings,
})
