import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { TaskEditorValues } from './TaskEditor'

export interface TaskCommands {
  add: (values: TaskEditorValues) => Promise<unknown>
  update: (taskId: Id<'tasks'>, values: TaskEditorValues) => Promise<unknown>
  toggleDone: (taskId: Id<'tasks'>) => Promise<unknown>
  remove: (taskId: Id<'tasks'>) => Promise<unknown>
  move: (taskId: Id<'tasks'>, direction: 'up' | 'down') => Promise<unknown>
}

/**
 * The five things a Member can do to a task, wired to whichever Backend the
 * list has.
 *
 * This is the only place in the Tasks Module that knows a list can be backed by
 * something other than this app. The card above it decides *whether* to offer a
 * control from the Backend's capability list (ADR-0014) and calls it the same
 * way either way — which is what lets one card render a local list and a
 * Todoist one without a provider anywhere in it.
 *
 * Local writes are mutations: they are this database, and a transaction is both
 * available and correct. An external Backend's writes go through actions,
 * provider-first, and are wired here as they land.
 */
export function useTaskCommands(
  listId: Id<'taskLists'>,
  groupSlug: string,
): TaskCommands {
  const addTask = useMutation(api.tasks.add)
  const updateTask = useMutation(api.tasks.update)
  const toggleDoneTask = useMutation(api.tasks.toggleDone)
  const removeTask = useMutation(api.tasks.remove)
  const moveTask = useMutation(api.tasks.move)

  return {
    add: (values) => addTask({ listId, groupSlug, ...values }),
    update: (taskId, values) =>
      updateTask({
        taskId,
        groupSlug,
        title: values.title,
        // null clears; undefined would mean "leave as it was", and an editor
        // that cleared a field would silently not clear it.
        dueDate: values.dueDate ?? null,
        priority: values.priority ?? null,
        labels: values.labels ?? null,
      }),
    toggleDone: (taskId) => toggleDoneTask({ taskId, groupSlug }),
    remove: (taskId) => removeTask({ taskId, groupSlug }),
    move: (taskId, direction) => moveTask({ taskId, groupSlug, direction }),
  }
}
