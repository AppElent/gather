import { createFileRoute } from '@tanstack/react-router'
import { AllModulesPage } from '../../components/app/AllModulesPage'

export const Route = createFileRoute('/_app/all')({
  component: AllModulesPage,
})
