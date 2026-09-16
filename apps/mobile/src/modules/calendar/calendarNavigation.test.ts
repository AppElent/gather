import { describe, expect, test } from 'vitest'

import {
  initialCalendarNavigation,
  pageActiveDate,
  selectCalendarDate,
  setCalendarView,
  settleHeader,
  toggleHeader,
} from './calendarNavigation'

describe('calendar navigation', () => {
  test('starts today in the saved presentation', () => {
    expect(initialCalendarNavigation('2026-09-12', 'month')).toMatchObject({
      activeDate: '2026-09-12',
      presentation: 'month',
      headerProgress: 1,
    })
  })

  test('automatic collapse changes presentation but not preferred view', () => {
    const state = initialCalendarNavigation('2026-09-12', 'month')
    expect(settleHeader(state, 0)).toMatchObject({
      presentation: 'week',
      preferredView: 'month',
    })
  })

  test('explicit view and handle choices update the preference', () => {
    const state = initialCalendarNavigation('2026-09-12')
    expect(setCalendarView(state, 'agenda')).toMatchObject({
      preferredView: 'agenda',
      presentation: 'agenda',
    })
    expect(toggleHeader(state)).toMatchObject({
      presentation: 'month',
      headerProgress: 1,
    })
  })

  test('pages by seven compact dates and by one month when expanded', () => {
    const compact = initialCalendarNavigation('2026-01-31', 'week')
    expect(pageActiveDate(compact, 1).activeDate).toBe('2026-02-07')
    const month = setCalendarView(compact, 'month')
    expect(pageActiveDate(month, 1).activeDate).toBe('2026-02-28')
  })

  test('selection is independent from presentation', () => {
    expect(
      selectCalendarDate(initialCalendarNavigation('2026-09-12'), '2026-10-04')
        .activeDate,
    ).toBe('2026-10-04')
  })
})
