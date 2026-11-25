/**
 * A quick-add line as both apps read and show it (APP-307): which details a
 * list takes, the repeat's anchor, the chips' words, and the date and repeat
 * shortcuts beside them.
 */
import { addDays, daysBetween, localMidnight, mondayStart } from './civilDate'
import {
  parseQuickAdd,
  type QuickAdd,
  type QuickAddContext,
  type QuickAddKind,
  type QuickAddPart,
} from './taskQuickAdd'
import {
  describeRepeat,
  normalizeRepeat,
  type RepeatSummaryWords,
  type TaskRepeat,
} from './taskRepeat'

/** What a line can read for a linked list's task (APP-448). */
export const LINKED_KINDS: readonly QuickAddKind[] = ['date', 'label']

/** A line read for only these details: the rest of it stays the title. */
export function parseOnly(
  line: string,
  context: QuickAddContext,
  kinds: readonly QuickAddKind[] | undefined,
): QuickAdd {
  let dismissed = context.dismissed ?? []
  for (;;) {
    const parsed = parseQuickAdd(line, { ...context, dismissed })
    const left = kinds
      ? parsed.parts.filter((part) => !kinds.includes(part.kind))
      : []
    if (left.length === 0) return parsed
    dismissed = [...dismissed, ...left.map((part) => part.key)]
  }
}

/**
 * The repeat the line read, anchored on the task's own due date: a date
 * picked on the chip moves "every week" to that weekday and "every month" to
 * that day. What was typed stays as typed ("every Tuesday" is Tuesday).
 */
export function readRepeat(parsed: QuickAdd, dueDate: string | undefined) {
  const typed = parsed.parts.find((part) => part.kind === 'repeat')
  if (typed?.kind !== 'repeat' || !dueDate) return parsed.repeat
  return normalizeRepeat(typed.repeat, dueDate) ?? parsed.repeat
}

/** The date menu's shortcuts: today, tomorrow, the weekend, next Monday. */
export function dateShortcuts(today: string, weekend: string) {
  return {
    today,
    tomorrow: addDays(today, 1),
    weekend,
    nextWeek: mondayStart(addDays(today, 7)),
  }
}

/** The short repeats the Repeat menu offers before Custom…. */
export const QUICK_REPEATS = {
  day: { mode: 'fixed', unit: 'day', every: 1 },
  week: { mode: 'fixed', unit: 'week', every: 1 },
  month: { mode: 'fixed', unit: 'month', every: 1 },
} as const satisfies Record<string, TaskRepeat>

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
