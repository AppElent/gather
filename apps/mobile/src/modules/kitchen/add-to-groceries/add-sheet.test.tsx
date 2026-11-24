// @vitest-environment jsdom
/**
 * Add to groceries sheet:
 * - Once the lines are on the list, nothing reports the add as failed (APP-672).
 * - Editing an ingredient uses `usePrompt` on iOS and `EditLineModal` on
 *   Android, registered with `openSheets` so a share never blocks (APP-713).
 */
import { act, createElement, type ReactNode, useEffect } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import {
  closeOpenSheets,
  hasOpenPrompts,
  hasOpenSheets,
} from '../../../components/openSheets'
import { mount, settle } from '../../../testing/dom'
import { forgetDrafts } from '../../../ui/composer-drafts'
import { weekGroceryLines } from '../meal-planner/week-groceries'
import { AddToGroceriesSheet } from './add-sheet'

type Props = Record<string, unknown> & { children?: ReactNode }

const state = vi.hoisted(() => ({
  os: 'ios' as 'ios' | 'android',
  realPick: false,
  sheetEffectRan: false,
  modalRenders: [] as boolean[],
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
    NativeSheet: ({ children, footer }: Props) => {
      // The real sheet presents itself from a mount effect.
      useEffect(() => {
        state.sheetEffectRan = true
        return () => {
          state.sheetEffectRan = false
        }
      }, [])
      return h('div', null, children, footer as ReactNode)
    },
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
    Modal: ({ children }: Props) => {
      state.modalRenders.push(state.sheetEffectRan)
      return h('div', { 'data-testid': 'modal' }, children)
    },
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
vi.mock('../in-stock/use-in-stock', () => ({
  useInStock: () => (state.realPick ? () => false : []),
}))
vi.mock('@gather/core/grocery-pick', async () => {
  const actual = await vi.importActual<typeof import('@gather/core/grocery-pick')>('@gather/core/grocery-pick')
  return {
  editedRead: (text: string) =>
    state.realPick
      ? actual.editedRead(text)
      : { title: text, amount: {}, edited: true },
  settleLine: (
    current: Record<string, unknown>,
    line: { key: string; former?: readonly string[] },
    value: unknown,
  ) =>
    state.realPick
      ? actual.settleLine(current, line, value)
      : { ...current, [line.key]: value },
  withEdits: (
    lines: readonly { key: string; title: string; amount: { quantity?: number } }[],
    edits: Record<string, { title: string; amount: { quantity?: number } }>,
  ) =>
    state.realPick
      ? actual.withEdits(lines as never, edits as never)
      : lines.map((line) => (edits[line.key] ? { ...line, ...edits[line.key] } : line)),
  pickRows: (args: {
    lines: readonly { key: string; title: string; amount: { quantity?: number } }[]
    ticks: Record<string, boolean>
  }) => {
    state.lastPickArgs = { lines: args.lines, ticks: args.ticks }
    if (state.realPick) return actual.pickRows(args as never)
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
  }
})
vi.mock('./use-aisles', () => ({ useAisleOf: () => () => null }))

beforeEach(() => {
  forgetDrafts()
  state.os = 'ios'
  state.realPick = false
  state.sheetEffectRan = false
  state.modalRenders = []
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
  state.modalRenders = []
  const reopened = renderSheet([
    { key: 'k1', title: 'onions', amount: { quantity: 2 } },
  ])
  expect(
    reopened.view.container.querySelector('[data-testid="groceries-edit-dialog"]'),
  ).not.toBeNull()
  expect(state.fieldValue).toBe('4 shallots')
  expect(hasOpenSheets()).toBe(true)
  // The restored editor opens only once the sheet is up, or on Android its
  // window could end up under the sheet's.
  expect(state.modalRenders.length).toBeGreaterThan(0)
  expect(state.modalRenders.every(Boolean)).toBe(true)

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

test('Android edit of a pending week-menu line stays its own row after the AI reading arrives (real grouping)', () => {
  state.os = 'android'
  state.realPick = true
  // Two meals want coriander: the first is read, the second is still being
  // read when its editor opens and is read before the person saves.
  const meal = (id: string) => ({ _id: id, recipeId: `r-${id}`, date: '2026-11-24' })
  const read = (name: string) => ({ kind: 'read' as const, via: 'ai' as const, name, quantity: 1 })
  let aiDone = false
  const weekLines = (touched: ReadonlySet<string>) =>
    weekGroceryLines({
      meals: [
        { meal: meal('ma'), servings: 1 },
        { meal: meal('mb'), servings: 1 },
      ] as never,
      recipes: new Map([
        ['r-ma', { _id: 'r-ma', title: 'A' }],
        ['r-mb', { _id: 'r-mb', title: 'B' }],
      ]),
      lines: new Map([
        ['r-ma', [{ key: '1', text: 'coriander', read: read('coriander') }]],
        [
          'r-mb',
          [
            {
              key: '1',
              text: 'coriander',
              read: aiDone ? read('coriander') : { kind: 'reading' as const },
            },
          ],
        ],
      ]),
      label: () => 'Weekmenu',
      touched,
    }).lines
  const props = () => ({
    source: { title: 'Weekmenu', subtitle: '', glyph: (() => null) as never },
    place: 'groceries:week-test',
    lines: weekLines,
    aiCount: null,
    onClose: vi.fn(),
  })
  const view = mount(createElement(AddToGroceriesSheet, props() as never))

  // The pending row (`mb:1`) renders last; edit it.
  act(() => {
    state.rowAction?.('edit')
  })
  act(() => {
    state.fieldOnChange?.('2 coriander')
  })

  // The reading finishes while the editor is open.
  aiDone = true
  view.rerender(createElement(AddToGroceriesSheet, props() as never))
  expect(view.container.querySelector('[data-testid="groceries-edit-dialog"]')).not.toBeNull()

  act(() => {
    state.buttons['groceries-edit-save']?.onPress()
  })

  // Still two rows: the corrected meal did not merge into the other meal's.
  const lines = state.lastPickArgs?.lines as { key: string; read: { quantity?: number } }[]
  expect(lines.map((line) => [line.key, line.read.quantity])).toEqual([
    ['item:coriander:count', 1],
    ['item:coriander:mb:1', 2],
  ])
  expect(state.lastPickArgs?.ticks).toEqual({ 'mb:1': true })

  view.unmount()
})
