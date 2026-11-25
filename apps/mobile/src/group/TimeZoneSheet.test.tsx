// @vitest-environment jsdom
/** The phone's zone picker (APP-779): every zone, found by typing. */
import { act, createElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { mount } from '../testing/dom'
import { TimeZoneSheet } from './TimeZoneSheet'

const search = vi.hoisted(() => ({ type: (_text: string) => {} }))
vi.mock('react-native', () => ({
  StyleSheet: { create: (s: unknown) => s, hairlineWidth: 1 },
  Platform: { OS: 'ios' },
  Text: ({ children }: { children?: ReactNode }) =>
    createElement('span', null, children),
  View: ({ children }: { children?: ReactNode }) =>
    createElement('div', null, children),
  Pressable: (props: {
    children?: ReactNode
    testID: string
    onPress: () => void
    accessibilityState?: { selected?: boolean }
  }) =>
    createElement(
      'button',
      {
        type: 'button',
        'data-testid': props.testID,
        'data-selected': String(props.accessibilityState?.selected),
        onClick: props.onPress,
      },
      props.children,
    ),
  FlatList: (props: {
    data: string[]
    renderItem: (row: { item: string; index: number }) => ReactElement
    ListEmptyComponent: ReactElement
  }) =>
    props.data.length === 0
      ? props.ListEmptyComponent
      : props.data.map((item, index) =>
          createElement('div', { key: item }, props.renderItem({ item, index })),
        ),
}))
vi.mock('../components/NativeSheet', () => ({
  NativeSheet: ({ children }: { children?: ReactNode }) => children,
}))
vi.mock('../components/SearchField', () => ({
  SearchField: ({ onChangeText }: { onChangeText: (text: string) => void }) => {
    search.type = onChangeText
    return null
  },
}))
vi.mock('../i18n', async () => {
  const { en } = await import('../i18n/messages/en')
  const { fmt } = await import('@gather/core/i18n')
  return { useI18n: () => ({ t: en, locale: 'en' }), fmt }
})
vi.mock('../theme/icons', () => ({ UI_ICONS: { Check: () => null } }))
vi.mock('../theme/tokens', () => ({
  SIZE: {},
  SPACE: {},
  TYPE: {},
  useTokens: () => ({}),
}))
vi.mock('../ui/inset-list', () => ({
  InsetListItem: ({ children }: { children?: ReactNode }) => children,
  useInsetSeparator: () => ({}),
}))

const onChoose = vi.fn()
const row = (zone: string) =>
  document.querySelector<HTMLElement>(`[data-testid="time-zone-${zone}"]`)

beforeEach(() => {
  onChoose.mockClear()
  // Hermes has no `supportedValuesOf`.
  vi.spyOn(Intl, 'supportedValuesOf').mockImplementation(() => {
    throw new TypeError('not a function')
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

test('finds any zone by typing, and hands it back', () => {
  mount(createElement(TimeZoneSheet, { selected: 'Asia/Tokyo', onChoose, onClose: () => {} }))
  expect(row('UTC')).not.toBeNull()
  expect(row('Asia/Tokyo')?.dataset.selected).toBe('true')
  act(() => search.type('new york'))
  expect(document.querySelectorAll('button')).toHaveLength(1)
  row('America/New_York')?.click()
  expect(onChoose).toHaveBeenCalledWith('America/New_York')
})

test('rows read as a place and a zone, and either finds it', () => {
  mount(createElement(TimeZoneSheet, { selected: undefined, onChoose, onClose: () => {} }))
  expect(row('Asia/Kolkata')?.textContent).toContain('Kolkata')
  expect(row('Asia/Kolkata')?.textContent).toContain('India Standard Time')
  expect(document.body.textContent).not.toContain('Asia/Kolkata')
  act(() => search.type('india standard'))
  expect(row('Asia/Kolkata')).not.toBeNull()
  expect(row('Asia/Tokyo')).toBeNull()
})

test('says when nothing matches', () => {
  mount(createElement(TimeZoneSheet, { selected: undefined, onChoose, onClose: () => {} }))
  act(() => search.type('olympus '))
  expect(document.body.textContent).toContain('No time zone matches “olympus”.')
})
