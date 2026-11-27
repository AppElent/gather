import { createFileRoute } from '@tanstack/react-router'
import { TastingIndexPage } from '../../../components/tastings/TastingIndexPage'
import { validateNewSearch } from '../../../lib/createActions'

export const Route = createFileRoute('/_app/wines/')({
  validateSearch: validateNewSearch,
  component: function WinesIndex() {
    const search = Route.useSearch()
    const navigate = Route.useNavigate()
    return (
      <TastingIndexPage
        kind="wine"
        startCreating={search.new}
        onCreateStarted={() => navigate({ search: {}, replace: true })}
      />
    )
  },
})
