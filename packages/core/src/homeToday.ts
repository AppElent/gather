/**
 * What Home's "Today" shows on both clients (the phone's Home, the web's
 * Start), decided without React (Tiles & Today, Step 0 inventory): which tasks are overdue or due today, which of today's baby log
 * entries go on the rail, and how the date and times read.
 *
 * Pure, and messages arrive as parameters (ADR-0011's third rule), so a test
 * can hold every rule at a fixed instant. Nothing here reads the clock.
 *
 * Only what has data is built. Tasks carry a date and no time, so they are
 * never on the rail; baby log entries are the only timed items, and all of
 * them are in the past, so the rail has no upcoming section.
 */
import { summarizeBabyEvent } from './babyEvents'
import type { BabyEventType } from './domain'
import { fmt } from './i18n'
import type { Messages } from './messages'

type BabyLogMessages = Parameters<typeof summarizeBabyEvent>[1]
type TodayWords = Messages['shell']['today']

interface DatedTask {
  done: boolean
  dueDate?: string
}

/** Open tasks whose due date has gone by. */
export function overdueTasks<T extends DatedTask>(
  tasks: readonly T[],
  today: string,
): T[] {
  return tasks.filter(
    (task) => !task.done && task.dueDate !== undefined && task.dueDate < today,
  )
}

/** Open tasks due today: the "Anytime today" list. */
export function dueTodayTasks<T extends DatedTask>(
  tasks: readonly T[],
  today: string,
): T[] {
  return tasks.filter((task) => !task.done && task.dueDate === today)
}

/**
 * The list the Now card opens: the one list every overdue task is on, or
 * `null` when they are spread over several, which opens Tasks itself (its
 * Today strip lists them all).
 */
export function overdueListId(
  overdue: readonly { listId: string }[],
): string | null {
  const ids = new Set(overdue.map((task) => task.listId))
  return ids.size === 1 ? (overdue[0]?.listId ?? null) : null
}

/** How many lists the overdue tasks are on. */
export function overdueListCount(overdue: readonly { listId: string }[]) {
  return new Set(overdue.map((task) => task.listId)).size
}

export interface LoggedEntry {
  _id: string
  type: BabyEventType
  timestamp: number
  endTimestamp?: number
  data: unknown
}

export interface RailEntry {
  id: string
  type: BabyEventType
  timestamp: number
  /** "Bottle · 120 ml · Sanne": the summary, then the child. */
  line: string
}

/**
 * Today's baby log entries for every child, oldest first: the rail's past
 * items. An entry logged for later today (a time typed ahead) is left out,
 * because the rail draws only the past before the Now capsule.
 *
 * `events` holds what each child's subscription answered, keyed by child id;
 * a child still loading, or whose query failed, contributes nothing.
 */
export function railEntries(
  children: readonly { _id: string; name: string }[],
  events: Readonly<Record<string, unknown>>,
  {
    dayStart,
    now,
    babyLog,
    words,
  }: {
    dayStart: number
    now: number
    babyLog: BabyLogMessages
    words: TodayWords
  },
): RailEntry[] {
  const entries: RailEntry[] = []
  for (const child of children) {
    const rows = events[child._id]
    if (!Array.isArray(rows)) continue
    for (const row of rows as LoggedEntry[]) {
      if (row.timestamp < dayStart || row.timestamp > now) continue
      entries.push({
        id: row._id,
        type: row.type,
        timestamp: row.timestamp,
        line: fmt(words.entry, {
          summary: summarizeBabyEvent(row, babyLog),
          child: child.name,
        }),
      })
    }
  }
  return entries.sort((a, b) => a.timestamp - b.timestamp)
}

/** Midnight local time on the day `now` falls in. */
export function startOfDay(now: number): number {
  const date = new Date(now)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** `HH:MM` on the 24-hour clock, in local time. */
export function clockTime(ms: number): string {
  const date = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * The date spelled out, "Monday 16 November", in the app's language and in
 * sentence case: Dutch writes its weekdays in lower case, and this starts a
 * line.
 */
export function spelledDate(
  now: number,
  locale: string,
  template: string,
): string {
  const date = new Date(now)
  const text = fmt(template, {
    weekday: date.toLocaleDateString(locale, { weekday: 'long' }),
    day: date.getDate(),
    month: date.toLocaleDateString(locale, { month: 'long' }),
  })
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1)
}
