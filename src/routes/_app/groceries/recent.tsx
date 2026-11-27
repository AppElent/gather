import { createFileRoute } from '@tanstack/react-router'
import { GroceriesError } from '../../../components/groceries/GroceriesError'
import { GroceriesRecentPage } from '../../../components/groceries/GroceriesNestedPages'

export const Route = createFileRoute('/_app/groceries/recent')({
  errorComponent: GroceriesError,
  component: GroceriesRecentRoute,
  validateSearch: (search: Record<string, unknown>): { list?: string } =>
    typeof search.list === 'string' && search.list ? { list: search.list } : {},
})

function GroceriesRecentRoute() {
  const { list } = Route.useSearch()
  return <GroceriesRecentPage listId={list} />
}
