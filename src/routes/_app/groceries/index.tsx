import { createFileRoute } from '@tanstack/react-router'
import { GroceriesError } from '../../../components/groceries/GroceriesError'
import {
  GroceriesPage,
  type GroceriesPanelTab,
} from '../../../components/groceries/GroceriesPage'

interface GroceriesSearch {
  item?: string
  list?: string
  tab?: GroceriesPanelTab
}

export const Route = createFileRoute('/_app/groceries/')({
  errorComponent: GroceriesError,
  component: GroceriesRoute,
  validateSearch: (search: Record<string, unknown>): GroceriesSearch => ({
    ...(typeof search.item === 'string' && search.item
      ? { item: search.item }
      : {}),
    ...(typeof search.list === 'string' && search.list
      ? { list: search.list }
      : {}),
    ...(search.tab === 'stock' ? { tab: 'stock' }
      : {}),
  }),
})

function GroceriesRoute() {
  const { item, list, tab } = Route.useSearch()
  return (
    <GroceriesPage
      selectedItemId={item}
      selectedListId={list}
      tab={tab}
    />
  )
}
