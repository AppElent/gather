import { createFileRoute } from '@tanstack/react-router'
import { validateTaskSearch } from '../../../components/tasks/selection'
import { TaskListPage } from '../../../components/tasks/TaskListPage'
import { TasksError } from '../../../components/tasks/TasksError'

export const Route = createFileRoute('/_app/tasks/$listId')({
  validateSearch: validateTaskSearch,
  errorComponent: TasksError,
  component: function TaskListRoute() {
    const { listId } = Route.useParams()
    const { task } = Route.useSearch()
    return <TaskListPage key={listId} listId={listId} selectedTaskId={task} />
  },
})
