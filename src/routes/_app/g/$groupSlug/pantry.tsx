import { createFileRoute } from '@tanstack/react-router'
import { ModulePlaceholder } from '../../../../components/app/ModulePlaceholder'

export const Route = createFileRoute('/_app/g/$groupSlug/pantry')({
  component: () => <ModulePlaceholder moduleId="pantry" />,
})
