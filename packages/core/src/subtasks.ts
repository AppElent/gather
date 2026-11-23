/**
 * Subtasks, one level deep (APP-304).
 *
 * A subtask is a whole task — its own check, assignee and due date — that names
 * the task it belongs to in `parentTaskId`. It sits on its parent's list. A
 * subtask has no subtasks of its own, and does not repeat on its own: when its
 * parent repeats, its subtasks reopen with the next occurrence.
 *
 * Inside a list, a subtask is drawn under its parent only, never as a row of
 * its own; the parent shows how far along they are ("1 of 3"). A smart list,
 * which is about one person's or one day's tasks, shows a subtask that belongs
 * there as a row of its own, with its parent named.
 *
 * Pure, so the server, the phone and their tests read the same rules.
 */

/** The fields these rules read; a Convex row and the phone's `Task` both fit. */
export interface SubtaskShape {
  id: string
  done: boolean
  order: number
  parentTaskId?: string
}

export interface SubtaskProgress {
  done: number
  total: number
}

/** How far along each parent's subtasks are, keyed by the parent's id. */
export function subtaskProgress<T extends SubtaskShape>(
  tasks: readonly T[],
): Map<string, SubtaskProgress> {
  const out = new Map<string, SubtaskProgress>()
  for (const task of tasks) {
    if (!task.parentTaskId) continue
    const progress = out.get(task.parentTaskId) ?? { done: 0, total: 0 }
    progress.total += 1
    if (task.done) progress.done += 1
    out.set(task.parentTaskId, progress)
  }
  return out
}

/**
 * The rows a list draws: every task without a parent, and a subtask only when
 * its parent is not among `tasks` (it was moved or deleted under an app that
 * knew nothing of subtasks), so nothing goes missing.
 */
export function topLevelTasks<T extends SubtaskShape>(tasks: readonly T[]): T[] {
  const ids = new Set(tasks.map((task) => task.id))
  return tasks.filter(
    (task) => !task.parentTaskId || !ids.has(task.parentTaskId),
  )
}

/** One parent's subtasks in their order. */
export function subtasksOf<T extends SubtaskShape>(
  tasks: readonly T[],
  parentId: string,
): T[] {
  return tasks
    .filter((task) => task.parentTaskId === parentId)
    .sort((a, b) => a.order - b.order)
}

/**
 * Whether completing this task asks "Complete all" or "Only this": it is open,
 * it has open subtasks, and it does not repeat. A repeating task's subtasks
 * reopen with the next occurrence whichever is chosen, so there is nothing to
 * ask.
 */
export function asksAboutSubtasks(
  task: { done: boolean; repeat?: unknown },
  progress: SubtaskProgress | undefined,
): boolean {
  return (
    !task.done &&
    task.repeat === undefined &&
    progress !== undefined &&
    progress.done < progress.total
  )
}

/**
 * A list's new order as `tasks.reorder` takes it, which wants every open task
 * of the list (or, for a packing list, every task) exactly once, subtasks
 * included. `ids` are the rows the person arranged, top-level only, with
 * `sectionIds` beside them when the list has sections. Each parent's subtasks
 * go right behind it, in its section; subtasks of a parent that is not among
 * `ids` (a checked parent with open steps) keep their place at the end, in
 * their own section. `includeDone` takes checked subtasks along too.
 */
export function reorderWithSubtasks<T extends SubtaskShape & { sectionId?: string }>(
  ids: readonly string[],
  sectionIds: readonly (string | null)[] | undefined,
  tasks: readonly T[],
  includeDone: boolean,
): { ids: string[]; sectionIds: (string | null)[] | undefined } {
  const outIds: string[] = []
  const outSections: (string | null)[] = []
  const placed = new Set(ids)
  ids.forEach((id, index) => {
    const section = sectionIds?.[index] ?? null
    outIds.push(id)
    outSections.push(section)
    for (const child of subtasksOf(tasks, id)) {
      if (!includeDone && child.done) continue
      outIds.push(child.id)
      outSections.push(section)
      placed.add(child.id)
    }
  })
  const rest = tasks
    .filter(
      (task) =>
        task.parentTaskId !== undefined &&
        !placed.has(task.id) &&
        (includeDone || !task.done),
    )
    .sort((a, b) => a.order - b.order)
  for (const task of rest) {
    outIds.push(task.id)
    outSections.push(task.sectionId ?? null)
  }
  return { ids: outIds, sectionIds: sectionIds ? outSections : undefined }
}

/**
 * New `order` values for one parent's subtasks in the order `ids` gives them:
 * the same set of values they hold now, handed out again, so nothing else on
 * the list moves. Null when `ids` is not exactly those subtasks once each.
 */
export function reorderedSubtasks<T extends SubtaskShape>(
  siblings: readonly T[],
  ids: readonly string[],
): { id: string; order: number }[] | null {
  const known = new Set(siblings.map((task) => task.id))
  if (
    ids.length !== siblings.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !known.has(id))
  ) {
    return null
  }
  const orders = siblings.map((task) => task.order).sort((a, b) => a - b)
  // Two subtasks with one order value (written by two clients at once) would
  // tie again; spread them past the largest instead.
  for (let i = 1; i < orders.length; i++) {
    if (orders[i] <= orders[i - 1]) orders[i] = orders[i - 1] + 1
  }
  return ids.map((id, index) => ({ id, order: orders[index] }))
}
