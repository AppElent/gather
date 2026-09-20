import { createFileRoute } from '@tanstack/react-router'
import { ModulePlaceholder } from '../../components/app/ModulePlaceholder'

export const Route = createFileRoute('/_app/savings-goals')({
  component: () => <ModulePlaceholder moduleId="savings-goals" />,
})
