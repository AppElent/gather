import { createFileRoute } from '@tanstack/react-router'
import { TastingIndexPage } from '../../../components/tastings/TastingIndexPage'
import { validateNewSearch } from '../../../lib/createActions'

export const Route = createFileRoute('/_app/beers/')({
  validateSearch: validateNewSearch,
  component: function BeersIndex() {
    const search = Route.useSearch()
    const navigate = Route.useNavigate()
    return (
      <TastingIndexPage
        kind="beer"
        startCreating={search.new}
        onCreateStarted={() => navigate({ search: {}, replace: true })}
      />
    )
  },
})
