/**
 * The smart lists on the Tasks index (APP-301): views across every list of a
 * Group that answer "what do I have to do". They are rules over open tasks,
 * not stored lists, so the server (`tasks.smartLists`), the phone and later the
 * web (APP-308) read them from this one place.
 *
 * - **Today**: due today or before. Overdue counts as today, so one answer is
 *   not split over two lists.
 * - **Mine**: assigned to the person asking.
 * - **Upcoming**: due in the next seven days, today included, with what is
 *   overdue above them.
 * - **Unassigned**: nobody's, on a list of things a Member picks up. A grocery
 *   list, a packing list and a wishlist hold items rather than jobs, so their
 *   rows would only bury the jobs nobody has taken.
 *
 * No display strings live here: titles and day headings are in the message
 * trees under `tasks.smart`.
 */
import { addDays, compareIsoDates } from './civilDate'
import type { TaskListKind } from './taskLists'

export const SMART_LISTS = ['today', 'mine', 'upcoming', 'unassigned'] as const
export type SmartListId = (typeof SMART_LISTS)[number]

/** How many days Upcoming looks ahead, today included. */
export const UPCOMING_DAYS = 7

export function isSmartListId(value: unknown): value is SmartListId {
  return (SMART_LISTS as readonly unknown[]).includes(value)
}

/**
 * The smart lists a device hides from its Tasks index, as it stored them: a
 * JSON array of ids, dropping anything this build does not know. Unreadable is
 * "nothing hidden", which is what a fresh device shows.
 */
export function parseHiddenSmartLists(raw: string | null): SmartListId[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isSmartListId) : []
  } catch {
    return []
  }
}

/** The ids with `id` hidden if it was shown, and shown if it was hidden. */
export function toggledSmartLists(
  current: readonly SmartListId[],
  id: SmartListId,
): SmartListId[] {
  return current.includes(id)
    ? current.filter((each) => each !== id)
    : [...current, id]
}

/** What a rule reads of a task. */
export interface SmartTask {
  done: boolean
  /** ISO date, YYYY-MM-DD. */
  dueDate?: string
  assigneeId?: string
  /** Someone has it who is no Member (a linked task). */
  assigneeName?: string
}

/** Who is asking, on which day, and whether the task's list holds jobs. */
export interface SmartScope {
  /** The asker's local day, YYYY-MM-DD. */
  today: string
  /** The asker's user id; null while unknown, which matches nothing in Mine. */
  me: string | null
}

/** What a rule reads of the task's list. */
export interface SmartListOf {
  kind: TaskListKind
  /** The Group's grocery list, or any list made as one. */
  grocery: boolean
}

/** Whether a list's open rows are jobs somebody could pick up. */
export function holdsJobs(list: SmartListOf): boolean {
  return !list.grocery && (list.kind === 'plain' || list.kind === 'chores')
}

/** The last day Upcoming shows. */
export function upcomingUntil(today: string): string {
  return addDays(today, UPCOMING_DAYS - 1)
}

/** Whether a task belongs on one smart list. */
export function inSmartList(
  id: SmartListId,
  task: SmartTask,
  list: SmartListOf,
  scope: SmartScope,
): boolean {
  if (task.done) return false
  switch (id) {
    case 'today':
      return (
        task.dueDate !== undefined &&
        compareIsoDates(task.dueDate, scope.today) <= 0
      )
    case 'upcoming':
      return (
        task.dueDate !== undefined &&
        compareIsoDates(task.dueDate, upcomingUntil(scope.today)) <= 0
      )
    case 'mine':
      return scope.me !== null && task.assigneeId === scope.me
    case 'unassigned':
      return (
        !task.assigneeId && task.assigneeName === undefined && holdsJobs(list)
      )
  }
}

/** Whether a task belongs on any smart list: what the server sends. */
export function inAnySmartList(
  task: SmartTask,
  list: SmartListOf,
  scope: SmartScope,
): boolean {
  return SMART_LISTS.some((id) => inSmartList(id, task, list, scope))
}

/**
 * Sorted for a smart list: by due date, undated last, then by title so the
 * order does not shuffle between lists that share a date.
 */
export function bySmartOrder<T extends { dueDate?: string; title: string }>(
  a: T,
  b: T,
): number {
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === undefined) return 1
    if (b.dueDate === undefined) return -1
    return compareIsoDates(a.dueDate, b.dueDate)
  }
  return a.title.localeCompare(b.title)
}

/** One day of Upcoming: `overdue` gathers every day before today. */
export interface UpcomingDay<T> {
  key: 'overdue' | string
  /** The day, or null for the overdue group. */
  date: string | null
  tasks: T[]
}

/**
 * Upcoming in days: overdue first, then each day from today that has tasks.
 * Days without tasks are left out.
 */
export function upcomingDays<T extends { dueDate?: string; title: string }>(
  tasks: readonly T[],
  today: string,
): UpcomingDay<T>[] {
  const until = upcomingUntil(today)
  const overdue: T[] = []
  const days = new Map<string, T[]>()
  for (const task of [...tasks].sort(bySmartOrder)) {
    const due = task.dueDate
    if (due === undefined || compareIsoDates(due, until) > 0) continue
    if (compareIsoDates(due, today) < 0) {
      overdue.push(task)
      continue
    }
    const day = days.get(due)
    if (day) day.push(task)
    else days.set(due, [task])
  }
  return [
    ...(overdue.length > 0
      ? [{ key: 'overdue', date: null, tasks: overdue }]
      : []),
    ...[...days].map(([date, dayTasks]) => ({
      key: date,
      date,
      tasks: dayTasks,
    })),
  ]
}
