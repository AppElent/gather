import type { CalendarView } from '@gather/core/calendar'
import {
  addDays,
  addMonths,
  compareIsoDates,
  monthStart,
} from '@gather/core/civil-date'

export interface CalendarNavigationState {
  activeDate: string
  preferredView: CalendarView
  presentation: CalendarView
  headerProgress: number
}

export function initialCalendarNavigation(
  today: string,
  preferredView: CalendarView = 'week',
): CalendarNavigationState {
  return {
    activeDate: today,
    preferredView,
    presentation: preferredView,
    headerProgress: viewProgress(preferredView),
  }
}

export function viewProgress(view: CalendarView): number {
  return view === 'month' ? 1 : 0
}

export function setCalendarView(
  state: CalendarNavigationState,
  view: CalendarView,
): CalendarNavigationState {
  return {
    ...state,
    preferredView: view,
    presentation: view,
    headerProgress: viewProgress(view),
  }
}

/**
 * Where a released header drag comes to rest: a flick decides by its
 * direction, a slow release by whichever half the header is in.
 */
export function settleTarget(progress: number, velocity = 0): 0 | 1 {
  return velocity < -450 ? 0 : velocity > 450 ? 1 : progress >= 0.5 ? 1 : 0
}

export function settleHeader(
  state: CalendarNavigationState,
  progress: number,
  velocity = 0,
): CalendarNavigationState {
  const target = settleTarget(progress, velocity)
  const presentation: CalendarView = target === 1 ? 'month' : 'week'
  return { ...state, presentation, headerProgress: target }
}

/**
 * A header drag the person let go of: settles like `settleHeader` and, because
 * it was their choice rather than an automatic collapse, becomes the saved
 * preference too.
 */
export function chooseHeader(
  state: CalendarNavigationState,
  progress: number,
  velocity = 0,
): CalendarNavigationState {
  const settled = settleHeader(state, progress, velocity)
  return { ...settled, preferredView: settled.presentation }
}

/** The handle's tap: an explicit choice, so it updates the preference. */
export function toggleHeader(
  state: CalendarNavigationState,
): CalendarNavigationState {
  return chooseHeader(state, state.headerProgress < 0.5 ? 1 : 0)
}

export function pageActiveDate(
  state: CalendarNavigationState,
  direction: -1 | 1,
): CalendarNavigationState {
  const next =
    state.presentation === 'month'
      ? addMonths(state.activeDate, direction)
      : addDays(state.activeDate, direction * 7)
  return { ...state, activeDate: next }
}

export function selectCalendarDate(
  state: CalendarNavigationState,
  date: string,
): CalendarNavigationState {
  return { ...state, activeDate: date }
}

/**
 * The whole months the agenda has loaded: `from` is a month's first day and
 * `toExclusive` the first day after its last month. Whole months, so a month
 * added at either end never changes the rows of the months already there.
 */
export interface AgendaRange {
  from: string
  toExclusive: string
}

/** The month before `date`'s, its own, and the one after. */
export function agendaRangeAround(date: string): AgendaRange {
  const month = monthStart(date)
  return { from: addMonths(month, -1), toExclusive: addMonths(month, 2) }
}

/**
 * The most whole months the agenda keeps. Scrolling for years would otherwise
 * keep every month's rows, and rebuild them all on every event change.
 */
export const AGENDA_MAX_MONTHS = 9

function monthCount(range: AgendaRange): number {
  const [fromYear, fromMonth] = range.from.split('-').map(Number)
  const [toYear, toMonth] = range.toExclusive.split('-').map(Number)
  return (toYear - fromYear) * 12 + (toMonth - fromMonth)
}

/**
 * One more month at the start (`-1`) or the end (`1`). Past `maxMonths` the
 * month at the other end goes, the one furthest from where the person is.
 */
export function extendAgendaRange(
  range: AgendaRange,
  direction: -1 | 1,
  maxMonths = AGENDA_MAX_MONTHS,
): AgendaRange {
  const grown =
    direction < 0
      ? { ...range, from: addMonths(range.from, -1) }
      : { ...range, toExclusive: addMonths(range.toExclusive, 1) }
  const excess = monthCount(grown) - maxMonths
  if (excess <= 0) return grown
  return direction < 0
    ? { ...grown, toExclusive: addMonths(grown.toExclusive, -excess) }
    : { ...grown, from: addMonths(grown.from, excess) }
}

/**
 * A deliberate jump keeps what is loaded when the date is in or next to it,
 * and grows it to a month either side of the date, so the day can reach the
 * top of the list. A date further away starts over around it. Past
 * `maxMonths`, months go from the end further from the date.
 */
export function agendaRangeForJump(
  range: AgendaRange,
  date: string,
  maxMonths = AGENDA_MAX_MONTHS,
): AgendaRange {
  const around = agendaRangeAround(date)
  const touches =
    compareIsoDates(around.from, range.toExclusive) <= 0 &&
    compareIsoDates(around.toExclusive, range.from) >= 0
  if (!touches) return around
  let merged = {
    from:
      compareIsoDates(around.from, range.from) < 0 ? around.from : range.from,
    toExclusive:
      compareIsoDates(around.toExclusive, range.toExclusive) > 0
        ? around.toExclusive
        : range.toExclusive,
  }
  while (monthCount(merged) > Math.max(maxMonths, 3)) {
    const before = monthCount({ from: merged.from, toExclusive: around.from })
    const after = monthCount({
      from: around.toExclusive,
      toExclusive: merged.toExclusive,
    })
    merged =
      before >= after
        ? { ...merged, from: addMonths(merged.from, 1) }
        : { ...merged, toExclusive: addMonths(merged.toExclusive, -1) }
  }
  return merged
}

/** The first day of every month in the range, in order. */
export function agendaMonths(range: AgendaRange): string[] {
  const months: string[] = []
  for (
    let month = range.from;
    compareIsoDates(month, range.toExclusive) < 0;
    month = addMonths(month, 1)
  )
    months.push(month)
  return months
}
