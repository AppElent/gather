import type { TaskProviderId } from '@gather/core/domain'
import type { GroceryAisle, GroceryUnit } from '@gather/core/groceries'
import type {
  TaskListColor,
  TaskListIcon,
  TaskListKind,
} from '@gather/core/task-lists'

export type Priority = 1 | 2 | 3 | 4

export interface ListDisplay {
  due: boolean
  priority: boolean
  labels: boolean
}

/**
 * Where a list's tasks stand. A local list is `live` once Convex has answered;
 * a linked one is `synced` after its provider answered, and `reconnect` or
 * `failed` when it did not, with the last rows still shown (ADR-0021).
 */
export type ListSync = 'live' | 'loading' | 'synced' | 'reconnect' | 'failed'

export interface TaskList {
  id: string
  name: string
  provider: TaskProviderId
  writable: boolean
  display: ListDisplay
  order: number
  sync: ListSync
  /** What kind of list it is; `plain` for any list made before kinds. */
  kind: TaskListKind
  /** The tile it wears: its own choice, or its kind's (`taskListFace`). */
  icon: TaskListIcon
  color: TaskListColor
  /**
   * Whether its items are groceries, with an amount and an aisle (APP-309):
   * the Group's grocery list, or any list made as one. False from a server
   * older than amounts.
   */
  grocery: boolean
}

export interface Task {
  id: string
  listId: string
  title: string
  done: boolean
  dueDate?: string
  priority?: Priority
  labels: string[]
  notes?: string
  /** A wishlist item's link and price, in cents. */
  url?: string
  priceCents?: number
  /** A grocery item's amount, unit and aisle (APP-309, APP-353). */
  quantity?: number
  unit?: GroceryUnit
  category?: GroceryAisle
  /** The Member responsible (APP-302); absent is nobody. */
  assigneeId?: string
  /** Set while the assignee has not opened a task someone else gave them. */
  assignmentNotice?: { by: string; at: number }
  order: number
}

export const SUGGESTED_LABELS = ['house', 'admin', 'car', 'inbox', 'errand']
