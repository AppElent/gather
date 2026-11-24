// @vitest-environment jsdom
/** Once the lines are on the list, nothing reports the add as failed (APP-672). */
import { act, createElement, type ReactNode } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { mount, settle } from '../../../testing/dom'
import { forgetDrafts } from '../../../ui/composer-drafts'
import { AddToGroceriesSheet } from './add-sheet'

type Props = Record<string, unknown> & { children?: ReactNode }

const state = vi.hoisted(() => ({
  add: vi.fn(),
  write: vi.fn(),
  submit: () => {},
}))

vi.mock('react-native', async () => {
  const h = (await import('react')).createElement
  const box = ({ children }: Props) => h('div', null, children)
  return {
    View: box,
    Text: box,
    ScrollView: box,
    Pressable: box,
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  }
})
vi.mock('@clerk/expo', () => ({ useAuth: () => ({ userId: 'u1' }) }))
vi.mock('@expo/ui/community/menu', () => ({ MenuView: () => null }))
vi.mock('convex/react', () => ({ useMutation: () => state.add }))
vi.mock('../../../convex/api', () => ({ api: { groceryLines: { add: 'add' } } }))
vi.mock('../../../components/NativeContextMenu', () => ({
  NativeContextMenu: ({ children }: Props) => children,
}))
vi.mock('../../../components/NativeSheet', async () => {
  const h = (await import('react')).createElement
  return {
    NativeSheet: ({ children, footer }: Props) =>
      h('div', null, children, footer as ReactNode),
  }
})
vi.mock('../../../feedback/haptics', () => ({
  haptics: new Proxy({}, { get: () => () => {} }),
}))
vi.mock('../../../group/GroupProvider', () => ({
  useGroup: () => ({ group: { _id: 'g1', slug: 'home' } }),
}))
vi.mock('../../../i18n', async () => {
  const { en } = await import('../../../i18n/messages/en')
  return {
    useI18n: () => ({ t: en, locale: 'en' }),
    fmt: (text: string) => text,
    plural: () => '',
  }
})
vi.mock('../../../observability/native-presentation', () => ({
  usePrompt: () => vi.fn(),
}))
vi.mock('../../../prefs/localPreference', () => ({
  lastGroceryListKey: () => 'key',
  readPreference: () => null,
  writePreference: state.write,
}))
vi.mock('../../../theme/icons', () => ({
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../../../theme/tokens', () => {
  const any: unknown = new Proxy({}, { get: () => ({}) })
  return {
    RADIUS: any,
    SIZE: any,
    SPACE: any,
    TABULAR: {},
    TYPE: any,
    useTokens: () => ({ tintOf: () => ({}) }),
  }
})
vi.mock('../../../ui/button', () => ({
  Button: ({ onPress }: { onPress: () => void }) => {
    state.submit = onPress
    return null
  },
}))
vi.mock('../../../ui/module-tile', () => ({ ModuleTile: () => null }))
vi.mock('../../../ui/section-label', () => ({ SectionLabel: () => null }))
vi.mock('../../tasks/store', () => ({
  useTaskList: () => ({ tasks: [] }),
  useTaskLists: () => [
    { _id: 'l1', name: 'AH', grocery: true, provider: 'local', writable: true },
  ],
}))
vi.mock('../in-stock/use-in-stock', () => ({ useInStock: () => [] }))
vi.mock('./pick', () => ({
  pickRows: () => ({ rows: [], lines: [{ title: 'ui' }], reading: false }),
  withEdits: (lines: unknown) => lines,
}))
vi.mock('./use-aisles', () => ({ useAisleOf: () => () => null }))

beforeEach(() => {
  forgetDrafts()
  state.add.mockReset()
  state.write.mockReset()
})

async function send() {
  const onClose = vi.fn()
  const onSending = vi.fn()
  const view = mount(
    createElement(AddToGroceriesSheet, {
      source: { title: 'Soep', subtitle: '', glyph: (() => null) as never },
      place: 'groceries:test',
      lines: [],
      aiCount: null,
      onSending,
      onClose,
    }),
  )
  act(() => {
    state.submit()
  })
  await settle()
  return { view, onClose, onSending }
}

test('a preference that cannot be written leaves the add done', async () => {
  state.add.mockResolvedValue(null)
  state.write.mockImplementation(() => {
    throw new Error('disk full')
  })
  const { view, onClose, onSending } = await send()
  expect(state.add).toHaveBeenCalledOnce()
  expect(state.write).toHaveBeenCalledOnce()
  expect(onClose).toHaveBeenCalledOnce()
  expect(onSending.mock.calls).toEqual([['sending']])
  view.unmount()
})

test('a failed add stays open and says so', async () => {
  state.add.mockRejectedValue(new Error('offline'))
  const { view, onClose, onSending } = await send()
  expect(onClose).not.toHaveBeenCalled()
  expect(state.write).not.toHaveBeenCalled()
  expect(onSending).toHaveBeenLastCalledWith('failed')
  view.unmount()
})
