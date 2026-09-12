import {
  addCalendarDays,
  addCalendarMonths,
  type CalendarView,
  calendarWeek,
  monthStart,
} from '@gather/core/calendar'

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
    headerProgress: preferredView === 'month' ? 1 : 0,
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

export function toggleHeader(
  state: CalendarNavigationState,
): CalendarNavigationState {
  return settleHeader(state, state.headerProgress < 0.5 ? 1 : 0)
}

export function pageActiveDate(
  state: CalendarNavigationState,
  direction: -1 | 1,
): CalendarNavigationState {
  const next =
    state.presentation === 'month'
      ? addCalendarMonths(state.activeDate, direction)
      : addCalendarDays(state.activeDate, direction * 7)
  return { ...state, activeDate: next }
}

export function selectCalendarDate(
  state: CalendarNavigationState,
  date: string,
): CalendarNavigationState {
  return { ...state, activeDate: date }
}

export function headerDates(state: CalendarNavigationState): string[] {
  return state.presentation === 'month'
    ? calendarWeek(monthStart(state.activeDate))
    : calendarWeek(state.activeDate)
}
