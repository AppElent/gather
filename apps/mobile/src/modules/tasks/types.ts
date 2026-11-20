import type { TaskProviderId } from '@gather/core/domain'
import type { GroceryAisle, GroceryUnit } from '@gather/core/groceries'
import type {
  TaskListColor,
  TaskListIcon,
  TaskListKind,
  TaskSection,
} from '@gather/core/task-lists'
import type { TaskRepeat } from '@gather/core/task-repeat'

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
  /**
   * When a Member last chose "Clear checked" (APP-310): items checked before
   * it are only in Recent. Null until the first clear, and from an older
   * server.
   */
  checkedClearedAt: number | null
  /**
   * A grocery list's own aisle order (APP-313), read through `aisleOrder`.
   * Null is the default walking order, and what an older server sends.
   */
  aisleOrder: readonly GroceryAisle[] | null
  /**
   * Whether a Member switched its "Maybe needed" suggestions off (APP-311).
   * False from an older server.
   */
  suggestionsOff: boolean
  /**
   * Its sections in order (APP-357). Empty for a list without any, for a
   * linked list, and from a server older than sections.
   */
  sections: TaskSection[]
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
  /** How it comes back once done (APP-303); a Gather list's own. */
  repeat?: TaskRepeat
  /** A linked list's own words for its repeat, such as Todoist's "every week". */
  repeatText?: string
  /** When it was checked (APP-310); absent when open or checked before. */
  doneAt?: number
  /** The Member responsible (APP-302); absent is nobody. */
  assigneeId?: string
  /** Set while the assignee has not opened a task someone else gave them. */
  assignmentNotice?: { by: string; at: number }
  /**
   * The reminder somebody chose (APP-305): a wall clock in the zone it was
   * set in, and the Member it goes to. Only Gather's own lists have one.
   */
  reminder?: TaskReminder
  /** The section it sits in; none, or one that is gone, is "No section". */
  sectionId?: string
  order: number
}

export interface TaskReminder {
  date: string
  time: string
  timeZone: string
  userId: string
}

export const SUGGESTED_LABELS = ['house', 'admin', 'car', 'inbox', 'errand']
