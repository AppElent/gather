import { Navigate } from '@tanstack/react-router'
import { useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { Breadcrumbs, type Crumb } from '../app/Breadcrumbs'
import { useTaskOf } from './data'
import { listLink, taskLink } from './selection'
import { TaskPanel } from './TaskPanel'
import { TasksWorkspace } from './TasksWorkspace'

interface TaskPageProps {
  taskId: string
  /** The list a linked task was opened from. */
  listId?: string
}

/** A task on a page of its own: where a row goes below `lg`, and linkable. */
export function TaskPage(props: TaskPageProps) {
  return (
    <TasksWorkspace>
      <TaskPageBody {...props} />
    </TasksWorkspace>
  )
}

function TaskPageBody({ taskId, listId }: TaskPageProps) {
  const { messages: t } = useI18n()
  const state = useTaskOf(taskId, listId)
  const ready = state.status === 'ready' ? state : null
  if (ready?.list.grocery) {
    return (
      <Navigate
        {...taskLink(
          { kind: 'task' },
          { id: taskId, listId: ready.list.id, grocery: true },
          false,
        )}
        replace
      />
    )
  }
  const parent = ready?.task.parentTaskId
    ? ready.tasks.find((each) => each.id === ready.task.parentTaskId)
    : undefined
  const trail: Crumb[] = [
    { label: t.tasks.web.parent, link: linkTo('tasks') },
    ...(ready ? [{ label: ready.list.name, link: listLink(ready.list) }] : []),
    ...(parent
      ? [{ label: parent.title, link: taskLink({ kind: 'task' }, parent, false) }]
      : []),
    { label: ready?.task.title ?? t.tasks.web.taskTitle },
  ]
  return (
    <div className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-4">
      <Breadcrumbs trail={trail} className="-mb-1" />
      <h1 className="sr-only">{ready?.task.title ?? t.tasks.web.taskTitle}</h1>
      <div
        data-group="home"
        className="rounded-[var(--radius-card)] bg-[var(--surface)]"
      >
        <TaskPanel state={state} place={{ kind: 'task' }} />
      </div>
    </div>
  )
}
