/**
 * Where a task opens, as addresses (APP-308). From `lg` (1024 px) a task opens
 * in the panel of the list it is on, named in `?task=`; below it a task is a
 * page of its own. Reload, Back and a shared link keep what was open.
 */
import type { SmartListId } from '@gather/core/smart-lists'
import { type AppLink, linkTo } from '../../lib/links'

export interface TaskSearch {
  task?: string
}

export function validateTaskSearch(search: Record<string, unknown>): TaskSearch {
  return typeof search.task === 'string' && search.task
    ? { task: search.task }
    : {}
}

/** The page a task is opened from. */
export type TaskPlace =
  | { kind: 'index' }
  | { kind: 'list'; listId: string }
  | { kind: 'smart'; smartList: SmartListId }
  /** A task's own page, which has no panel. */
  | { kind: 'task' }

interface TaskTarget {
  id: string
  listId: string
  /** On a grocery list: its items open in Groceries. */
  grocery?: boolean
}

/** The page itself, with nothing open. */
export function placeLink(place: TaskPlace): AppLink {
  switch (place.kind) {
    case 'list':
      return linkTo('taskList', { listId: place.listId })
    case 'smart':
      return linkTo('smartTaskList', { smartList: place.smartList })
    default:
      return linkTo('tasks')
  }
}

/** Where a row goes when its task is opened from `place`. */
export function taskLink(
  place: TaskPlace,
  task: TaskTarget,
  desktop: boolean,
): AppLink {
  if (task.grocery) {
    return desktop
      ? {
          ...linkTo('groceries'),
          search: { list: task.listId, item: task.id },
        }
      : linkTo('groceriesItem', { itemId: task.id })
  }
  if (!desktop || place.kind === 'task') {
    return linkTo('task', { taskId: task.id })
  }
  // The index has no panel: its rows open on their own list.
  const page =
    place.kind === 'index'
      ? linkTo('taskList', { listId: task.listId })
      : placeLink(place)
  return { ...page, search: { task: task.id } }
}

/** A grocery list's page is Groceries, not Tasks. */
export function listLink(list: { id: string; grocery: boolean }): AppLink {
  return list.grocery
    ? { ...linkTo('groceries'), search: { list: list.id } }
    : linkTo('taskList', { listId: list.id })
}
