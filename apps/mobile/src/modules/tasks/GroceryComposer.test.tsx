// @vitest-environment jsdom
/**
 * The grocery keyboard composer (APP-664): what the line reads shows on the
 * chips, saving keeps the card open for the next item, the status line takes
 * the last one back, and a failed save is asked about under its own key. The
 * shell, React Native and the store are replaced; the composer is real.
 */
import { en as core } from '@gather/core/messages'
import { act, createElement, type ReactNode } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { en } from '../../i18n/messages/en'
import { mount, settle } from '../../testing/dom'

type AlertButton = { text: string; onPress?: () => void }
interface FakeChip {
  id: string
  label: string
  set: boolean
  menu?: unknown[]
  onMenu?: (id: string) => void
  onPress?: () => void
}

const state = vi.hoisted(() => ({
  shell: null as null | Record<string, unknown>,
  adds: [] as { listId: string; item: Record<string, unknown>; key: string }[],
  fail: false,
  undoFails: false,
  hold: null as null | Promise<void>,
  deleted: [] as string[],
  staplesRemoved: [] as string[],
  amounts: [] as unknown[][],
  notes: [] as unknown[][],
  alerts: [] as { title: string; buttons: AlertButton[] }[],
  fresh: [] as string[],
  completions: null as null | Record<string, unknown>,
  stapleId: undefined as string | undefined,
  /** The staples the Group has: an add of one of these makes nothing. */
  stapleIds: new Set<string>(),
  /** The open item's amount on the server. */
  amount: { quantity: 1, unit: 'pak' },
  detailsRetry: undefined as undefined | (() => Promise<unknown>),
  server: new Map<string, string>(),
  focusBody: 0,
  pushed: [] as unknown[],
  lists: [] as Record<string, unknown>[],
  tasks: [] as Record<string, unknown>[],
  elsewhere: {} as Record<
    string,
    { tasks: Record<string, unknown>[]; sync: string }
  >,
  amountFails: false,
  notesFail: false,
}))

vi.mock('react-native', async () => {
  const React = await import('react')
  const h = React.createElement
  type Props = Record<string, unknown> & { children?: ReactNode }
  const dom =
    (tag: string) =>
    ({ children, testID, accessibilityLabel, onPress }: Props) =>
      h(
        tag,
        {
          'data-testid': testID as string | undefined,
          'aria-label': accessibilityLabel as string | undefined,
          onClick: onPress as (() => void) | undefined,
        },
        children,
      )
  return {
    AccessibilityInfo: { announceForAccessibility: () => {} },
    Pressable: dom('button'),
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
    Text: dom('span'),
    View: dom('div'),
  }
})
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}))
vi.mock('expo-router', () => ({
  useRouter: () => ({ push: (to: unknown) => state.pushed.push(to) }),
}))
vi.mock('@clerk/expo', () => ({ useAuth: () => ({ userId: 'user' }) }))
vi.mock('../../feedback/haptics', () => ({
  haptics: new Proxy({}, { get: () => () => {} }),
}))
vi.mock('../../group/GroupProvider', () => ({
  useGroup: () => ({ group: { _id: 'group', slug: 'home' } }),
}))
vi.mock('../../i18n', async () => {
  const { en } = await import('../../i18n/messages/en')
  return {
    useI18n: () => ({ t: en, locale: 'en' }),
    fmt: (text: string, values: Record<string, string>) =>
      text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? ''),
  }
})
vi.mock('../../observability/native-presentation', () => ({
  showAlert: (title: string, _body: unknown, buttons: AlertButton[]) =>
    state.alerts.push({ title, buttons }),
}))
vi.mock('../../theme/icons', () => ({
  MODULE_ICONS: {},
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../../theme/tokens', () => ({
  RADIUS: {},
  SIZE: {},
  SPACE: [0, 4, 8, 12, 16],
  TYPE: {},
  useTokens: () => ({}),
}))
vi.mock('../../ui/keyboard-composer', async () => {
  const React = await import('react')
  return {
    KeyboardComposer: (props: Record<string, unknown>) => {
      state.shell = props
      const title = props.renderTitle as (field: unknown) => ReactNode
      return React.createElement(
        'div',
        { 'data-testid': 'card' },
        title({
          onSubmitEditing: () => {
            ;(props.onSave as () => void)()
          },
          focusBody: () => {
            state.focusBody += 1
          },
          editable: true,
        }),
        props.above as ReactNode,
        props.status as ReactNode,
        React.createElement(
          'p',
          { 'data-testid': 'notice' },
          props.notice as string | null,
        ),
      )
    },
  }
})
vi.mock('../../ui/module-tile', () => ({ ModuleTile: () => null }))
vi.mock('./freshTasks', () => ({
  markFresh: (id: string, group: string) => state.fresh.push(`${id}:${group}`),
}))
vi.mock('./GroceryFields', async () => {
  const { formatGroceryAmount } = await import('@gather/core/groceries')
  const { en } = await import('../../i18n/messages/en')
  return {
    OFFERED_UNITS: ['stuks', 'g', 'kg', 'pak'],
    useGroceryAmountText:
      () => (quantity: number | undefined, unit: never) =>
        formatGroceryAmount(quantity, unit, 'en', en.tasks.grocery.units),
    useTypedAisle: (_list: string, name: string) =>
      name ? state.server.get(name) : undefined,
  }
})
vi.mock('./GrocerySuggestions', () => ({
  GroceryCompletions: (props: Record<string, unknown>) => {
    state.completions = props
    return null
  },
}))
vi.mock('./icons', () => ({ TASK_ICONS: {} }))
vi.mock('./QuickAddParts', async () => {
  const React = await import('react')
  return {
    QuickAddInput: ({
      line,
      parsed,
      onChangeText,
      onSubmitEditing,
    }: {
      line: string
      parsed: { parts: { start: number; end: number }[] }
      onChangeText: (text: string) => void
      onSubmitEditing: () => void
    }) =>
      React.createElement('input', {
        'data-testid': 'title',
        'data-marked': parsed.parts
          .map(({ start, end }) => line.slice(start, end))
          .join('|'),
        value: line,
        onChange: (event: { target: { value: string } }) =>
          onChangeText(event.target.value),
        onKeyDown: (event: { key: string }) => {
          if (event.key === 'Enter') onSubmitEditing()
        },
      }),
  }
})
vi.mock('./quickAdd', () => ({
  quickAddTarget: (lists: { _id: string }[], id: string) =>
    lists.find((list) => list._id === id) ?? lists[0],
}))
vi.mock('./groceryList', () => ({ groceryListsOf: (lists: unknown) => lists }))
/** Made by the first add that asks for it, as the server reports it. */
const addedStaple = () => {
  if (!state.stapleId) return undefined
  const created = !state.stapleIds.has(state.stapleId)
  state.stapleIds.add(state.stapleId)
  return { id: state.stapleId, created }
}
vi.mock('./store', () => ({
  useTaskLists: () => state.lists,
  useTaskList: (id: string) => ({
    tasks: state.elsewhere[id]?.tasks ?? state.tasks,
    list: { sync: state.elsewhere[id]?.sync ?? 'live' },
  }),
  useTaskActions: () => ({
    addComposedGrocery: async (
      listId: string,
      item: Record<string, unknown>,
      key: string,
    ) => {
      state.adds.push({ listId, item, key })
      if (state.hold) await state.hold
      if (state.fail) throw new Error('offline')
      return {
        taskId: `task-${key}`,
        staple: addedStaple(),
        retry: state.detailsRetry,
      }
    },
    addStaple: async () => addedStaple(),
    undoStaple: async (id: string) => {
      state.staplesRemoved.push(id)
    },
    deleteTask: async (id: string) => {
      if (state.undoFails) throw new Error('offline')
      state.deleted.push(id)
    },
    // The server's side: what the item has when the write runs.
    addAmount: async (id: string, more: { quantity?: number }) => {
      if (state.hold) await state.hold
      if (state.amountFails) throw new Error('offline')
      const from = state.amount
      state.amount = { ...from, quantity: from.quantity + (more.quantity ?? 1) }
      state.amounts.push([id, state.amount.quantity, state.amount.unit])
      return { from, to: state.amount }
    },
    setAmount: async (id: string, to: typeof state.amount, expected: unknown) => {
      if (state.hold) await state.hold
      if (JSON.stringify(expected) !== JSON.stringify(state.amount))
        throw { data: { kind: 'tasks:amount-changed' } }
      state.amount = to
      state.amounts.push([id, to.quantity, to.unit])
    },
    setNotes: async (...args: unknown[]) => {
      if (state.notesFail) throw new Error('offline')
      state.notes.push(args)
    },
  }),
}))

import { AddGrocery } from './GroceryComposer'

const g = core.tasks.grocery

// Drafts live in a module-level store, so each test uses lists of its own.
let run = 0
let listId = ''
beforeEach(() => {
  run += 1
  listId = `ah-${run}`
  Object.assign(state, {
    shell: null,
    adds: [],
    fail: false,
    undoFails: false,
    hold: null,
    deleted: [],
    staplesRemoved: [],
    amounts: [],
    notes: [],
    alerts: [],
    fresh: [],
    completions: null,
    stapleId: undefined,
    stapleIds: new Set<string>(),
    amount: { quantity: 1, unit: 'pak' },
    detailsRetry: undefined,
    focusBody: 0,
    pushed: [],
    tasks: [],
    elsewhere: {},
    amountFails: false,
    notesFail: false,
    server: new Map([
      ['melk', 'dairy'],
      ['kaas', 'dairy'],
      ['2 pak melk', 'dairy'],
      ['2 blik tomaten', 'tins_sauces'],
    ]),
    lists: [
      { _id: listId, name: 'Albert Heijn', writable: true },
      { _id: 'lidl', name: 'Lidl', writable: true },
      { _id: 'linked', name: 'Linked', writable: false },
    ],
  })
})

function open() {
  const view = mount(createElement(AddGrocery, { listId }))
  const find = (id: string) =>
    view.container.querySelector<HTMLElement>(`[data-testid="${id}"]`)
  const press = async (id: string) => {
    await act(async () => find(id)!.click())
    await settle()
  }
  act(() => find('add-grocery')!.click())
  const title = () => find('title') as HTMLInputElement
  const type = (text: string) =>
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!.call(title(), text)
      title().dispatchEvent(new Event('input', { bubbles: true }))
    })
  const enter = async () => {
    await act(async () => {
      title().dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      )
    })
    await settle()
  }
  const chip = (id: string) =>
    (state.shell!.chips as FakeChip[]).find((c) => c.id === id)
  const menu = async (id: string) => {
    await act(async () =>
      (state.shell!.more as { onPress: (id: string) => void }).onPress(id),
    )
    await settle()
  }
  const alert = async (text: string) => {
    const button = state.alerts.at(-1)!.buttons.find((b) => b.text === text)!
    await act(async () => button.onPress?.())
    await settle()
  }
  const add = async (text: string) => {
    type(text)
    await enter()
  }
  return { view, find, press, title, type, enter, chip, menu, alert, add }
}

test('the line shows its amount and aisle on the chips, and marks the amount', () => {
  const { type, chip, title } = open()
  expect(chip('amount')).toMatchObject({ label: g.amount, set: false })
  expect(chip('aisle')).toMatchObject({ label: g.aisle, set: false })
  type('2 pak melk')
  expect(chip('amount')).toMatchObject({ label: '2 packs', set: true })
  expect(chip('aisle')).toMatchObject({ label: g.aisles.dairy, set: true })
  expect(title().dataset.marked?.trim()).toBe('2 pak')
})

test('a tapped amount and aisle win over the line, and go with the item', async () => {
  const { type, chip, menu, enter, title } = open()
  type('2 pak melk')
  await menu('quantity:3')
  expect(chip('amount')).toMatchObject({ label: '3 packs' })
  expect(title().value).toBe('melk')
  await menu('aisle:bakery')
  expect(chip('aisle')).toMatchObject({ label: g.aisles.bakery })
  await enter()
  expect(state.adds[0]!.item).toMatchObject({
    title: 'melk',
    quantity: 3,
    unit: 'pak',
    aisle: 'bakery',
  })
})

test('untouched, the server decides the aisle', async () => {
  const { add } = open()
  await add('kaas')
  expect(state.adds[0]!.item.aisle).toBeUndefined()
})

test('choosing the aisle already shown is a choice too', async () => {
  const { type, menu, enter } = open()
  type('kaas')
  await menu('aisle:dairy')
  await enter()
  expect(state.adds[0]!.item.aisle).toBe('dairy')
})

test('a chosen aisle goes with its line only', async () => {
  const { type, menu, enter, chip } = open()
  type('kaas')
  await menu('aisle:bakery')
  await enter()
  type('kaas')
  expect(chip('aisle')!.label).toBe(g.aisles.dairy)
  await menu('aisle:frozen')
  type('melk')
  expect(chip('aisle')!.label).toBe(g.aisles.dairy)
})

test('saving keeps it open and empty, with one key per item', async () => {
  const { add, title, find } = open()
  await add('melk')
  expect(title().value).toBe('')
  expect(find('grocery-status')!.textContent).toContain('Melk added')
  await add('kaas')
  await add('2 kg appels')
  expect(find('card')).not.toBeNull()
  expect(state.adds.map(({ item }) => item.title)).toEqual([
    'melk',
    'kaas',
    'appels',
  ])
  expect(new Set(state.adds.map(({ key }) => key)).size).toBe(3)
  const status = find('grocery-status')!.textContent
  for (const name of ['Melk', 'Kaas', 'Appels']) expect(status).toContain(name)
  expect(state.fresh).toEqual(
    state.adds.map(({ key }) => `task-${key}:kitchen`),
  )
})

test('two Returns in a row save one item', async () => {
  let release = () => {}
  state.hold = new Promise((resolve) => {
    release = resolve
  })
  const { type } = open()
  type('melk')
  const save = state.shell!.onSave as () => void
  await act(async () => {
    save()
    save()
  })
  expect(state.adds).toHaveLength(1)
  release()
  await settle()
})

test('the next item is typed while the last one is on its way', async () => {
  let release = () => {}
  state.hold = new Promise((resolve) => {
    release = resolve
  })
  const { add, type, title } = open()
  await add('melk')
  type('kaa')
  await act(async () => release())
  await settle()
  expect(title().value).toBe('kaa')
})

test('undo takes back the last item, then the one before it', async () => {
  const { add, press, find } = open()
  await add('melk')
  await add('kaas')
  await press('grocery-undo')
  expect(state.deleted).toEqual([`task-${state.adds[1]!.key}`])
  expect(find('grocery-status')!.textContent).toContain('Melk added')
  await press('grocery-undo')
  expect(state.deleted).toHaveLength(2)
  expect(find('grocery-status')).toBeNull()
})

test('undo removes a staple only when this save made it', async () => {
  state.stapleIds.add('old')
  state.stapleId = 'old'
  const { type, menu, enter, press } = open()
  type('melk')
  await menu('more:staple')
  await enter()
  expect(state.adds[0]!.item.staple).toBe(true)
  await press('grocery-undo')
  expect(state.staplesRemoved).toEqual([])
  state.stapleId = 'new'
  type('kaas')
  await menu('more:staple')
  await enter()
  await press('grocery-undo')
  expect(state.staplesRemoved).toEqual(['new'])
})

test('an undo that fails keeps the item on the line and says so', async () => {
  state.undoFails = true
  const { add, press, find } = open()
  await add('melk')
  await press('grocery-undo')
  expect(find('grocery-status')!.textContent).toContain('Melk added')
  expect(find('notice')!.textContent).not.toBe('')
  state.undoFails = false
  await press('grocery-undo')
  expect(state.deleted).toHaveLength(1)
})

test('a failed save is tried again under the same key, leaving the next line', async () => {
  state.fail = true
  const { add, type, title, alert, find } = open()
  await add('2 pak melk')
  expect(state.alerts).toHaveLength(1)
  expect(state.alerts[0]!.title).toContain('Melk')
  type('kaas')
  // Fails again: asked again.
  await alert(en.composer.tryAgain)
  expect(state.alerts).toHaveLength(2)
  state.fail = false
  await alert(en.composer.tryAgain)
  expect(state.adds).toHaveLength(3)
  expect(new Set(state.adds.map(({ key }) => key)).size).toBe(1)
  expect(state.adds[2]).toEqual(state.adds[0])
  expect(title().value).toBe('kaas')
  expect(find('grocery-status')!.textContent).toContain('Melk added')
})

test('a failed save can be discarded', async () => {
  state.fail = true
  const { add, alert, find } = open()
  await add('melk')
  await alert(en.composer.discard)
  expect(state.adds).toHaveLength(1)
  expect(find('grocery-status')).toBeNull()
})

test('details that did not save are offered again, and the item stands', async () => {
  const retry = vi.fn(async () => ({}))
  state.detailsRetry = retry
  const { add, find, alert } = open()
  await add('melk')
  expect(find('grocery-status')!.textContent).toContain('Melk added')
  expect(state.alerts[0]!.title).toBe(en.composer.grocery.detailsFailed)
  await alert(en.composer.tryAgain)
  expect(retry).toHaveBeenCalledTimes(1)
})

test('the list chip switches the list and keeps it for the next item', async () => {
  const { add, chip } = open()
  expect(chip('list')!.label).toBe('Albert Heijn')
  // A list Gather cannot write to is not offered.
  expect(chip('list')!.menu).toHaveLength(2)
  await act(async () => chip('list')!.onMenu!('list:lidl'))
  expect(chip('list')!.label).toBe('Lidl')
  await add('melk')
  await add('kaas')
  expect(state.adds.map(({ listId: to }) => to)).toEqual(['lidl', 'lidl'])
})

test('the + menu holds the five entries, each with an icon', () => {
  open()
  const more = state.shell!.more as {
    items: { title: string; image?: string }[]
    allDetails: { title: string; image?: string }
  }
  const entries = [...more.items, more.allDetails]
  expect(entries.map(({ title }) => title)).toEqual([
    g.amount,
    g.aisle,
    en.composer.grocery.note,
    en.composer.grocery.staple,
    en.composer.allDetails,
  ])
  expect(entries.every(({ image }) => image)).toBe(true)
})

test('a note from the + menu is focused, and saved with the item', async () => {
  const { type, menu, enter } = open()
  type('melk')
  await menu('more:note')
  expect(state.focusBody).toBe(1)
  const body = () =>
    state.shell!.body as { visible: boolean; onChange: (text: string) => void }
  expect(body().visible).toBe(true)
  act(() => body().onChange('halfvol'))
  await enter()
  expect(state.adds[0]!.item.note).toBe('halfvol')
  expect(body().visible).toBe(false)
})

test('All details saves the item, closes, and opens it', async () => {
  const { type, menu, find } = open()
  type('melk')
  await menu('more:all')
  expect(find('card')).toBeNull()
  expect(state.pushed).toEqual([
    {
      pathname: '/all/tasks/task/[taskId]',
      params: { taskId: `task-${state.adds[0]!.key}` },
    },
  ])
})

test('closing keeps the draft, and an added item leaves nothing behind', async () => {
  const first = open()
  first.type('2 pak melk')
  await first.menu('aisle:bakery')
  await act(async () => (state.shell!.onClose as () => void)())
  expect(first.find('card')).toBeNull()
  expect(first.find('add-grocery')).not.toBeNull()
  // Away from the list, as in Reorder mode, and back.
  first.view.unmount()
  const again = open()
  expect(again.title().value).toBe('2 pak melk')
  expect(again.chip('aisle')!.label).toBe(g.aisles.bakery)
  await again.enter()
  again.view.unmount()
  expect(open().title().value).toBe('')
})

test('a completion adds its name with what was chosen', async () => {
  const { type, menu, title } = open()
  type('me')
  await menu('aisle:bakery')
  const onPick = state.completions!.onPick as (pick: unknown) => void
  await act(async () => onPick({ title: 'melk', quantity: 1, unit: 'pak' }))
  await settle()
  expect(state.adds[0]!.item).toMatchObject({
    title: 'melk',
    quantity: 1,
    unit: 'pak',
    aisle: 'bakery',
  })
  expect(title().value).toBe('')
})

test('a completion that is open gets the amount, and undo gives it back', async () => {
  const item = { id: 'open', listId, title: 'Melk', quantity: 1, unit: 'pak' }
  state.tasks = [item]
  const { type, press } = open()
  type('2 pak me')
  const onPick = state.completions!.onPick as (pick: unknown) => void
  await act(async () =>
    onPick({
      title: 'melk',
      quantity: 2,
      unit: 'pak',
      open: item,
      merged: { quantity: 3, unit: 'pak' },
    }),
  )
  await settle()
  expect(state.adds).toEqual([])
  expect(state.amounts).toEqual([['open', 3, 'pak']])
  await press('grocery-undo')
  expect(state.amounts.at(-1)).toEqual(['open', 1, 'pak'])
})

test('a completion that is open and has nothing to add says so, without undo', async () => {
  const { type, find } = open()
  type('me')
  const onPick = state.completions!.onPick as (pick: unknown) => void
  await act(async () =>
    onPick({ title: 'melk', open: { id: 'open', title: 'Melk' } }),
  )
  await settle()
  expect(find('grocery-status')).not.toBeNull()
  expect(find('grocery-undo')).toBeNull()
})

test('the card has one size', () => {
  open()
  expect(state.shell!.expandable).toBe(false)
})

test('the aisle is read with the amount, as the server reads it', () => {
  const { type, chip } = open()
  type('2 blik tomaten')
  expect(chip('aisle')!.label).toBe(g.aisles.tins_sauces)
})

const melk = () => ({
  id: 'open',
  listId,
  title: 'Melk',
  quantity: 1,
  unit: 'pak',
})

/** Taps the completion of the open `melk`, as the rows show it. */
const pickMelk = async () => {
  const onPick = state.completions!.onPick as (pick: unknown) => void
  await act(async () =>
    onPick({
      title: 'melk',
      quantity: 2,
      unit: 'pak',
      open: melk(),
      merged: { quantity: 3, unit: 'pak' },
    }),
  )
  await settle()
}

test('two quick merges onto one item add up, and each is undone', async () => {
  state.tasks = [melk()]
  let release = () => {}
  state.hold = new Promise((resolve) => {
    release = resolve
  })
  const { type, press } = open()
  type('2 pak me')
  await pickMelk()
  type('2 pak me')
  await pickMelk()
  await act(async () => release())
  await settle()
  expect(state.amounts).toEqual([
    ['open', 3, 'pak'],
    ['open', 5, 'pak'],
  ])
  await press('grocery-undo')
  expect(state.amounts.at(-1)).toEqual(['open', 3, 'pak'])
  await press('grocery-undo')
  expect(state.amounts.at(-1)).toEqual(['open', 1, 'pak'])
})

test('a merge that failed adds to the amount there is when it is tried again', async () => {
  state.tasks = [melk()]
  state.amountFails = true
  const { type, alert } = open()
  type('2 pak me')
  await pickMelk()
  state.amountFails = false
  type('2 pak me')
  await pickMelk()
  await alert(en.composer.tryAgain)
  expect(state.amounts).toEqual([
    ['open', 3, 'pak'],
    ['open', 5, 'pak'],
  ])
})

test("another Member's amount stands when a merge is undone", async () => {
  state.tasks = [melk()]
  const { type, press } = open()
  type('2 pak me')
  await pickMelk()
  // The row still shows ours: the server refuses, and theirs stands.
  state.amount = { quantity: 7, unit: 'pak' }
  type('k')
  await press('grocery-undo')
  expect(state.amounts).toHaveLength(1)
})

test('a merge is undone after switching lists, once its list is there', async () => {
  state.elsewhere = {
    [listId]: { tasks: [melk()], sync: 'live' },
    lidl: { tasks: [], sync: 'live' },
  }
  const { type, chip, press, find } = open()
  type('2 pak me')
  await pickMelk()
  state.elsewhere[listId] = { tasks: [], sync: 'loading' }
  await act(async () => chip('list')!.onMenu!('list:lidl'))
  await press('grocery-undo')
  expect(state.amounts).toHaveLength(1)
  expect(find('notice')!.textContent).toBe(en.composer.grocery.undoFailed)
  expect(find('grocery-undo')).not.toBeNull()
  state.elsewhere[listId] = { tasks: [melk()], sync: 'live' }
  type('k')
  await press('grocery-undo')
  expect(state.amounts.at(-1)).toEqual(['open', 1, 'pak'])
})

test('a merge whose note failed can be undone, and only the note is sent again', async () => {
  state.tasks = [melk()]
  state.notesFail = true
  const { type, menu, alert, find, press } = open()
  type('2 pak me')
  await menu('more:note')
  act(() =>
    (state.shell!.body as { onChange: (text: string) => void }).onChange(
      'halfvol',
    ),
  )
  await pickMelk()
  expect(find('grocery-undo')).not.toBeNull()
  expect(state.alerts.at(-1)!.title).toBe(en.composer.grocery.detailsFailed)
  state.notesFail = false
  await alert(en.composer.tryAgain)
  expect(state.amounts).toHaveLength(1)
  expect(state.notes).toEqual([['open', 'halfvol']])
  await press('grocery-undo')
  expect(state.amounts.at(-1)).toEqual(['open', 1, 'pak'])
  expect(state.notes.at(-1)).toEqual(['open', ''])
})

test('a second undo of one item waits for the first', async () => {
  state.tasks = [melk()]
  const { type, press } = open()
  type('2 pak me')
  await pickMelk()
  type('2 pak me')
  await pickMelk()
  let release = () => {}
  state.hold = new Promise((resolve) => {
    release = resolve
  })
  await press('grocery-undo')
  await press('grocery-undo')
  await act(async () => release())
  await settle()
  expect(state.amounts.slice(2)).toEqual([['open', 3, 'pak']])
  await press('grocery-undo')
  expect(state.amounts.at(-1)).toEqual(['open', 1, 'pak'])
})

test('a staple two saves share goes with the first of them', async () => {
  state.stapleId = 'shared'
  const { type, menu, enter, press } = open()
  for (let time = 0; time < 2; time += 1) {
    type('melk')
    await menu('more:staple')
    await enter()
  }
  await press('grocery-undo')
  expect(state.staplesRemoved).toEqual([])
  await press('grocery-undo')
  expect(state.staplesRemoved).toEqual(['shared'])
})

test('a merge adds to what another Member just made it', async () => {
  state.tasks = [melk()]
  // Not on the row yet.
  state.amount = { quantity: 4, unit: 'pak' }
  const { type, press } = open()
  type('2 pak me')
  await pickMelk()
  expect(state.amounts).toEqual([['open', 6, 'pak']])
  await press('grocery-undo')
  expect(state.amounts.at(-1)).toEqual(['open', 4, 'pak'])
})

test('undo keeps a staple another Member added at the same moment', async () => {
  // Not on screen when the save went, and not made by it.
  state.stapleId = 'theirs'
  state.stapleIds.add('theirs')
  const { type, menu, enter, press } = open()
  type('melk')
  await menu('more:staple')
  await enter()
  await press('grocery-undo')
  expect(state.deleted).toHaveLength(1)
  expect(state.staplesRemoved).toEqual([])
})
