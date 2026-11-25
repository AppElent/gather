import { useQuery } from 'convex/react'
import { useRef } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

export type GroceryItemState =
  | { status: 'loading' }
  /** `deleted`: it was here a moment ago; otherwise the address is wrong. */
  | { status: 'missing'; deleted: boolean }
  | { status: 'ready'; task: Doc<'tasks'> }

/**
 * One grocery item wherever it is now: on the list the page shows, or on
 * another one another Member moved it to. An item off the Group's grocery
 * lists is not Groceries' to show.
 */
export function useGroceryItem(
  groupSlug: string,
  itemId: string | undefined,
  groceryLists: readonly { _id: Id<'taskLists'> }[] | undefined,
): GroceryItemState {
  const listId = useQuery(
    api.tasks.listOf,
    itemId ? { groupSlug, taskId: itemId } : 'skip',
  )
  const onGroceries = groceryLists?.find((list) => list._id === listId)
  const tasks = useQuery(
    api.tasks.listByList,
    onGroceries ? { groupSlug, listId: onGroceries._id } : 'skip',
  )
  const seen = useRef<string | undefined>(undefined)

  if (!itemId) return { status: 'missing', deleted: false }
  if (listId === undefined || groceryLists === undefined)
    return { status: 'loading' }
  const missing = {
    status: 'missing',
    deleted: seen.current === itemId,
  } as const
  if (!onGroceries) return missing
  if (tasks === undefined) return { status: 'loading' }
  const task = tasks.find((each) => each._id === itemId)
  if (!task) return missing
  seen.current = itemId
  return { status: 'ready', task }
}
