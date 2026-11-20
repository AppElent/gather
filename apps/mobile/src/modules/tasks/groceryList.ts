/**
 * How a grocery list is laid out (APP-310), kept apart from React so it can be
 * tested: open items in aisle sections in the default walking order, and
 * Recent in days, newest first.
 */
import { localIsoDate } from '@gather/core/civil-date'
import {
  GROCERY_AISLES,
  type GroceryAisle,
  groceryKey,
  isGroceryAisle,
  parseGroceryLine,
} from '@gather/core/groceries'

/** The aisle an item is shown under: its own, or Other when it has none. */
export function aisleOf(task: { category?: string }): GroceryAisle {
  return isGroceryAisle(task.category) ? task.category : 'other'
}

/**
 * Items in sections per aisle, in the default aisle order
 * (`designs/groceries/README.md`, "Aisles"), each keeping the order it was
 * given in. An aisle with nothing in it has no section.
 */
export function aisleSections<T extends { category?: string }>(
  tasks: readonly T[],
): { aisle: GroceryAisle; tasks: T[] }[] {
  const byAisle = new Map<GroceryAisle, T[]>()
  for (const task of tasks) {
    const aisle = aisleOf(task)
    const rows = byAisle.get(aisle)
    if (rows) rows.push(task)
    else byAisle.set(aisle, [task])
  }
  return GROCERY_AISLES.flatMap((aisle) => {
    const rows = byAisle.get(aisle)
    return rows ? [{ aisle, tasks: rows }] : []
  })
}

/**
 * Recent in days, newest first: each row under the local calendar day it was
 * checked. Rows arrive newest first and keep that order within a day.
 */
export function recentDays<T extends { doneAt: number }>(
  rows: readonly T[],
): { date: string; rows: T[] }[] {
  const days: { date: string; rows: T[] }[] = []
  for (const row of rows) {
    const date = localIsoDate(new Date(row.doneAt))
    const last = days.at(-1)
    if (last?.date === date) last.rows.push(row)
    else days.push({ date, rows: [row] })
  }
  return days
}

/** How many weeks back Recent reaches, at least one. */
export function recentWeeks(
  rows: readonly { doneAt: number }[],
  now: number,
): number {
  const oldest = rows.at(-1)?.doneAt ?? now
  const days = Math.max(0, now - oldest) / 86_400_000
  return Math.max(1, Math.ceil(days / 7))
}

/**
 * Whether a checked grocery item is still in its list's Checked section: it
 * was checked after the last "Clear checked" (APP-310). One checked before
 * stamps existed counts as checked at the start of time.
 */
export function inCheckedSection(
  task: { done: boolean; doneAt?: number },
  checkedClearedAt: number | null,
): boolean {
  if (!task.done) return false
  return checkedClearedAt === null || (task.doneAt ?? 0) > checkedClearedAt
}

/**
 * The Checked section's rows: one per name, the newest, and none whose name is
 * open on the list. A put-back from Recent adds a copy and keeps the checked
 * item as history (APP-311), so without this a name would show open and
 * checked at once, and "Put back all" would list it twice.
 */
export function checkedOncePerName<
  T extends { title: string; done: boolean; doneAt?: number },
>(tasks: readonly T[], checked: readonly T[]): T[] {
  const keyOf = (title: string) => groceryKey(parseGroceryLine(title).name)
  const open = new Set(
    tasks.filter((task) => !task.done).map((task) => keyOf(task.title)),
  )
  const newest = new Map<string, T>()
  for (const task of checked) {
    const key = keyOf(task.title)
    if (open.has(key)) continue
    const kept = newest.get(key)
    if (!kept || (task.doneAt ?? 0) > (kept.doneAt ?? 0)) newest.set(key, task)
  }
  const shown = new Set(newest.values())
  return checked.filter((task) => shown.has(task))
}
