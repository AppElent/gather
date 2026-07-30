import { createFileRoute } from '@tanstack/react-router'
import { TasksPage } from '../../components/tasks/TasksPage'
import { flatTaskNav } from '../../components/tasks/taskNav'

export const Route = createFileRoute('/_app/tasks')({
  component: Tasks,
})

function Tasks() {
  return <TasksPage nav={flatTaskNav} />
}
