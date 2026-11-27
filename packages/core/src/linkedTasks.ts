/**
 * What an accepted write leaves of a linked list's rows (ADR-0020, APP-448).
 *
 * A linked list's tasks live in its provider; the phone and the web hold only
 * its last answer. A write goes to the provider first, and these rules change
 * the held rows once it was accepted, so nothing shows that the provider does
 * not have. Pure, so both apps and their tests read the same rules.
 */

export interface LinkedRow {
  externalId: string
  done: boolean
  parentExternalId?: string
}

/** The write, as much of it as decides which rows change. */
export type LinkedWriteShape =
  | { kind: 'create' }
  | { kind: 'update'; taskId: string }
  | { kind: 'setDone'; taskId: string; done: boolean }
  | { kind: 'move'; taskId: string }
  | { kind: 'moveToList'; taskId: string }

/** Whether a row is the task itself or anywhere under it. */
function isWithin(
  row: LinkedRow,
  taskId: string,
  byId: ReadonlyMap<string, LinkedRow>,
): boolean {
  const seen = new Set<string>()
  let at: LinkedRow | undefined = row
  while (at && !seen.has(at.externalId)) {
    if (at.externalId === taskId) return true
    seen.add(at.externalId)
    at = at.parentExternalId ? byId.get(at.parentExternalId) : undefined
  }
  return false
}

/**
 * `rows` after the provider accepted `write` and answered with `answered`, the
 * tasks it changed as it has them now.
 */
export function applyLinkedWrite<T extends LinkedRow>(
  rows: readonly T[],
  write: LinkedWriteShape,
  answered: readonly T[],
): T[] {
  const byId = new Map<string, LinkedRow>(rows.map((row) => [row.externalId, row]))
  if (write.kind === 'moveToList') {
    // Gone to another list, its subtasks with it.
    return rows.filter((row) => !isWithin(row, write.taskId, byId))
  }
  const answers = new Map(answered.map((row) => [row.externalId, row]))
  let next = rows.map((row) => answers.get(row.externalId) ?? row)
  if (write.kind === 'setDone' && write.done && !answers.has(write.taskId)) {
    // Closed for good, subtasks included. A recurring task is answered open,
    // on its next date.
    next = next.map((row) =>
      isWithin(row, write.taskId, byId) ? { ...row, done: true } : row,
    )
  }
  if (write.kind === 'setDone' && !write.done) {
    // Reopening a subtask reopens the tasks above it.
    const open = new Set([write.taskId])
    let at = byId.get(write.taskId)
    while (at?.parentExternalId && !open.has(at.parentExternalId)) {
      open.add(at.parentExternalId)
      at = byId.get(at.parentExternalId)
    }
    next = next.map((row) =>
      open.has(row.externalId) && row.done ? { ...row, done: false } : row,
    )
  }
  const known = new Set(next.map((row) => row.externalId))
  const added = answered.filter((row) => !known.has(row.externalId))
  return write.kind === 'create' ? [...next, ...added] : next
}

/**
 * The tasks a linked task can be moved under: open, at the top of the list and
 * not itself, as Gather draws subtasks one level deep. None for a task that
 * has subtasks of its own.
 */
export function possibleParents<T extends LinkedRow>(
  rows: readonly T[],
  taskId: string,
): T[] {
  const task = rows.find((row) => row.externalId === taskId)
  if (!task || task.done) return []
  if (rows.some((row) => row.parentExternalId === taskId)) return []
  return rows.filter(
    (row) =>
      !row.done &&
      !row.parentExternalId &&
      row.externalId !== taskId,
  )
}

interface MoveTargetList {
  _id: string
  provider: string
  order: number
  writable: boolean
  grocery?: boolean
  capabilities?: { write: boolean }
  connectionId?: string | null
}

/**
 * Where a task on `from` can go (APP-821): a local task to local lists, a
 * linked one to the lists of its own connection that can be written to. The
 * server holds the connection to the same rule. Every other list is `other`,
 * for the reason that a task stays in its source.
 */
export function moveTargets<T extends MoveTargetList>(
  from: MoveTargetList,
  lists: readonly T[],
): { own: T[]; other: T[] } {
  const own: T[] = []
  const other: T[] = []
  for (const list of [...lists].sort((a, b) => a.order - b.order)) {
    const reachable =
      from.provider === 'local'
        ? list.provider === 'local' && list.writable
        : list.provider === from.provider &&
          Boolean(from.connectionId) &&
          list.connectionId === from.connectionId &&
          Boolean(list.capabilities?.write) &&
          !list.grocery
    if (reachable || list._id === from._id) own.push(list)
    else other.push(list)
  }
  return { own, other }
}
