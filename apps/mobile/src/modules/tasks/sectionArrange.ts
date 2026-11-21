/**
 * Reorder mode across sections (APP-357), as plain arithmetic.
 *
 * A list with sections is rearranged as one column: each section's heading is
 * a fixed row, and the tasks under a heading are in that section. Dragging a
 * task past a heading moves it into the section below the heading. "No
 * section" always has its heading first, so a task can be dragged out of
 * every section, and nothing may land above it.
 */
import type { TaskSection } from '@gather/core/task-lists'

/** A heading's key in the arrangement. Convex ids never start with `§`. */
const HEADING = '§'

export function headingKey(sectionId: string | null): string {
  return `${HEADING}${sectionId ?? ''}`
}

/** The section a heading key stands for, or `undefined` for a task id. */
export function headingSection(key: string): string | null | undefined {
  if (!key.startsWith(HEADING)) return undefined
  return key.slice(HEADING.length) || null
}

/**
 * The arrangement Reorder mode opens with: without sections, the task ids as
 * they are; with them, "No section" and its tasks first, then each section's
 * heading and tasks in the list's section order.
 */
export function arrangementOf(
  sections: readonly TaskSection[],
  tasks: readonly { id: string; sectionId?: string }[],
): string[] {
  if (sections.length === 0) return tasks.map((task) => task.id)
  const known = new Set(sections.map((section) => section.id))
  const sectionOf = (task: { sectionId?: string }) =>
    task.sectionId && known.has(task.sectionId) ? task.sectionId : null
  return [null, ...sections.map((section) => section.id)].flatMap(
    (sectionId) => [
      headingKey(sectionId),
      ...tasks
        .filter((task) => sectionOf(task) === sectionId)
        .map((task) => task.id),
    ],
  )
}

/** The first index a task may be dropped at: below the first heading. */
export function firstDropIndex(arrangement: readonly string[]): number {
  return arrangement.length > 0 && headingSection(arrangement[0]) !== undefined
    ? 1
    : 0
}

/**
 * What a drop commits: the task ids in order and, when the list has
 * sections, each one's section from the nearest heading above it.
 */
export function committed(arrangement: readonly string[]): {
  ids: string[]
  sectionIds?: (string | null)[]
} {
  const ids: string[] = []
  const sectionIds: (string | null)[] = []
  let current: string | null = null
  let sectioned = false
  for (const key of arrangement) {
    const heading = headingSection(key)
    if (heading !== undefined) {
      sectioned = true
      current = heading
      continue
    }
    ids.push(key)
    sectionIds.push(current)
  }
  return sectioned ? { ids, sectionIds } : { ids }
}

/**
 * Where a drop took the dragged row: its section after the drop, or
 * `undefined` when it stayed under the same heading. Read from the drop
 * alone, never from the tasks as they are now, so a row whose section changed
 * elsewhere while the mode was open is not written back (APP-522).
 */
export function sectionMove(
  before: readonly string[],
  after: readonly string[],
  id: string,
): string | null | undefined {
  const sectionAt = (arrangement: readonly string[]) => {
    let current: string | null = null
    for (const key of arrangement) {
      if (key === id) return current
      const heading = headingSection(key)
      if (heading !== undefined) current = heading
    }
    return current
  }
  const from = sectionAt(before)
  const to = sectionAt(after)
  return from === to ? undefined : to
}
