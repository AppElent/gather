import { createFileRoute } from '@tanstack/react-router'
import { ModulePlaceholder } from '../../../../components/app/ModulePlaceholder'

export const Route = createFileRoute('/_app/g/$groupSlug/calendar')({
  component: () => <ModulePlaceholder moduleId="calendar" />,
})
