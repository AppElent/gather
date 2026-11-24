import { createFileRoute } from '@tanstack/react-router'
import { TastingIndexPage } from '../../../components/tastings/TastingIndexPage'
import { validateNewSearch } from '../../../lib/createActions'

export const Route = createFileRoute('/_app/cheeses/')({
  validateSearch: validateNewSearch,
  component: function CheesesIndex() {
    const search = Route.useSearch()
    const navigate = Route.useNavigate()
    return (
      <TastingIndexPage
        kind="cheese"
        startCreating={search.new}
        onCreateStarted={() => navigate({ search: {}, replace: true })}
      />
    )
  },
})
