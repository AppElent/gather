import type { CalendarView } from '@gather/core/calendar'
import { addDays, addMonths } from '@gather/core/civil-date'

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

export function settleHeader(
  state: CalendarNavigationState,
  progress: number,
  velocity = 0,
): CalendarNavigationState {
  const target =
    velocity < -450 ? 0 : velocity > 450 ? 1 : progress >= 0.5 ? 1 : 0
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
