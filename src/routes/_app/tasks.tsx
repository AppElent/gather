import { createFileRoute, Outlet } from '@tanstack/react-router'
import { TasksError } from '../../components/tasks/TasksError'
import { TasksNotices } from '../../components/tasks/TasksNotices'

/** What every Tasks page shares, kept while going from one to another. */
export const Route = createFileRoute('/_app/tasks')({
  errorComponent: TasksError,
  component: function TasksLayout() {
    return (
      <TasksNotices>
        <Outlet />
      </TasksNotices>
    )
  },
})
