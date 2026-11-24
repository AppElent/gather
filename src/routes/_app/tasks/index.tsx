import { createFileRoute } from '@tanstack/react-router'
import { TasksPage } from '../../../components/tasks/TasksPage'
import { validateNewSearch } from '../../../lib/createActions'

export const Route = createFileRoute('/_app/tasks/')({
  validateSearch: validateNewSearch,
  component: function TasksIndex() {
    const search = Route.useSearch()
    const navigate = Route.useNavigate()
    return (
      <TasksPage
        startCreating={search.new}
        onCreateStarted={() => navigate({ search: {}, replace: true })}
      />
    )
  },
})
