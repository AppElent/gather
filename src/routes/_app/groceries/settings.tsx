import { createFileRoute } from '@tanstack/react-router'
import { GroceriesError } from '../../../components/groceries/GroceriesError'
import { GroceriesSettingsPage } from '../../../components/groceries/GroceriesSettingsPage'

export const Route = createFileRoute('/_app/groceries/settings')({
  errorComponent: GroceriesError,
  component: GroceriesSettingsRoute,
  validateSearch: (search: Record<string, unknown>): { list?: string } =>
    typeof search.list === 'string' && search.list ? { list: search.list } : {},
})

function GroceriesSettingsRoute() {
  const { list } = Route.useSearch()
  return <GroceriesSettingsPage listId={list} />
}
