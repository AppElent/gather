import { createFileRoute } from '@tanstack/react-router'
import { TasksPage } from '../../../../components/tasks/TasksPage'
import { groupTaskNav } from '../../../../components/tasks/taskNav'

/**
 * Tasks inside a Group. The slug reaches Convex as well as the links, so this
 * is that household's lists and that household's Notion or Todoist connection
 * — never whichever one the account defaults to.
 */
export const Route = createFileRoute('/_app/g/$groupSlug/tasks')({
  component: GroupTasks,
})

function GroupTasks() {
  const { groupSlug } = Route.useParams()

  return <TasksPage groupSlug={groupSlug} nav={groupTaskNav(groupSlug)} />
}
