import { daysBetween, localMidnight } from '@gather/core/civil-date'
import type { QuickAdd, QuickAddPart } from '@gather/core/task-quick-add'
import {
  describeRepeat,
  type RepeatSummaryWords,
} from '@gather/core/task-repeat'

/**
 * Which lists the Add tab's "Add a task" can write to, and which one it is
 * aimed at.
 *
 * Only a local list has `tasks` rows; a linked list is read from its provider
 * and Gather has no write path into it (ADR-0021), so it is never offered.
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

/**
 * A recognised part's chip in quick add (APP-307): "Tomorrow, Thu 19 Nov",
 * "09:00", "Every week, Thu", "Daan", "#garden".
 *
 * The repeat is read from the whole parse, where it carries the due date's
 * weekday or day of the month, so the chip says what will be saved.
 */
export function quickAddChipLabel(
  part: QuickAddPart,
  parsed: Pick<QuickAdd, 'repeat'>,
  today: string,
  locale: string,
  words: {
    today: string
    tomorrow: string
    repeat: RepeatSummaryWords
  },
): string {
  switch (part.kind) {
    case 'date': {
      const offset = daysBetween(today, part.date)
      const date = localMidnight(part.date).toLocaleDateString(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        ...(part.date.slice(0, 4) === today.slice(0, 4)
          ? {}
          : { year: 'numeric' }),
      })
      if (offset === 0) return `${words.today}, ${date}`
      if (offset === 1) return `${words.tomorrow}, ${date}`
      return date
    }
    case 'time':
      return part.time
    case 'repeat':
      return describeRepeat(parsed.repeat ?? part.repeat, words.repeat, locale)
    case 'member':
      return part.name
    case 'label':
      return `#${part.label}`
  }
}
