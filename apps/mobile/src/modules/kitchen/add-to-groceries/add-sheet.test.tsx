// @vitest-environment jsdom
/**
 * Add to groceries sheet:
 * - Once the lines are on the list, nothing reports the add as failed (APP-672).
 * - Editing an ingredient uses `usePrompt` on iOS and `EditLineModal` on
 *   Android, registered with `openSheets` so a share never blocks (APP-713).
 */
import { act, createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import {
  closeOpenSheets,
  hasOpenPrompts,
  hasOpenSheets,
} from '../../../components/openSheets'
import { mount, settle } from '../../../testing/dom'
import { forgetDrafts } from '../../../ui/composer-drafts'
import { AddToGroceriesSheet } from './add-sheet'

type Props = Record<string, unknown> & { children?: ReactNode }

const state = vi.hoisted(() => ({
  os: 'ios' as 'ios' | 'android',
  add: vi.fn(),
  write: vi.fn(),
  showPrompt: vi.fn(),
  submit: () => {},
  rowAction: null as ((id: string) => void) | null,
  lastPickArgs: null as {
    lines: unknown
    ticks: Record<string, boolean>
  } | null,
  fieldOnChange: null as ((text: string) => void) | null,
  fieldValue: '',
  fieldLabel: '',
  buttons: {} as Record<string, { onPress: () => void; disabled?: boolean }>,
}))

vi.mock('react-native', async () => {
  const h = (await import('react')).createElement
  const box = ({ children, testID, onPress }: Props) =>
    h(
      'div',
      {
        'data-testid': testID as string | undefined,
        onClick: onPress as (() => void) | undefined,
      },
      children,
    )
  return {
    Platform: {
      get OS() {
        return state.os
      },
    },
    KeyboardAvoidingView: box,
    View: box,
    Text: box,
    ScrollView: box,
    Pressable: box,
    StyleSheet: {
      create: <T,>(styles: T) => styles,
      hairlineWidth: 1,
      absoluteFill: {},
    },
  }
})
vi.mock('@clerk/expo', () => ({ useAuth: () => ({ userId: 'u1' }) }))
vi.mock('@expo/ui/community/menu', () => ({ MenuView: () => null }))
vi.mock('convex/react', () => ({ useMutation: () => state.add }))
vi.mock('../../../convex/api', () => ({ api: { groceryLines: { add: 'add' } } }))
vi.mock('../../../components/NativeContextMenu', () => ({
  NativeContextMenu: ({
    children,
    onAction,
  }: Props & { onAction?: (id: string) => void }) => {
    state.rowAction = onAction ?? null
    return children
  },
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
  usePrompt: () => state.showPrompt,
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
    useTokens: () => ({ tintOf: () => ({}), scheme: 'light' }),
  }
})
vi.mock('../../../ui/button', () => ({
  Button: ({
    testID,
    onPress,
    disabled,
  }: {
    testID?: string
    onPress: () => void
    disabled?: boolean
  }) => {
    if (testID === 'add-to-groceries') state.submit = onPress
    if (testID) state.buttons[testID] = { onPress, disabled }
    return null
  },
}))
vi.mock('../../../ui/field', async () => {
  const h = (await import('react')).createElement
  return {
    Field: ({
      testID,
      label,
      value,
      onChangeText,
    }: {
      testID?: string
      label: string
      value?: string
      onChangeText?: (text: string) => void
    }) => {
      state.fieldLabel = label
      state.fieldValue = value ?? ''
      state.fieldOnChange = onChangeText ?? null
      return h('input', { 'data-testid': testID, value: value ?? '', readOnly: true })
    },
  }
})
vi.mock('../../../ui/modal', async () => {
  const h = (await import('react')).createElement
  return {
    Modal: ({ children }: Props) => h('div', { 'data-testid': 'modal' }, children),
  }
})
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
  editedRead: (text: string) => ({ title: text, amount: {}, edited: true }),
  settleLine: (
    current: Record<string, unknown>,
    line: { key: string },
    value: unknown,
  ) => ({ ...current, [line.key]: value }),
  withEdits: (
    lines: readonly { key: string; title: string; amount: { quantity?: number } }[],
    edits: Record<string, { title: string; amount: { quantity?: number } }>,
  ) => lines.map((line) => (edits[line.key] ? { ...line, ...edits[line.key] } : line)),
  pickRows: (args: {
    lines: readonly { key: string; title: string; amount: { quantity?: number } }[]
    ticks: Record<string, boolean>
  }) => {
    state.lastPickArgs = { lines: args.lines, ticks: args.ticks }
    return {
      rows: args.lines.map((line) => ({
        key: line.key,
        title: line.title,
        amount: line.amount,
        on: args.ticks[line.key] ?? true,
        meta: null,
      })),
      lines: [{ title: 'ui' }],
      reading: false,
    }
  },
}))
vi.mock('./use-aisles', () => ({ useAisleOf: () => () => null }))

beforeEach(() => {
  forgetDrafts()
  state.os = 'ios'
  state.add.mockReset()
  state.write.mockReset()
  state.showPrompt.mockReset()
  state.rowAction = null
  state.lastPickArgs = null
  state.fieldOnChange = null
  state.fieldValue = ''
  state.fieldLabel = ''
  state.buttons = {}
})

afterEach(() => {
  state.os = 'ios'
})

function renderSheet(lines: unknown[] = []) {
  const onClose = vi.fn()
  const onSending = vi.fn()
  const view = mount(
    createElement(AddToGroceriesSheet, {
      source: { title: 'Soep', subtitle: '', glyph: (() => null) as never },
      place: 'groceries:test',
      lines: lines as never,
      aiCount: null,
      onSending,
      onClose,
    }),
  )
  return { view, onClose, onSending }
}

async function send() {
  const result = renderSheet()
  act(() => {
    state.submit()
  })
  await settle()
  return result
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

test('editing an ingredient on iOS uses the native prompt and applies the saved text', () => {
  state.os = 'ios'
  const { view } = renderSheet([{ key: 'k1', title: 'onions', amount: { quantity: 2 } }])

  act(() => {
    state.rowAction?.('edit')
  })

  expect(state.showPrompt).toHaveBeenCalledOnce()
  expect(view.container.querySelector('[data-testid="groceries-edit-dialog"]')).toBeNull()
  expect(hasOpenSheets()).toBe(false)

  const [title, , buttons, type, initial] = state.showPrompt.mock.calls[0]
  expect([title, type, initial]).toEqual(['Edit item', 'plain-text', '2 onions'])

  act(() => {
    buttons[1].onPress('3 red onions')
  })
  expect(state.lastPickArgs?.lines).toEqual([
    expect.objectContaining({ key: 'k1', title: '3 red onions' }),
  ])
  expect(state.lastPickArgs?.ticks).toEqual({ k1: true })

  view.unmount()
})

test('editing an ingredient on Android opens the in-app modal, saves, and registers with openSheets', async () => {
  state.os = 'android'
  const { view } = renderSheet([{ key: 'k1', title: 'onions', amount: { quantity: 2 } }])

  act(() => {
    state.rowAction?.('edit')
  })

  expect(state.showPrompt).not.toHaveBeenCalled()
  expect(hasOpenPrompts()).toBe(false)
  expect(hasOpenSheets()).toBe(true)
  expect(view.container.querySelector('[data-testid="groceries-edit-dialog"]')).not.toBeNull()
  expect(state.fieldLabel).toBe('Ingredient')
  expect(state.fieldValue).toBe('2 onions')

  // Whitespace-only input disables Save.
  act(() => {
    state.fieldOnChange?.('   ')
  })
  expect(state.buttons['groceries-edit-save']?.disabled).toBe(true)

  // Typing and saving updates the row, closes the modal, and releases openSheets.
  act(() => {
    state.fieldOnChange?.('3 red onions')
  })
  expect(state.buttons['groceries-edit-save']?.disabled).toBe(false)
  act(() => {
    state.buttons['groceries-edit-save']?.onPress()
  })

  expect(view.container.querySelector('[data-testid="groceries-edit-dialog"]')).toBeNull()
  expect(hasOpenSheets()).toBe(false)
  expect(state.lastPickArgs?.lines).toEqual([
    expect.objectContaining({ key: 'k1', title: '3 red onions' }),
  ])
  expect(state.lastPickArgs?.ticks).toEqual({ k1: true })

  // A share arriving while the modal is open closes it cleanly, keeps the typed
  // edit in the sheet draft, and restores it when Add to groceries reopens.
  act(() => {
    state.rowAction?.('edit')
  })
  act(() => {
    state.fieldOnChange?.('4 shallots')
  })
  expect(hasOpenSheets()).toBe(true)
  expect(view.container.querySelector('[data-testid="groceries-edit-dialog"]')).not.toBeNull()

  let closedByShare = false
  let closing!: Promise<void>
  act(() => {
    closing = closeOpenSheets().then(() => {
      closedByShare = true
    })
  })
  await closing
  expect(closedByShare).toBe(true)
  expect(view.container.querySelector('[data-testid="groceries-edit-dialog"]')).toBeNull()
  expect(hasOpenSheets()).toBe(false)

  // Parent sheet unmounts as part of the share, then reopens with the edit kept.
  view.unmount()
  const reopened = renderSheet([
    { key: 'k1', title: 'onions', amount: { quantity: 2 } },
  ])
  expect(
    reopened.view.container.querySelector('[data-testid="groceries-edit-dialog"]'),
  ).not.toBeNull()
  expect(state.fieldValue).toBe('4 shallots')
  expect(hasOpenSheets()).toBe(true)

  // Cancelling discards the edit, closes the modal, and releases openSheets.
  act(() => {
    state.buttons['groceries-edit-cancel']?.onPress()
  })
  expect(
    reopened.view.container.querySelector('[data-testid="groceries-edit-dialog"]'),
  ).toBeNull()
  expect(hasOpenSheets()).toBe(false)

  reopened.view.unmount()
})

test('Android edit modal stays open and saves when a row key changes via `was`', () => {
  state.os = 'android'
  const onClose = vi.fn()
  const props = (lines: unknown[]) => ({
    source: { title: 'Weekmenu', subtitle: '', glyph: (() => null) as never },
    place: 'groceries:week-test',
    lines: lines as never,
    aiCount: null,
    onClose,
  })
  const view = mount(
    createElement(
      AddToGroceriesSheet,
      props([{ key: 'do:1', title: 'onions', amount: { quantity: 2 } }]),
    ),
  )

  act(() => {
    state.rowAction?.('edit')
  })
  act(() => {
    state.fieldOnChange?.('3 shallots')
  })

  // AI reading arrives and replaces `do:1` with `item:ui` carrying `was: ['do:1']`.
  view.rerender(
    createElement(
      AddToGroceriesSheet,
      props([
        {
          key: 'item:ui',
          was: ['do:1'],
          title: 'onions',
          amount: { quantity: 2 },
        },
      ]),
    ),
  )

  expect(view.container.querySelector('[data-testid="groceries-edit-dialog"]')).not.toBeNull()
  expect(state.fieldValue).toBe('3 shallots')

  act(() => {
    state.buttons['groceries-edit-save']?.onPress()
  })

  expect(view.container.querySelector('[data-testid="groceries-edit-dialog"]')).toBeNull()
  expect(hasOpenSheets()).toBe(false)
  expect(state.lastPickArgs?.lines).toEqual([
    expect.objectContaining({ key: 'item:ui', title: '3 shallots' }),
  ])
  expect(state.lastPickArgs?.ticks).toEqual({ 'item:ui': true })

  view.unmount()
})
