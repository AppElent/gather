import { createFileRoute } from '@tanstack/react-router'
import { ModulePlaceholder } from '../../../../components/app/ModulePlaceholder'

export const Route = createFileRoute('/_app/g/$groupSlug/finances')({
  component: () => <ModulePlaceholder moduleId="finances" />,
})
