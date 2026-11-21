/**
 * How a grocery list is laid out (APP-310, APP-313), kept apart from React so
 * it can be tested: open items in aisle sections in the list's own aisle
 * order, Recent in days, newest first, and which of a Group's grocery lists
 * the Groceries Module opens.
 */
import { localIsoDate } from '@gather/core/civil-date'
import {
  aisleOrder,
  type GroceryAisle,
  groceryKey,
  isGroceryAisle,
  parseGroceryLine,
} from '@gather/core/groceries'
import { headingKey } from './sectionArrange'

/** The aisle an item is shown under: its own, or Other when it has none. */
export function aisleOf(task: { category?: string }): GroceryAisle {
  return isGroceryAisle(task.category) ? task.category : 'other'
}

/**
 * Items in sections per aisle, in the list's aisle order (APP-313; the
 * default walking order when it has none), each keeping the order it was
 * given in. An aisle with nothing in it has no section.
 */
export function aisleSections<T extends { category?: string }>(
  tasks: readonly T[],
  order?: readonly string[] | null,
): { aisle: GroceryAisle; tasks: T[] }[] {
  const byAisle = new Map<GroceryAisle, T[]>()
  for (const task of tasks) {
    const aisle = aisleOf(task)
    const rows = byAisle.get(aisle)
    if (rows) rows.push(task)
    else byAisle.set(aisle, [task])
  }
  return aisleOrder(order).flatMap((aisle) => {
    const rows = byAisle.get(aisle)
    return rows ? [{ aisle, tasks: rows }] : []
  })
}

/**
 * Reorder mode's column on a grocery list (APP-522): every aisle's heading in
 * the list's aisle order, each followed by its items in their order. An empty
 * aisle keeps its heading, so an item can be dragged into it; there is no
 * "No section", because an item without an aisle is under Other.
 */
export function aisleArrangement(
  tasks: readonly { id: string; category?: string }[],
  order?: readonly string[] | null,
): string[] {
  return aisleOrder(order).flatMap((aisle) => [
    headingKey(aisle),
    ...tasks.filter((task) => aisleOf(task) === aisle).map((task) => task.id),
  ])
}

/**
 * The items a drop put under another aisle, with the aisle each is under now
 * (APP-522). `aisles` is by position in `ids`, as Reorder mode commits it; an
 * item that stayed in its aisle, Other included, is not a change.
 */
export function aisleMoves(
  tasks: readonly { id: string; category?: string }[],
  ids: readonly string[],
  aisles: readonly (string | null)[] | undefined,
): { id: string; aisle: GroceryAisle }[] {
  if (!aisles) return []
  const byId = new Map(tasks.map((task) => [task.id, task]))
  return ids.flatMap((id, index) => {
    const task = byId.get(id)
    const aisle = aisles[index]
    if (!task || !isGroceryAisle(aisle) || aisleOf(task) === aisle) return []
    return [{ id, aisle }]
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

/** How many open items each aisle holds, for the Aisles screen. */
export function aisleCounts(
  tasks: readonly { category?: string; done: boolean }[],
): Partial<Record<GroceryAisle, number>> {
  const counts: Partial<Record<GroceryAisle, number>> = {}
  for (const task of tasks) {
    if (task.done) continue
    const aisle = aisleOf(task)
    counts[aisle] = (counts[aisle] ?? 0) + 1
  }
  return counts
}

interface GroceryListRow {
  _id: string
  order: number
  grocery?: boolean
  writable: boolean
}

/** A Group's grocery lists, one per store, in the order Tasks draws them. */
export function groceryListsOf<T extends GroceryListRow>(
  lists: readonly T[],
): T[] {
  return lists
    .filter((list) => list.grocery)
    .sort((a, b) => a.order - b.order)
}

/**
 * The grocery list the Groceries Module opens (APP-313): the one last used on
 * this phone while it is still a grocery list, otherwise the first. A
 * remembered list can be deleted, or made a list of another kind, elsewhere.
 */
export function openGroceryList<T extends GroceryListRow>(
  lists: readonly T[],
  remembered: string | null | undefined,
): T | undefined {
  return lists.find((list) => list._id === remembered) ?? lists[0]
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
