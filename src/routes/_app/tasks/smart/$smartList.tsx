import { createFileRoute } from '@tanstack/react-router'
import { SmartListPage } from '../../../../components/tasks/SmartListPage'
import { validateTaskSearch } from '../../../../components/tasks/selection'
import { TasksError } from '../../../../components/tasks/TasksError'

export const Route = createFileRoute('/_app/tasks/smart/$smartList')({
  validateSearch: validateTaskSearch,
  errorComponent: TasksError,
  component: function SmartListRoute() {
    const { smartList } = Route.useParams()
    const { task, list } = Route.useSearch()
    return (
      <SmartListPage
        key={smartList}
        smartList={smartList}
        selectedTaskId={task}
        selectedListId={list}
      />
    )
  },
})
