// @vitest-environment jsdom
/**
 * The header menu's Add event (APP-625) opens the floating button's composer:
 * the one `AddEvent`, never a second. The screen, the composer and the editor
 * are stand-ins that show what Calendar hands them.
 */

import { act, createElement } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'
import { en } from '../../i18n/messages/en'

import { mount } from '../../testing/dom'

const state = vi.hoisted(() => ({
  draft: null as null | { status: string },
}))

vi.mock('react-native', () => ({ Alert: { alert: vi.fn() } }))
vi.mock('@clerk/expo', () => ({ useAuth: () => ({ userId: 'user_1' }) }))
vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }))
vi.mock('../../convex/api', () => ({
  api: new Proxy({}, { get: () => new Proxy({}, { get: () => ({}) }) }),
}))
vi.mock('../../convex/queries', () => ({ useQuery: () => undefined }))
vi.mock('../../feedback/confirmDestructive', () => ({
  confirmDestructive: vi.fn(),
}))
vi.mock('../../group/GroupProvider', () => ({
  useGroup: () => ({ group: { _id: 'group_1', slug: 'home' } }),
}))
vi.mock('../../i18n', () => ({
  useI18n: () => ({ t: en, locale: 'en' }),
  fmt: (s: string) => s,
}))
vi.mock('./useCalendarData', () => ({
  useCalendarData: () => ({
    sources: [],
    calendars: [],
    people: [],
    preferencesReady: true,
    view: 'week',
    hiddenCalendarIds: [],
    onEvents: () => {},
  }),
}))
vi.mock('./useCalendarEditor', () => ({
  useCalendarEditor: () => ({
    get draft() {
      return state.draft
    },
    openEdit: () => {
      state.draft = { status: 'editing' }
    },
    resume: () => {},
    discard: () => {},
  }),
}))
vi.mock('./CalendarEventSource', () => ({ CalendarEventSource: () => null }))
vi.mock('./CalendarFilters', () => ({ CalendarFilters: () => null }))
vi.mock('./CalendarManagementSheet', () => ({
  CalendarManagementSheet: () => null,
}))
vi.mock('./CalendarEditor', () => ({
  CalendarEditor: () => createElement('div', { 'data-testid': 'editor' }),
}))
vi.mock('./CalendarScreen', () => ({
  CalendarScreen: (props: {
    onAddEvent: () => void
    onEvent: (event: unknown) => void
  }) =>
    createElement(
      'div',
      null,
      createElement('button', {
        type: 'button',
        'data-testid': 'menu-add-event',
        onClick: props.onAddEvent,
      }),
      createElement('button', {
        type: 'button',
        'data-testid': 'open-event',
        onClick: () => props.onEvent({ id: 'event_1' }),
      }),
    ),
}))
vi.mock('./AddEventComposer', () => ({
  AddEvent: (props: {
    open: boolean
    hidden: boolean
    onOpenChange: (open: boolean) => void
  }) =>
    createElement(
      'div',
      null,
      props.open
        ? createElement(
            'button',
            {
              type: 'button',
        'data-testid': 'composer',
              onClick: () => props.onOpenChange(false),
            },
          )
        : props.hidden
          ? null
          : createElement('button', {
              type: 'button',
        'data-testid': 'add-event',
              onClick: () => props.onOpenChange(true),
            }),
    ),
}))

const { ConnectedCalendarScreen } = await import('./ConnectedCalendarScreen')

const press = (container: HTMLElement, testId: string) =>
  act(() => {
    container.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!.click()
  })
const count = (container: HTMLElement, testId: string) =>
  container.querySelectorAll(`[data-testid="${testId}"]`).length

beforeEach(() => {
  state.draft = null
})

test('the menu opens the add button’s composer, once', () => {
  const { container, unmount } = mount(createElement(ConnectedCalendarScreen))
  expect(count(container, 'composer')).toBe(0)

  press(container, 'menu-add-event')
  expect(count(container, 'composer')).toBe(1)
  expect(count(container, 'add-event')).toBe(0)

  // Chosen again while it is open, it is still the one composer.
  press(container, 'menu-add-event')
  expect(count(container, 'composer')).toBe(1)

  // Closed, the floating button is back and opens the same composer.
  press(container, 'composer')
  expect(count(container, 'add-event')).toBe(1)
  press(container, 'add-event')
  expect(count(container, 'composer')).toBe(1)
  unmount()
})

test('the menu does nothing while the full editor is up', () => {
  const { container, unmount } = mount(createElement(ConnectedCalendarScreen))
  press(container, 'open-event')
  expect(count(container, 'editor')).toBe(1)

  press(container, 'menu-add-event')
  expect(count(container, 'composer')).toBe(0)
  unmount()
})
