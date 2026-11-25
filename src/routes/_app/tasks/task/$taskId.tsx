import { createFileRoute } from '@tanstack/react-router'
import { validateTaskPageSearch } from '../../../../components/tasks/selection'
import { TaskPage } from '../../../../components/tasks/TaskPage'
import { TasksError } from '../../../../components/tasks/TasksError'

export const Route = createFileRoute('/_app/tasks/task/$taskId')({
  validateSearch: validateTaskPageSearch,
  errorComponent: TasksError,
  component: function TaskRoute() {
    const { taskId } = Route.useParams()
    const { list } = Route.useSearch()
    return <TaskPage key={taskId} taskId={taskId} listId={list} />
  },
})
