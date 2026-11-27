export { quickAddChipLabel } from '@gather/core/task-quick-add-line'

/**
 * Which lists the Add tab's "Add a task" can write to, and which one it is
 * aimed at.
 *
 * Only a local list has `tasks` rows. A linked list is written to from its own
 * screen, in its provider (ADR-0021, APP-448), so it is never offered here.
 */
interface QuickAddList {
  _id: string
  order: number
  writable: boolean
}

/** The writable lists, in the order the Tasks screen draws them. */
export function quickAddLists<T extends QuickAddList>(lists: readonly T[]): T[] {
  return lists
    .filter((list) => list.writable)
    .sort((a, b) => a.order - b.order)
}

/**
 * The list a quick add lands on: the one the person picked while it is still
 * offered, otherwise the first. A pick can go stale — the list deleted, or
 * linked to a provider — while the sheet is open.
 */
export function quickAddTarget<T extends QuickAddList>(
  lists: readonly T[],
  pickedId: string | null,
): T | undefined {
  return lists.find((list) => list._id === pickedId) ?? lists[0]
}
