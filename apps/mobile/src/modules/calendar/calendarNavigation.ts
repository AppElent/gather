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

/** One more month at the start (`-1`) or the end (`1`). */
export function extendAgendaRange(
  range: AgendaRange,
  direction: -1 | 1,
): AgendaRange {
  return direction < 0
    ? { ...range, from: addMonths(range.from, -1) }
    : { ...range, toExclusive: addMonths(range.toExclusive, 1) }
}

/**
 * A deliberate jump keeps what is loaded when the date is in or next to it,
 * and grows it to a month either side of the date, so the day can reach the
 * top of the list. A date further away starts over around it.
 */
export function agendaRangeForJump(
  range: AgendaRange,
  date: string,
): AgendaRange {
  const around = agendaRangeAround(date)
  const touches =
    compareIsoDates(around.from, range.toExclusive) <= 0 &&
    compareIsoDates(around.toExclusive, range.from) >= 0
  if (!touches) return around
  return {
    from:
      compareIsoDates(around.from, range.from) < 0 ? around.from : range.from,
    toExclusive:
      compareIsoDates(around.toExclusive, range.toExclusive) > 0
        ? around.toExclusive
        : range.toExclusive,
  }
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
