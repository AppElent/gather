import { createFileRoute } from '@tanstack/react-router'
import { TaskPage } from '../../../../components/tasks/TaskPage'
import { TasksError } from '../../../../components/tasks/TasksError'

export const Route = createFileRoute('/_app/tasks/task/$taskId')({
  errorComponent: TasksError,
  component: function TaskRoute() {
    const { taskId } = Route.useParams()
    return <TaskPage key={taskId} taskId={taskId} />
  },
})
