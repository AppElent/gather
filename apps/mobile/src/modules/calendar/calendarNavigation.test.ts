import { describe, expect, test } from 'vitest'

import {
  agendaMonths,
  agendaRangeAround,
  agendaRangeForJump,
  chooseHeader,
  extendAgendaRange,
  initialCalendarNavigation,
  pageActiveDate,
  selectCalendarDate,
  setCalendarView,
  settleHeader,
  settleTarget,
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
      preferredView: 'month',
      headerProgress: 1,
    })
  })

  test('a released header drag settles by position, then by velocity', () => {
    const week = initialCalendarNavigation('2026-09-12', 'week')
    // Pulled past half way: Month, and that becomes the preference.
    expect(chooseHeader(week, 0.6)).toMatchObject({
      presentation: 'month',
      preferredView: 'month',
    })
    // Pulled down and brought back: stays Week.
    expect(chooseHeader(week, 0.1)).toMatchObject({ presentation: 'week' })
    // A short, fast flick down still opens the month; a flick up closes it.
    expect(chooseHeader(week, 0.2, 900)).toMatchObject({
      presentation: 'month',
    })
    const month = initialCalendarNavigation('2026-09-12', 'month')
    expect(chooseHeader(month, 0.8, -900)).toMatchObject({
      presentation: 'week',
      preferredView: 'week',
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

describe('header settle target', () => {
  test('a flick decides by direction, a slow release by the nearer half', () => {
    expect(settleTarget(0.2, 900)).toBe(1)
    expect(settleTarget(0.8, -900)).toBe(0)
    expect(settleTarget(0.6, 0)).toBe(1)
    expect(settleTarget(0.4, 100)).toBe(0)
  })
})

describe('agenda range', () => {
  test('starts with the month before, the month itself and the month after', () => {
    expect(agendaRangeAround('2026-09-12')).toEqual({
      from: '2026-08-01',
      toExclusive: '2026-11-01',
    })
    expect(agendaMonths(agendaRangeAround('2026-01-31'))).toEqual([
      '2025-12-01',
      '2026-01-01',
      '2026-02-01',
    ])
  })

  test('grows a whole month at either end', () => {
    const range = agendaRangeAround('2026-09-12')
    expect(extendAgendaRange(range, -1)).toEqual({
      from: '2026-07-01',
      toExclusive: '2026-11-01',
    })
    expect(extendAgendaRange(range, 1)).toEqual({
      from: '2026-08-01',
      toExclusive: '2026-12-01',
    })
  })

  test('a jump near what is loaded keeps it and adds a month after the date', () => {
    const range = { from: '2026-06-01', toExclusive: '2026-11-01' }
    // The last loaded day needs the month after it, or it cannot reach the top.
    expect(agendaRangeForJump(range, '2026-10-31')).toEqual({
      from: '2026-06-01',
      toExclusive: '2026-12-01',
    })
    expect(agendaRangeForJump(range, '2026-08-10')).toEqual(range)
  })

  test('a jump far away starts over around the date', () => {
    const range = { from: '2026-06-01', toExclusive: '2026-11-01' }
    expect(agendaRangeForJump(range, '2027-05-04')).toEqual({
      from: '2027-04-01',
      toExclusive: '2027-07-01',
    })
  })

  test('drops the month at the far end once it holds the most months', () => {
    const full = { from: '2026-01-01', toExclusive: '2026-10-01' }
    expect(agendaMonths(full)).toHaveLength(9)
    expect(extendAgendaRange(full, 1)).toEqual({
      from: '2026-02-01',
      toExclusive: '2026-11-01',
    })
    expect(extendAgendaRange(full, -1)).toEqual({
      from: '2025-12-01',
      toExclusive: '2026-09-01',
    })
    expect(extendAgendaRange(full, 1, 4)).toEqual({
      from: '2026-07-01',
      toExclusive: '2026-11-01',
    })
  })

  test('a jump that would grow past the most months drops the far end', () => {
    const full = { from: '2026-01-01', toExclusive: '2026-10-01' }
    expect(agendaRangeForJump(full, '2026-09-20')).toEqual({
      from: '2026-02-01',
      toExclusive: '2026-11-01',
    })
    expect(agendaRangeForJump(full, '2026-01-03')).toEqual({
      from: '2025-12-01',
      toExclusive: '2026-09-01',
    })
    expect(agendaRangeForJump(full, '2026-05-10')).toEqual(full)
  })
})
