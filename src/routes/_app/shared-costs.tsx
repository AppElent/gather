import { createFileRoute } from '@tanstack/react-router'
import { SharedCostsError } from '../../components/shared-costs/SharedCostsError'
import { SharedCostsPage } from '../../components/shared-costs/SharedCostsPage'

interface SharedCostsSearch {
  /** The saved split that is open. */
  split?: string
}

export const Route = createFileRoute('/_app/shared-costs')({
  errorComponent: SharedCostsError,
  component: SharedCostsRoute,
  validateSearch: (search: Record<string, unknown>): SharedCostsSearch =>
    typeof search.split === 'string' && search.split
      ? { split: search.split }
      : {},
})

function SharedCostsRoute() {
  const { split } = Route.useSearch()
  return <SharedCostsPage openSplitId={split} />
}
