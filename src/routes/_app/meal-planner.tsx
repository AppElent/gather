import { createFileRoute } from '@tanstack/react-router'
import { ModulePlaceholder } from '../../components/app/ModulePlaceholder'

export const Route = createFileRoute('/_app/meal-planner')({
  component: () => <ModulePlaceholder moduleId="meal-planner" />,
})
