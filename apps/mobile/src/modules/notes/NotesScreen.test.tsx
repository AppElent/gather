// @vitest-environment jsdom
/**
 * The notes list (APP-730): a virtualized list of pinned and recent notes that
 * asks for the next page as it nears its end, and says so when it is empty or
 * still loading.
 *
 * React Native is replaced by DOM stand-ins; the list stub draws what the real
 * one is given (rows, the empty and footer components) and keeps its
 * `onEndReached` for the test to call.
 */
import type { ReactNode } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { mount } from '../../testing/dom'
import { Notes } from './NotesScreen'

const state = vi.hoisted(() => ({
  list: {} as Record<string, unknown>,
  loadMore: vi.fn(),
  onEndReached: undefined as (() => void) | undefined,
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
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
    FlatList: ({
      data,
      renderItem,
      keyExtractor,
      ListEmptyComponent,
      ListFooterComponent,
      onEndReached,
    }: {
      data: unknown[]
      renderItem: (info: { item: unknown; index: number }) => ReactNode
      keyExtractor: (item: unknown) => string
      ListEmptyComponent?: ReactNode
      ListFooterComponent?: ReactNode
      onEndReached?: () => void
    }) => {
      state.onEndReached = onEndReached
      return h(
        'div',
        { 'data-testid': 'list' },
        data.length === 0
          ? ListEmptyComponent
          : data.map((item, index) =>
              h('div', { key: keyExtractor(item) }, renderItem({ item, index })),
            ),
        ListFooterComponent,
      )
    },
  }
})
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
vi.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: () => {} }),
}))
vi.mock('../../i18n', async () => {
  const { en } = await import('../../i18n/messages/en')
  return { useI18n: () => ({ t: en, locale: 'en' }) }
})
vi.mock('../../feedback/haptics', () => ({
  haptics: new Proxy({}, { get: () => () => {} }),
}))
vi.mock('../../theme/tokens', () => ({
  RADIUS: { card: 12 },
  TABULAR: {},
  TYPE: {},
  useTokens: () => ({}),
}))
vi.mock('../../components/LoadingSkeleton', () => ({
  LoadingSkeleton: ({ label }: { label: string }) => (
    <div data-testid="loading">{label}</div>
  ),
}))
vi.mock('../../components/NativeContextMenu', () => ({
  NativeContextMenu: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('../../ui/button', () => ({
  Button: ({ label, testID }: { label: string; testID: string }) => (
    <button type="button" data-testid={testID}>
      {label}
    </button>
  ),
}))
vi.mock('../../ui/keyboard-composer', () => ({ ADD_BUTTON_CLEARANCE: 84 }))
vi.mock('../../ui/module-header-buttons', () => ({
  ModuleHeaderButtons: () => null,
}))
vi.mock('../../ui/section-label', () => ({
  SectionLabel: ({ children }: { children: ReactNode }) => (
    <h2>{children}</h2>
  ),
}))
vi.mock('./AddNoteComposer', () => ({ AddNote: () => null }))
vi.mock('./notesActions', () => ({ confirmDeleteNote: () => {} }))
vi.mock('./store', () => ({
  useNotesList: () => ({ ...state.list, loadMore: state.loadMore }),
  useNoteActions: () => ({ togglePin: () => {}, deleteNote: () => {} }),
}))

const note = (id: string, title: string, pinned = false) => ({
  id,
  title,
  body: `Body of ${title}`,
  pinned,
  updatedAt: 1,
  updatedByName: null,
  updatedByMe: false,
})
const list = (over: Record<string, unknown> = {}) => ({
  loading: false,
  pinned: [],
  rest: [],
  hasMore: false,
  loadingMore: false,
  ...over,
})
const q = (view: { container: HTMLElement }, id: string) =>
  view.container.querySelector(`[data-testid="${id}"]`)

beforeEach(() => {
  state.loadMore.mockClear()
  state.onEndReached = undefined
  state.list = list()
})

test('draws pinned notes, then recent ones, each under its heading', () => {
  state.list = list({
    pinned: [note('p', 'Wifi', true)],
    rest: [note('a', 'Boiler'), note('b', 'Trip')],
  })
  const view = mount(<Notes />)
  const text = view.container.textContent ?? ''
  expect(text.indexOf('Pinned')).toBeLessThan(text.indexOf('Wifi'))
  expect(text.indexOf('Wifi')).toBeLessThan(text.indexOf('Recent'))
  expect(text.indexOf('Recent')).toBeLessThan(text.indexOf('Boiler'))
  expect(text.indexOf('Boiler')).toBeLessThan(text.indexOf('Trip'))
  expect(q(view, 'note-p')).not.toBeNull()
  expect(q(view, 'notes-show-more')).toBeNull()
  view.unmount()
})

test('a list with no pinned notes has no Pinned heading', () => {
  state.list = list({ rest: [note('a', 'Boiler')] })
  const view = mount(<Notes />)
  expect(view.container.textContent).not.toContain('Pinned')
  view.unmount()
})

test('asks for the next page at the end of the list, and only while there is one', () => {
  state.list = list({ rest: [note('a', 'Boiler')], hasMore: true })
  const view = mount(<Notes />)
  state.onEndReached?.()
  expect(state.loadMore).toHaveBeenCalledTimes(1)
  expect(q(view, 'notes-show-more')).not.toBeNull()
  view.unmount()

  state.loadMore.mockClear()
  state.list = list({ rest: [note('a', 'Boiler')], hasMore: true, loadingMore: true })
  const loading = mount(<Notes />)
  state.onEndReached?.()
  expect(state.loadMore).not.toHaveBeenCalled()
  loading.unmount()

  state.list = list({ rest: [note('a', 'Boiler')] })
  const done = mount(<Notes />)
  state.onEndReached?.()
  expect(state.loadMore).not.toHaveBeenCalled()
  done.unmount()
})

test('says it is loading, then says there are no notes', () => {
  state.list = list({ loading: true, pinned: [note('p', 'Wifi', true)] })
  const loading = mount(<Notes />)
  expect(q(loading, 'loading')).not.toBeNull()
  expect(q(loading, 'note-p')).toBeNull()
  loading.unmount()

  state.list = list()
  const empty = mount(<Notes />)
  expect(q(empty, 'loading')).toBeNull()
  expect(empty.container.textContent).toContain('No notes yet')
  empty.unmount()
})
