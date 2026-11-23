import { expect, test, vi } from 'vitest'
import { en } from '../../i18n/messages/en'

import { calendarMenuActions, pressCalendarMenu } from './calendarMenu'

const t = { calendar: en.calendar, composer: en.composer }

test('Add event comes first, in its own untitled section', () => {
  const [first, ...rest] = calendarMenuActions(t, 'week')
  expect(first).toMatchObject({
    title: '',
    displayInline: true,
    subactions: [{ id: 'add-event', title: 'Add event' }],
  })
  expect(rest.map((action) => action.id)).toEqual([
    'month',
    'week',
    'agenda',
    'calendars',
    'people',
  ])
  expect(rest.find((action) => action.id === 'week')?.state).toBe('on')
})

test('each item reaches its handler', () => {
  const handlers = {
    onAddEvent: vi.fn(),
    onView: vi.fn(),
    onOpenCalendars: vi.fn(),
    onOpenPeople: vi.fn(),
  }
  pressCalendarMenu('add-event', handlers)
  expect(handlers.onAddEvent).toHaveBeenCalledOnce()
  pressCalendarMenu('agenda', handlers)
  expect(handlers.onView).toHaveBeenCalledWith('agenda')
  pressCalendarMenu('calendars', handlers)
  pressCalendarMenu('people', handlers)
  expect(handlers.onOpenCalendars).toHaveBeenCalledOnce()
  expect(handlers.onOpenPeople).toHaveBeenCalledOnce()
  expect(handlers.onAddEvent).toHaveBeenCalledOnce()
})
