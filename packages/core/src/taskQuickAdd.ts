/**
 * Quick add (APP-307): a due date, a time, a repeat, a Member and labels read
 * out of what a person types, in English and Dutch, so "stofzuigen morgen
 * elke week @Eric" is the task "stofzuigen", due tomorrow, every week, for
 * Eric.
 *
 * It runs on the phone as the line is typed: no network and no AI. Both
 * languages are always read, whatever the app's language, because a household
 * types in both.
 *
 * The rules:
 *
 * - Each recognised part is a span of the line. The title is the line without
 *   them. A part the person dismissed (its chip's ×) is not recognised again,
 *   and its words stay in the title as plain text.
 * - One date, one time, one repeat and one Member; the first of each wins and
 *   a later one stays text. Every `#label` counts.
 * - A date without a year is the next one that has not passed. A weekday is
 *   the coming one, today included; "next Monday" is the first after today.
 * - Numeric dates are day first: 12/3 is 12 March.
 * - A time is a 24-hour clock unless it says am or pm. A time without a date
 *   is today while it is still ahead, otherwise tomorrow.
 * - "@Name" is a Member whose first name or full name it is, ignoring case and
 *   accents. A first name two Members share needs the full name.
 *
 * Every function is pure and takes dates as `YYYY-MM-DD` civil days.
 */
import {
  addDays,
  addMonths,
  compareIsoDates,
  daysInMonth,
  isoWeekday,
  mondayStart,
  parseIsoDate,
} from './civilDate'
import {
  firstScheduledDate,
  normalizeRepeat,
  type RepeatUnit,
  type TaskRepeat,
} from './taskRepeat'

export const QUICK_ADD_KINDS = [
  'date',
  'time',
  'repeat',
  'member',
  'label',
] as const
export type QuickAddKind = (typeof QUICK_ADD_KINDS)[number]

export interface QuickAddMember {
  id: string
  name: string
}

export interface QuickAddContext {
  /** The day words are read from ("tomorrow"): the Group's, `YYYY-MM-DD`. */
  today: string
  /**
   * The phone's own day, where it can differ: a time sets a reminder on the
   * phone's clock. Left out, it is `today`.
   */
  clockDay?: string
  /** The phone's clock, `HH:MM`: decides whether a bare time is today. */
  now: string
  /** The Members a `@name` can be. */
  members?: readonly QuickAddMember[]
  /** Keys (`QuickAddPart.key`) of parts the person dismissed. */
  dismissed?: readonly string[]
}

interface PartBase {
  /** Where the part is in the line: `text.slice(start, end)`. */
  start: number
  end: number
  /** The words as typed. */
  text: string
  /** What dismissing it remembers: the kind and the words, lower case. */
  key: string
}

export type QuickAddPart = PartBase &
  (
    | { kind: 'date'; date: string }
    | { kind: 'time'; time: string }
    | { kind: 'repeat'; repeat: TaskRepeat }
    | { kind: 'member'; memberId: string; name: string }
    | { kind: 'label'; label: string }
  )

export interface QuickAdd {
  /** The line without its recognised parts, spaces tidied. */
  title: string
  /** The recognised parts, in the order they appear. */
  parts: QuickAddPart[]
  /** The due date: the date typed, or the day a time falls on. */
  dueDate?: string
  /** `HH:MM`, when a time was typed: the task's reminder. */
  time?: string
  repeat?: TaskRepeat
  assigneeId?: string
  labels: string[]
}

// ---------------------------------------------------------------- words

const WEEKDAYS: Record<string, number> = {
  monday: 1,
  maandag: 1,
  tuesday: 2,
  dinsdag: 2,
  wednesday: 3,
  woensdag: 3,
  thursday: 4,
  donderdag: 4,
  friday: 5,
  vrijdag: 5,
  saturday: 6,
  zaterdag: 6,
  sunday: 7,
  zondag: 7,
}

const MONTHS: [RegExp, number][] = [
  [/^jan(uari|uary)?$/, 1],
  [/^feb(ruari|ruary)?$/, 2],
  [/^(maart|march|mrt|mar)$/, 3],
  [/^apr(il)?$/, 4],
  [/^(mei|may)$/, 5],
  [/^jun(i|e)?$/, 6],
  [/^jul(i|y)?$/, 7],
  [/^aug(ustus|ust)?$/, 8],
  [/^sep(t|tember)?$/, 9],
  [/^(okt|oct)(ober)?$/, 10],
  [/^nov(ember)?$/, 11],
  [/^dec(ember)?$/, 12],
]

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  een: 1,
  één: 1,
  two: 2,
  twee: 2,
  other: 2,
  three: 3,
  drie: 3,
  four: 4,
  vier: 4,
}

const UNITS: Record<string, RepeatUnit> = {
  day: 'day',
  days: 'day',
  dag: 'day',
  dagen: 'day',
  week: 'week',
  weeks: 'week',
  weken: 'week',
  month: 'month',
  months: 'month',
  maand: 'month',
  maanden: 'month',
  year: 'year',
  years: 'year',
  jaar: 'year',
  jaren: 'year',
}

const ADVERBS: Record<string, RepeatUnit> = {
  daily: 'day',
  dagelijks: 'day',
  weekly: 'week',
  wekelijks: 'week',
  monthly: 'month',
  maandelijks: 'month',
  yearly: 'year',
  annually: 'year',
  jaarlijks: 'year',
}

const alt = (words: Iterable<string>) =>
  [...words].sort((a, b) => b.length - a.length).join('|')

const WEEKDAY = `(?:${alt(Object.keys(WEEKDAYS))})`
const MONTH = `(?:${alt([
  'januari',
  'january',
  'jan',
  'februari',
  'february',
  'feb',
  'maart',
  'march',
  'mrt',
  'mar',
  'april',
  'apr',
  'mei',
  'may',
  'juni',
  'june',
  'jun',
  'juli',
  'july',
  'jul',
  'augustus',
  'august',
  'aug',
  'september',
  'sept',
  'sep',
  'oktober',
  'october',
  'okt',
  'oct',
  'november',
  'nov',
  'december',
  'dec',
])})`
const COUNT = `(?:\\d{1,2}|${alt(Object.keys(NUMBER_WORDS))})`
const UNIT = `(?:${alt(Object.keys(UNITS))})`
const EVERY = '(?:every|each|elke|elk|iedere|ieder)'
const ON = '(?:(?:on|op)\\s+)?'
const AT = '(?:at|om)'
// A part starts and ends at a word's edge; `@` and `#` belong to their word.
const START = '(?<![\\p{L}\\p{N}_@#/.:-])'
const END = '(?![\\p{L}\\p{N}_])'

// ---------------------------------------------------------------- matchers

type Value =
  | { kind: 'date'; date: string }
  | { kind: 'time'; time: string }
  | { kind: 'repeat'; repeat: Omit<TaskRepeat, 'mode'> }
  | { kind: 'member'; memberId: string; name: string }
  | { kind: 'label'; label: string }

interface Matcher {
  pattern: RegExp
  read: (m: RegExpExecArray, ctx: QuickAddContext) => Value | null
}

const word = (source: string) =>
  new RegExp(`${START}(?:${source})${END}`, 'giu')

const countOf = (value: string | undefined): number | null => {
  if (value === undefined) return 1
  const lower = value.toLowerCase()
  const n = lower in NUMBER_WORDS ? NUMBER_WORDS[lower] : Number(lower)
  return Number.isInteger(n) && n >= 1 && n <= 99 ? n : null
}

const monthOf = (value: string): number | null => {
  const lower = value.toLowerCase()
  return MONTHS.find(([pattern]) => pattern.test(lower))?.[1] ?? null
}

const weekdayOf = (value: string): number => WEEKDAYS[value.toLowerCase()]

/** The coming `weekday` (ISO 1-7) from `today`, today included unless `after`. */
const comingWeekday = (today: string, weekday: number, after: boolean) => {
  const ahead = (weekday - isoWeekday(today) + 7) % 7
  return addDays(today, ahead === 0 && after ? 7 : ahead)
}

/** Day and month, with the year given or the first one it has not passed. */
const calendarDate = (
  today: string,
  day: number,
  month: number,
  year?: string,
): string | null => {
  if (month < 1 || month > 12 || day < 1) return null
  const given = year === undefined ? undefined : Number(year)
  const full =
    given === undefined ? undefined : given < 100 ? 2000 + given : given
  const base = parseIsoDate(today)
  if (!base) return null
  const pick = (y: number) =>
    day <= daysInMonth(y, month)
      ? `${String(y).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      : null
  if (full !== undefined) return pick(full)
  const thisYear = pick(base.year)
  if (thisYear && compareIsoDates(thisYear, today) >= 0) return thisYear
  // 29 February waits for the next leap year.
  for (let y = base.year + 1; y <= base.year + 8; y++) {
    const next = pick(y)
    if (next) return next
  }
  return null
}

const clock = (hour: number, minute: number): string | null =>
  hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
    ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    : null

const meridiem = (hour: number, minute: number, suffix?: string) => {
  const half = suffix?.toLowerCase()
  if (half !== 'am' && half !== 'pm') return clock(hour, minute)
  if (hour < 1 || hour > 12) return null
  return clock((hour % 12) + (half === 'pm' ? 12 : 0), minute)
}

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()

const MATCHERS: Matcher[] = [
  // ---- repeats
  {
    pattern: word(alt(Object.keys(ADVERBS))),
    read: (m) => ({
      kind: 'repeat',
      repeat: { unit: ADVERBS[m[0].toLowerCase()], every: 1 },
    }),
  },
  {
    pattern: word(`${EVERY}\\s+(?:(${COUNT})\\s+)?(${UNIT})`),
    read: (m) => {
      const every = countOf(m[1])
      return every === null
        ? null
        : { kind: 'repeat', repeat: { unit: UNITS[m[2].toLowerCase()], every } }
    },
  },
  {
    // "om de week" is every other week; "om de 3 dagen" every three days.
    pattern: word(`om\\s+de\\s+(?:(${COUNT})\\s+)?(${UNIT})`),
    read: (m) => {
      const every = m[1] === undefined ? 2 : countOf(m[1])
      return every === null
        ? null
        : { kind: 'repeat', repeat: { unit: UNITS[m[2].toLowerCase()], every } }
    },
  },
  {
    pattern: word(
      `${EVERY}\\s+(${WEEKDAY}(?:\\s*(?:,|and|en|&)\\s*${WEEKDAY})*)`,
    ),
    read: (m) => ({
      kind: 'repeat',
      repeat: {
        unit: 'week',
        every: 1,
        weekdays: m[1]
          .split(/\s*(?:,|\band\b|\ben\b|&)\s*/iu)
          .map(weekdayOf),
      },
    }),
  },
  {
    // "on Mondays"
    pattern: word(`(?:on\\s+)?(${WEEKDAY})s`),
    read: (m) => ({
      kind: 'repeat',
      repeat: { unit: 'week', every: 1, weekdays: [weekdayOf(m[1])] },
    }),
  },
  {
    pattern: word(`${EVERY}\\s+(?:weekday|workday|werkdag|doordeweekse\\s+dag)`),
    read: () => ({
      kind: 'repeat',
      repeat: { unit: 'week', every: 1, weekdays: [1, 2, 3, 4, 5] },
    }),
  },
  {
    pattern: word(`${EVERY}\\s+weekend`),
    read: () => ({
      kind: 'repeat',
      repeat: { unit: 'week', every: 1, weekdays: [6, 7] },
    }),
  },

  // ---- dates
  {
    pattern: word(
      'today|vandaag|tonight|vanavond|vanmiddag|this\\s+afternoon|this\\s+evening',
    ),
    read: (_m, ctx) => ({ kind: 'date', date: ctx.today }),
  },
  {
    pattern: word('tomorrow|morgen|tmrw'),
    read: (_m, ctx) => ({ kind: 'date', date: addDays(ctx.today, 1) }),
  },
  {
    pattern: word('(?:the\\s+)?day\\s+after\\s+tomorrow|overmorgen'),
    read: (_m, ctx) => ({ kind: 'date', date: addDays(ctx.today, 2) }),
  },
  {
    pattern: word(
      `(?:(next|volgende)\\s+|(?:on|op|this|deze|aanstaande|komende|coming)\\s+)?(${WEEKDAY})`,
    ),
    read: (m, ctx) => ({
      kind: 'date',
      date: comingWeekday(ctx.today, weekdayOf(m[2]), m[1] !== undefined),
    }),
  },
  {
    pattern: word('(?:next|volgende|komende)\\s+week'),
    read: (_m, ctx) => ({
      kind: 'date',
      date: addDays(mondayStart(ctx.today), 7),
    }),
  },
  {
    pattern: word('(this|dit|next|volgend|komend)\\s+weekend'),
    read: (m, ctx) => {
      const weekday = isoWeekday(ctx.today)
      const coming =
        weekday >= 6 ? ctx.today : addDays(ctx.today, 6 - weekday)
      const next = /^(next|volgend|komend)$/i.test(m[1])
      // On a Sunday this weekend is today, and next weekend the coming one.
      return {
        kind: 'date',
        date: next ? addDays(coming, weekday === 7 ? 6 : 7) : coming,
      }
    },
  },
  {
    pattern: word('(?:next|volgende|komende)\\s+(?:month|maand)'),
    read: (_m, ctx) => ({
      kind: 'date',
      date: addMonths(`${ctx.today.slice(0, 8)}01`, 1),
    }),
  },
  {
    pattern: word(`(?:in|over)\\s+(${COUNT})\\s+(${UNIT})`),
    read: (m, ctx) => {
      const n = countOf(m[1])
      if (n === null) return null
      const unit = UNITS[m[2].toLowerCase()]
      const date =
        unit === 'day'
          ? addDays(ctx.today, n)
          : unit === 'week'
            ? addDays(ctx.today, 7 * n)
            : addMonths(ctx.today, unit === 'month' ? n : 12 * n)
      return { kind: 'date', date }
    },
  },
  {
    // 12/3, 12-3, 12/3/2027: day first.
    pattern: word(`${ON}(\\d{1,2})[/-](\\d{1,2})(?:[/-](\\d{4}|\\d{2}))?`),
    read: (m, ctx) => {
      const date = calendarDate(ctx.today, Number(m[1]), Number(m[2]), m[3])
      return date ? { kind: 'date', date } : null
    },
  },
  {
    // 12 maart, 12th of March, 3 mei 2027
    pattern: word(
      `${ON}(\\d{1,2})(?:st|nd|rd|th|e)?\\s+(?:of\\s+)?(${MONTH})(?:\\s+(\\d{4}))?`,
    ),
    read: (m, ctx) => {
      const month = monthOf(m[2])
      const date = month && calendarDate(ctx.today, Number(m[1]), month, m[3])
      return date ? { kind: 'date', date } : null
    },
  },
  {
    // March 12, March 12th, 2027
    pattern: word(
      `${ON}(${MONTH})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?`,
    ),
    read: (m, ctx) => {
      const month = monthOf(m[1])
      const date = month && calendarDate(ctx.today, Number(m[2]), month, m[3])
      return date ? { kind: 'date', date } : null
    },
  },

  // ---- times
  {
    // 9:30, om 9:30, at 9:30pm; 9.30 only after "at" or "om".
    pattern: word(
      `(?:${AT}\\s+)?(\\d{1,2}):(\\d{2})(?:\\s*(am|pm|uur))?|${AT}\\s+(\\d{1,2})\\.(\\d{2})(?:\\s*(am|pm|uur))?`,
    ),
    read: (m) => {
      const time =
        m[1] !== undefined
          ? meridiem(Number(m[1]), Number(m[2]), m[3])
          : meridiem(Number(m[4]), Number(m[5]), m[6])
      return time ? { kind: 'time', time } : null
    },
  },
  {
    // 9am, at 3 pm, om 15 uur, 15u, om 9
    pattern: word(
      `(?:${AT}\\s+)?(\\d{1,2})\\s*(am|pm)|(?:${AT}\\s+)?(\\d{1,2})(?:\\s+uur|u)|${AT}\\s+(\\d{1,2})`,
    ),
    read: (m) => {
      const time =
        m[1] !== undefined
          ? meridiem(Number(m[1]), 0, m[2])
          : clock(Number(m[3] ?? m[4]), 0)
      return time ? { kind: 'time', time } : null
    },
  },

  // ---- labels: with a letter in them, so "Order #12" stays a number
  {
    pattern: /(?<![\p{L}\p{N}_#])#([\p{N}_-]*\p{L}[\p{L}\p{N}_-]*)/gu,
    read: (m) => ({ kind: 'label', label: m[1] }),
  },
]

/** `@Name` or `@First Last`: the longest that is a Member. */
const memberMatches = (
  text: string,
  members: readonly QuickAddMember[],
): { start: number; end: number; value: Value }[] => {
  if (members.length === 0) return []
  const named = members
    .filter((m) => m.name.trim())
    .map((m) => ({
      ...m,
      full: fold(m.name),
      first: fold(m.name).split(/\s+/)[0],
    }))
  const found: { start: number; end: number; value: Value }[] = []
  const at = /(?<![\p{L}\p{N}_@])@([\p{L}\p{N}][\p{L}\p{N}'’-]*)(?:\s+([\p{L}\p{N}][\p{L}\p{N}'’-]*))?/gu
  for (const m of text.matchAll(at)) {
    const start = m.index
    const one = fold(m[1])
    const two = m[2] === undefined ? null : `${one} ${fold(m[2])}`
    const byFull = two ? named.filter((n) => n.full === two) : []
    let hit: (typeof named)[number] | undefined
    let end = start + 1 + m[1].length
    if (byFull.length === 1) {
      hit = byFull[0]
      end = start + m[0].length
    } else {
      const exact = named.filter((n) => n.full === one)
      const first = named.filter((n) => n.first === one)
      hit =
        exact.length === 1 ? exact[0] : first.length === 1 ? first[0] : undefined
    }
    if (hit) {
      found.push({
        start,
        end,
        value: { kind: 'member', memberId: hit.id, name: hit.name },
      })
    }
  }
  return found
}

// ---------------------------------------------------------------- parse

/** Reads a typed line into a title and the parts recognised in it. */
export function parseQuickAdd(text: string, ctx: QuickAddContext): QuickAdd {
  const dismissed = new Set(ctx.dismissed ?? [])
  const candidates: { start: number; end: number; value: Value }[] = []
  for (const matcher of MATCHERS) {
    matcher.pattern.lastIndex = 0
    for (const m of text.matchAll(matcher.pattern)) {
      const value = matcher.read(m as RegExpExecArray, ctx)
      if (value) {
        candidates.push({ start: m.index, end: m.index + m[0].length, value })
      }
    }
  }
  candidates.push(...memberMatches(text, ctx.members ?? []))
  // Earlier first, then longer: "elke maandag" beats "maandag" inside it.
  candidates.sort((a, b) => a.start - b.start || b.end - a.end)

  const parts: QuickAddPart[] = []
  const taken = new Set<QuickAddKind>()
  for (const c of candidates) {
    const kind = c.value.kind
    if (kind !== 'label' && taken.has(kind)) continue
    const raw = text.slice(c.start, c.end)
    const key = `${kind}:${raw.toLowerCase().replace(/\s+/g, ' ')}`
    if (dismissed.has(key)) continue
    if (parts.some((p) => c.start < p.end && p.start < c.end)) continue
    if (
      c.value.kind === 'label' &&
      parts.some(
        (p) =>
          p.kind === 'label' &&
          p.label.toLowerCase() ===
            (c.value as { label: string }).label.toLowerCase(),
      )
    ) {
      continue
    }
    taken.add(kind)
    parts.push(toPart(c.value, { start: c.start, end: c.end, text: raw, key }))
  }
  parts.sort((a, b) => a.start - b.start)

  let title = ''
  let from = 0
  for (const p of parts) {
    title += `${text.slice(from, p.start)} `
    from = p.end
  }
  title = (title + text.slice(from)).replace(/\s+/g, ' ').trim()

  const date = parts.find((p) => p.kind === 'date')
  const time = parts.find((p) => p.kind === 'time')
  const repeat = parts.find((p) => p.kind === 'repeat')
  const member = parts.find((p) => p.kind === 'member')
  // Without a typed date the first day it can still happen: today, or
  // tomorrow once a typed time has passed, and for a repeat the first of its
  // days from then on, as the server would pick (`firstDueDate`). "Elke
  // dinsdag om 19:30" on a Saturday is due Tuesday, not today.
  const start = time ? (ctx.clockDay ?? ctx.today) : ctx.today
  const first = time && time.time <= ctx.now ? addDays(start, 1) : start
  const dueDate =
    date?.date ??
    (repeat
      ? firstScheduledDate(anchored(repeat.repeat, first), first, first)
      : time
        ? first
        : undefined)
  return {
    title,
    parts,
    ...(dueDate ? { dueDate } : {}),
    ...(time ? { time: time.time } : {}),
    ...(repeat ? { repeat: anchored(repeat.repeat, dueDate ?? first) } : {}),
    ...(member ? { assigneeId: member.memberId } : {}),
    labels: parts.flatMap((p) => (p.kind === 'label' ? [p.label] : [])),
  }
}

/** The repeat with its anchors from the due date, as the server stores it. */
const anchored = (rule: TaskRepeat, anchor: string): TaskRepeat =>
  normalizeRepeat(rule, anchor) ?? rule

/** A part's repeat is the rule as typed; `QuickAdd.repeat` is it anchored. */
function toPart(value: Value, base: PartBase): QuickAddPart {
  if (value.kind === 'repeat') {
    return { ...base, kind: 'repeat', repeat: { mode: 'fixed', ...value.repeat } }
  }
  return { ...base, ...value }
}
