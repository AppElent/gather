// @vitest-environment jsdom
/**
 * Calendar's selected date follows a Group time zone change when the person
 * was sitting on today, and stays put when they had picked another day
 * (APP-834).
 */
import type { ReactNode } from 'react'
import { act, createElement } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'
import { en } from '../../i18n/messages/en'
import { mount } from '../../testing/dom'

const captured = vi.hoisted(() => ({
  headerActiveDate: '' as string,
  headerToday: '' as string,
  agendaSelectedDate: '' as string,
  onSelectDate: undefined as ((date: string) => void) | undefined,
}))

vi.mock('react-native', async () => {
  const React = await import('react')
  const h = React.createElement
  type Props = Record<string, unknown> & { children?: ReactNode }
  const dom =
    (tag: string) =>
    ({ children, testID }: Props) =>
      h(tag, { 'data-testid': testID as string | undefined }, children)
  return {
    View: dom('div'),
    Text: dom('span'),
    Pressable: dom('button'),
    Platform: { OS: 'ios' },
    StatusBar: { currentHeight: 0 },
    StyleSheet: { create: <T,>(styles: T) => styles },
  }
})
vi.mock('expo-constants', () => ({ default: { statusBarHeight: 0 } }))
vi.mock('expo-router', () => ({ Stack: { Screen: () => null } }))
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
vi.mock('../../i18n', () => ({
  useI18n: () => ({ t: en, locale: 'en' }),
}))
vi.mock('../../theme/tokens', () => ({
  RADIUS: { pill: 999 },
  TYPE: { bodyStrong: {}, footnoteStrong: {} },
  useTokens: () => ({
    ground: '#fff',
    surface2: '#eee',
    ink: '#111',
    accentText: '#080',
  }),
}))
vi.mock('./CalendarHeader', () => ({
  CalendarHeader: (props: {
    activeDate: string
    today: string
    onSelectDate: (date: string) => void
  }) => {
    captured.headerActiveDate = props.activeDate
    captured.headerToday = props.today
    captured.onSelectDate = props.onSelectDate
    return null
  },
}))
vi.mock('./CalendarAgenda', () => ({
  CalendarAgenda: (props: { selectedDate: string }) => {
    captured.agendaSelectedDate = props.selectedDate
    return null
  },
}))

const { CalendarScreen } = await import('./CalendarScreen')

const baseProps = {
  data: { calendars: [], events: [], people: [], hiddenCalendarIds: [] },
  onActiveDate: vi.fn(),
  onEvent: vi.fn(),
  onDeleteEvent: vi.fn(),
  preferredView: 'week' as const,
  sourceNodes: null,
  onViewChange: vi.fn(),
  onOpenCalendars: vi.fn(),
  onOpenPeople: vi.fn(),
  onAddEvent: vi.fn(),
  hasDraft: false,
  onResumeDraft: vi.fn(),
}

beforeEach(() => {
  captured.headerActiveDate = ''
  captured.headerToday = ''
  captured.agendaSelectedDate = ''
  captured.onSelectDate = undefined
  baseProps.onActiveDate.mockClear()
})

test('selected date follows a zone change when sitting on today', () => {
  const view = mount(
    createElement(CalendarScreen, { ...baseProps, today: '2026-11-24' }),
  )
  expect(captured.headerActiveDate).toBe('2026-11-24')
  expect(captured.agendaSelectedDate).toBe('2026-11-24')

  view.rerender(
    createElement(CalendarScreen, { ...baseProps, today: '2026-11-25' }),
  )
  expect(captured.headerToday).toBe('2026-11-25')
  expect(captured.headerActiveDate).toBe('2026-11-25')
  expect(captured.agendaSelectedDate).toBe('2026-11-25')
  expect(baseProps.onActiveDate).toHaveBeenLastCalledWith('2026-11-25')
  view.unmount()
})

test('a date the person chose stays put when the zone changes', () => {
  const view = mount(
    createElement(CalendarScreen, { ...baseProps, today: '2026-11-24' }),
  )
  act(() => {
    captured.onSelectDate?.('2026-12-10')
  })
  expect(captured.headerActiveDate).toBe('2026-12-10')

  view.rerender(
    createElement(CalendarScreen, { ...baseProps, today: '2026-11-25' }),
  )
  expect(captured.headerToday).toBe('2026-11-25')
  expect(captured.headerActiveDate).toBe('2026-12-10')
  expect(captured.agendaSelectedDate).toBe('2026-12-10')
  view.unmount()
})
