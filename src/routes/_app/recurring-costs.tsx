import { createFileRoute } from '@tanstack/react-router'
import { ModulePlaceholder } from '../../components/app/ModulePlaceholder'

export const Route = createFileRoute('/_app/recurring-costs')({
  component: () => <ModulePlaceholder moduleId="recurring-costs" />,
})
