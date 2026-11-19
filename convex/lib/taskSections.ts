/**
 * Sections inside a task list (APP-357): "Clothes" and "Toiletries" on a
 * packing list, "Kitchen" and "Bathroom" on a chores list.
 *
 * A list's sections live on the list itself, as an ordered array, and a task
 * names its section by id. Both fields are optional, so every list and task
 * from before sections reads as it did, and an installed app that knows
 * nothing of sections still draws every task: it never reads `sectionId`.
 *
 * A task whose section is gone — deleted, or the task moved to another list —
 * sits under "No section". Deleting a section clears its tasks' `sectionId` in
 * the same transaction, so that case is only ever a passing one.
 */
import {
  TASK_SECTION_NAME_MAX,
  TASK_SECTIONS_MAX,
} from '@gather/core/task-lists'
import { ConvexError, v } from 'convex/values'
import type { Doc } from '../_generated/dataModel'

export const taskSectionValidator = v.object({
  id: v.string(),
  name: v.string(),
})

/** A section name as stored: trimmed, not empty, and bounded. */
export function checkedSectionName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > TASK_SECTION_NAME_MAX) {
    throw new ConvexError('A section needs a name')
  }
  return trimmed
}

/** Refuses a list that would have more sections than a list may. */
export function checkSectionCount(count: number) {
  if (count > TASK_SECTIONS_MAX) throw new ConvexError('Too many sections')
}

/** A new section id. Random, so a deleted section's id is never reused. */
export function newSectionId(): string {
  return crypto.randomUUID()
}

/**
 * The section a write may put a task in: one the list has, or none. An id the
 * list does not have (deleted while the phone was offline, say) reads as none,
 * which is where such a task would be drawn anyway.
 */
export function knownSectionId(
  list: Pick<Doc<'taskLists'>, 'sections'>,
  sectionId: string | null | undefined,
): string | undefined {
  if (!sectionId) return undefined
  return list.sections?.some((section) => section.id === sectionId)
    ? sectionId
    : undefined
}
