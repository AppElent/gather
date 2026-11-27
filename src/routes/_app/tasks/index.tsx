import { createFileRoute } from '@tanstack/react-router'
import { TasksError } from '../../../components/tasks/TasksError'
import { TasksIndexPage } from '../../../components/tasks/TasksIndexPage'
import { validateNewSearch } from '../../../lib/createActions'

export const Route = createFileRoute('/_app/tasks/')({
  validateSearch: validateNewSearch,
  errorComponent: TasksError,
  component: function TasksIndex() {
    const search = Route.useSearch()
    const navigate = Route.useNavigate()
    return (
      <TasksIndexPage
        startCreating={search.new}
        onCreateStarted={() => navigate({ search: {}, replace: true })}
      />
    )
  },
})
