import { useAction, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { TaskEditorValues } from './TaskEditor'

/**
 * What happened to a write, as far as the person who asked for it is
 * concerned. `savedRemotely` is the one worth showing: the provider took the
 * change and gather's copy is behind, which is neither a success to say nothing
 * about nor a failure to retry (ADR-0013).
 */
export type TaskCommandResult = { status: 'ok' } | { status: 'savedRemotely' }

/** A new task, and optionally where in the hierarchy it goes. */
export type NewTask = TaskEditorValues & { parentTaskId?: Id<'tasks'> }

export interface TaskCommands {
  add: (values: NewTask) => Promise<TaskCommandResult>
  update: (
    taskId: Id<'tasks'>,
    values: TaskEditorValues,
  ) => Promise<TaskCommandResult>
  setDone: (taskId: Id<'tasks'>, done: boolean) => Promise<TaskCommandResult>
  remove: (taskId: Id<'tasks'>) => Promise<TaskCommandResult>
  move: (
    taskId: Id<'tasks'>,
    direction: 'up' | 'down',
  ) => Promise<TaskCommandResult>
  /** Move a task under another, or with `null`, back to the top level. */
  reparent: (
    taskId: Id<'tasks'>,
    parentTaskId: Id<'tasks'> | null,
  ) => Promise<TaskCommandResult>
}

const OK: TaskCommandResult = { status: 'ok' }

/**
 * The things a Member can do to a task, wired to whichever Backend the list
 * has.
 *
 * This is the only place in the Tasks Module that knows a list can be backed by
 * something other than this app. The card above it decides *whether* to offer a
 * control from the Backend's capability list (ADR-0014) and calls it the same
 * way either way — which is what lets one card render a local list and a
 * Todoist one without a provider anywhere in it.
 *
 * Local writes are mutations: they are this database, and a transaction is both
 * available and correct. External writes are actions, and go to the provider
 * before they touch anything here.
 */
export function useTaskCommands(
  listId: Id<'taskLists'>,
  groupSlug: string,
  isLocal: boolean,
): TaskCommands {
  const addTask = useMutation(api.tasks.add)
  const updateTask = useMutation(api.tasks.update)
  const toggleDoneTask = useMutation(api.tasks.toggleDone)
  const removeTask = useMutation(api.tasks.remove)
  const moveTask = useMutation(api.tasks.move)
  const reparentTask = useMutation(api.tasks.reparent)

  const createExternal = useAction(api.externalTasks.create)
  const updateExternal = useAction(api.externalTasks.update)
  const setDoneExternal = useAction(api.externalTasks.setDone)
  const removeExternal = useAction(api.externalTasks.remove)
  const moveExternal = useAction(api.externalTasks.move)

  if (isLocal) {
    return {
      add: async (values) => {
        await addTask({ listId, groupSlug, ...values })
        return OK
      },
      update: async (taskId, values) => {
        await updateTask({
          taskId,
          groupSlug,
          title: values.title,
          // null clears; undefined would mean "leave as it was", and an editor
          // that cleared a field would silently not clear it.
          dueDate: values.dueDate ?? null,
          priority: values.priority ?? null,
          labels: values.labels ?? null,
        })
        return OK
      },
      setDone: async (taskId) => {
        // The local mutation toggles rather than sets, which is the same thing
        // from a checkbox and one fewer round trip's worth of state to carry.
        await toggleDoneTask({ taskId, groupSlug })
        return OK
      },
      remove: async (taskId) => {
        await removeTask({ taskId, groupSlug })
        return OK
      },
      move: async (taskId, direction) => {
        await moveTask({ taskId, groupSlug, direction })
        return OK
      },
      reparent: async (taskId, parentTaskId) => {
        await reparentTask({ taskId, groupSlug, parentTaskId })
        return OK
      },
    }
  }

  return {
    add: (values) =>
      createExternal({
        listId,
        groupSlug,
        title: values.title,
        dueDate: values.dueDate,
        priority: values.priority,
        labels: values.labels,
        parentTaskId: values.parentTaskId,
      }),
    update: (taskId, values) =>
      updateExternal({
        taskId,
        groupSlug,
        title: values.title,
        dueDate: values.dueDate ?? null,
        priority: values.priority ?? null,
        labels: values.labels ?? null,
      }),
    setDone: (taskId, done) => setDoneExternal({ taskId, groupSlug, done }),
    remove: (taskId) => removeExternal({ taskId, groupSlug }),
    // Reordering is never offered on a Backend that owns its own order, so
    // this is unreachable rather than unimplemented — the capability list says
    // so before the control is drawn.
    move: async () => OK,
    reparent: (taskId, parentTaskId) =>
      moveExternal({ taskId, groupSlug, parentTaskId }),
  }
}
