/**
 * What the four tiles at the top of a Child's log say.
 *
 * The tiles answer "how is today going" and the log bar below them answers
 * "record something" — two different jobs, which is why a tile is a summary
 * that happens to be tappable rather than a button that happens to show a
 * number.
 *
 * Pure, and messages arrive as a parameter rather than from the context
 * (ADR-0011's third rule), so this is callable from a test with no React tree.
 * Nothing here reads the clock: `now` is passed in, because a summary that
 * silently depended on the wall clock could not be tested at a fixed instant.
 */
import type { BabyEventType } from '@gather/core/domain'

export interface LoggedEvent {
  type: BabyEventType
  timestamp: number
  endTimestamp?: number
  data: unknown
}

export interface TileStatus {
  type: BabyEventType
  /** The big line. Absent when nothing of this type has been logged. */
  headline: string | null
  /** The small line under it. */
  detail: string | null
}

/** Midnight local time on the day `now` falls in. */
export function startOfDay(now: number): number {
  const date = new Date(now)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/**
 * "32m", "3h 10m", "2d".
 *
 * Coarse on purpose above an hour: a parent reading "3h 10m ago" is answering
 * "is she due?", and seconds of precision would be noise on the tile.
 */
export function shortDuration(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const rest = minutes % 60
    return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
  }
  return `${Math.floor(hours / 24)}d`
}

function todaysOf(
  events: readonly LoggedEvent[],
  type: BabyEventType,
  dayStart: number,
) {
  return events.filter((e) => e.type === type && e.timestamp >= dayStart)
}

function latestOf(events: readonly LoggedEvent[], type: BabyEventType) {
  return events
    .filter((e) => e.type === type)
    .reduce<LoggedEvent | null>(
      (latest, e) => (!latest || e.timestamp > latest.timestamp ? e : latest),
      null,
    )
}

/**
 * How long the Child slept today, in ms.
 *
 * A sleep with no `endTimestamp` contributes nothing rather than counting up to
 * now. There is no running timer in v1, so an open-ended sleep means "duration
 * unknown" and not "still asleep" — guessing which would put a number on the
 * tile that nobody entered.
 */
export function sleepTotalMs(
  events: readonly LoggedEvent[],
  dayStart: number,
): number {
  return todaysOf(events, 'sleep', dayStart).reduce(
    (total, e) =>
      e.endTimestamp && e.endTimestamp > e.timestamp
        ? total + (e.endTimestamp - e.timestamp)
        : total,
    0,
  )
}

export interface StatusMessages {
  ago: (duration: string) => string
  countToday: (count: number) => string
  never: string
  at: (time: string) => string
  formatTime: (timestamp: number) => string
}

/**
 * One tile's two lines, for any tracked type.
 *
 * Every type gets an answer, including the ones with no natural number —
 * a Note tile says when the last one was written. A type with nothing logged
 * says so rather than showing a zero, because "0 today" and "you have never
 * logged this" read the same and are not the same.
 */
export function tileStatus(
  type: BabyEventType,
  events: readonly LoggedEvent[],
  now: number,
  t: StatusMessages,
): TileStatus {
  const dayStart = startOfDay(now)
  const latest = latestOf(events, type)
  const todayCount = todaysOf(events, type, dayStart).length

  if (!latest) return { type, headline: null, detail: t.never }

  if (type === 'sleep') {
    const total = sleepTotalMs(events, dayStart)
    return {
      type,
      headline:
        total > 0
          ? shortDuration(total)
          : t.ago(shortDuration(now - latest.timestamp)),
      detail: t.countToday(todayCount),
    }
  }

  if (type === 'temperature') {
    const celsius = (latest.data as { celsius?: number } | null)?.celsius
    return {
      type,
      headline: celsius === undefined ? null : `${celsius.toFixed(1)} °C`,
      detail: t.at(t.formatTime(latest.timestamp)),
    }
  }

  if (type === 'diaper' || type === 'feeding') {
    return {
      type,
      headline: t.ago(shortDuration(now - latest.timestamp)),
      detail: t.countToday(todayCount),
    }
  }

  return {
    type,
    headline: t.ago(shortDuration(now - latest.timestamp)),
    detail: t.at(t.formatTime(latest.timestamp)),
  }
}

/**
 * Which types get a tile: the tracked ones that have something to say, capped
 * at four so the grid stays two rows on the smallest phone.
 *
 * Ordered by how recently each type was logged, so the tiles are the last-used
 * actions — the shortcut a parent reaches for — while the log bar below stays
 * the complete list of what this Child tracks.
 */
export function tileTypes(
  tracked: readonly BabyEventType[],
  events: readonly LoggedEvent[],
  limit = 4,
): BabyEventType[] {
  const lastUsed = new Map<BabyEventType, number>()
  for (const event of events) {
    const seen = lastUsed.get(event.type)
    if (seen === undefined || event.timestamp > seen) {
      lastUsed.set(event.type, event.timestamp)
    }
  }
  const used = tracked.filter((type) => lastUsed.has(type))
  const unused = tracked.filter((type) => !lastUsed.has(type))
  used.sort((a, b) => (lastUsed.get(b) ?? 0) - (lastUsed.get(a) ?? 0))
  // Unused types still get a tile when there is room, so a freshly created
  // Child shows its offer rather than an empty band.
  return [...used, ...unused].slice(0, limit)
}
