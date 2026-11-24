// @vitest-environment jsdom
/**
 * The item screen's amount (APP-671): every change names the amount it was
 * made over, so it never writes over another Member's. React Native, the
 * store and the theme are replaced; the component is real.
 */
import { act, createElement, type ReactNode, useState } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { mount, settle } from '../../testing/dom'
import { GroceryFields } from './GroceryFields'
import type { Task } from './types'

const state = vi.hoisted(() => ({
  os: 'ios' as 'ios' | 'android',
  type: (_text: string) => {},
  submit: () => {},
  blur: () => {},
  writes: [] as { to: unknown; expected: unknown; land: () => void; fail: () => void }[],
  /** The aisle menu's choice handler, as the native menu calls it. */
  pickAisle: (_id: string) => {},
  aisleFails: false,
  moves: [] as [string, string][],
  alerts: [] as string[],
}))

vi.mock('react-native', async () => {
  const React = await import('react')
  type Props = Record<string, unknown> & { children?: ReactNode }
  const dom =
    (tag: string) =>
    ({
      children,
      testID,
      onPress,
      accessibilityRole,
      accessibilityState,
      accessibilityValue,
    }: Props) => {
      const a11yState = accessibilityState as
        | { selected?: boolean; checked?: boolean; disabled?: boolean }
        | undefined
      const a11yValue = accessibilityValue as { text?: string } | undefined
      return React.createElement(
        tag,
        {
          'data-testid': testID as string,
          role: accessibilityRole as string | undefined,
          'aria-selected': a11yState?.selected,
          'aria-checked': a11yState?.checked,
          'aria-disabled': a11yState?.disabled,
          'aria-valuetext': a11yValue?.text,
          onClick: onPress as () => void,
        },
        children,
      )
    }
  return {
    Platform: {
      get OS() {
        return state.os
      },
    },
    View: dom('div'),
    Text: dom('span'),
    Pressable: dom('button'),
    TextInput: ({ testID, value, onChangeText, onBlur, onSubmitEditing }: Props) => {
      state.type = onChangeText as (text: string) => void
      state.submit = onSubmitEditing as () => void
      state.blur = onBlur as () => void
      return React.createElement('input', {
        'data-testid': testID as string,
        value: value as string,
        readOnly: true,
      })
    },
    StyleSheet: { create: <T,>(styles: T) => styles },
  }
})
vi.mock('@expo/ui/community/menu', () => ({
  MenuView: ({
    testID,
    onPressAction,
  }: {
    testID?: string
    onPressAction: (event: { nativeEvent: { event: string } }) => void
  }) => {
    if (testID === 'grocery-aisle')
      state.pickAisle = (id) => onPressAction({ nativeEvent: { event: id } })
    return null
  },
}))
vi.mock('../../observability/native-presentation', () => ({
  showAlert: (title: string) => state.alerts.push(title),
}))
vi.mock('../../feedback/haptics', () => ({
  haptics: new Proxy({}, { get: () => () => {} }),
}))
vi.mock('../../group/GroupProvider', () => ({
  useGroup: () => ({ group: { slug: 'jansen' } }),
}))
vi.mock('../../i18n', async () => {
  const { en } = await import('../../i18n/messages/en')
  const { fmt } = await import('@gather/core/i18n')
  return { fmt, useI18n: () => ({ t: en, locale: 'en' }) }
})
vi.mock('../../theme/icons', () => ({
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../../theme/tokens', () => ({
  SPACE: [0, 4, 8, 12, 16, 20, 24],
  TABULAR: {},
  TYPE: new Proxy({}, { get: () => ({}) }),
  useTokens: () => ({}),
}))
vi.mock('../../ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('../kitchen/add-to-groceries/use-aisles', () => ({
  useAisleOf: () => () => undefined,
}))
vi.mock('./store', () => ({
  useTaskActions: () => ({
    setAisle: async (id: string, aisle: string) => {
      state.moves.push([id, aisle])
      if (state.aisleFails) throw new Error('offline')
    },
    setAmount: (_id: string, to: unknown, expected: unknown) =>
      new Promise<void>((resolve, reject) => {
        state.writes.push({
          to,
          expected,
          land: resolve,
          fail: () => reject(new Error('changed')),
        })
      }),
  }),
}))

const pak = (quantity: number) => ({ quantity, unit: 'pak' as const })
const melk = { id: 'melk', title: 'Melk', done: false, ...pak(1) } as Task

beforeEach(() => {
  state.os = 'ios'
  state.writes = []
  state.aisleFails = false
  state.moves = []
  state.alerts = []
})

/** The keyboard's Done: the field submits, then blurs. */
const done = () => {
  act(() => state.submit())
  act(() => state.blur())
}

function open(item: Task = melk) {
  // The harness mounts once; the row under it is told of a change here.
  let show: (task: Task) => void = () => {}
  const Screen = () => {
    const [task, setTask] = useState(item)
    show = setTask
    return createElement(GroceryFields, { task, writable: true })
  }
  const view = mount(createElement(Screen))
  const find = (id: string) =>
    view.container.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
  return {
    show: (task: Task) => act(() => show(task)),
    unit: (unit: string) => act(() => find(`grocery-unit-${unit}`).click()),
    clear: () => act(() => find('grocery-clear-amount').click()),
    find,
    increase: () => find('grocery-increase').click(),
    more: () => act(() => find('grocery-increase').click()),
    shown: () => (find('grocery-quantity') as HTMLInputElement).value,
  }
}

test('a quick second step follows the first, though the row is behind', async () => {
  const { more } = open()
  more()
  more()
  expect(state.writes).toHaveLength(1)
  await act(async () => state.writes[0]!.land())
  await settle()
  expect(state.writes.map(({ to, expected }) => [expected, to])).toEqual([
    [pak(1), pak(2)],
    [pak(2), pak(3)],
  ])
})

test('a refused step shows the amount there is, and the next starts from it', async () => {
  const { more, shown } = open()
  more()
  expect(shown()).toBe('2')
  await act(async () => state.writes[0]!.fail())
  await settle()
  expect(shown()).toBe('1')
  more()
  expect(state.writes[1]).toMatchObject({ expected: pak(1), to: pak(2) })
})

test('what followed a refused step is not sent: it could write over the other amount', async () => {
  const { more, clear, shown } = open()
  more()
  clear()
  await act(async () => state.writes[0]!.fail())
  await settle()
  expect(state.writes).toHaveLength(1)
  expect(shown()).toBe('1')
})

test('a step after the first landed still follows the one on its way', async () => {
  const { more, show, shown } = open()
  more()
  more()
  await act(async () => state.writes[0]!.land())
  await settle()
  // The row shows the first, while the second is on its way.
  show({ ...melk, ...pak(2) })
  expect(shown()).toBe('3')
  more()
  await act(async () => state.writes[1]!.land())
  await settle()
  expect(state.writes[2]).toMatchObject({ expected: pak(3), to: pak(4) })
})

test('a step after a new unit keeps that unit', async () => {
  const { more, unit } = open()
  unit('fles')
  more()
  await act(async () => state.writes[0]!.land())
  await settle()
  expect(state.writes[1]).toMatchObject({
    expected: { quantity: 1, unit: 'fles' },
    to: { quantity: 2, unit: 'fles' },
  })
})

test('text typed while a unit is on its way stays', async () => {
  const { unit, show, shown } = open()
  unit('fles')
  act(() => state.type('5'))
  show({ ...melk, unit: 'fles' })
  await act(async () => state.writes[0]!.land())
  await settle()
  expect(shown()).toBe('5')
})

test("another Member's amount replaces text not committed yet", async () => {
  const { show, shown } = open()
  act(() => state.type('5'))
  show({ ...melk, ...pak(3) })
  expect(shown()).toBe('3')
})

test("another Member's unit replaces text typed for the one refused", async () => {
  const { unit, show, shown } = open()
  unit('g')
  act(() => state.type('500'))
  show({ ...melk, unit: 'kg' })
  await act(async () => state.writes[0]!.fail())
  await settle()
  expect(shown()).toBe('1')
  done()
  expect(state.writes).toHaveLength(1)
})

test('Done after a unit on an item with no amount keeps its 1', async () => {
  const { unit, shown } = open({ ...melk, quantity: undefined, unit: undefined })
  unit('fles')
  expect(shown()).toBe('1')
  done()
  await act(async () => state.writes[0]!.land())
  await settle()
  expect(state.writes).toHaveLength(1)
})

test('Done on text that is no amount keeps the step on its way', async () => {
  const { more, shown } = open()
  more()
  act(() => state.type('abc'))
  done()
  expect(shown()).toBe('2')
  await act(async () => state.writes[0]!.land())
  await settle()
  expect(state.writes).toHaveLength(1)
})

test('Done sends what was typed once', async () => {
  open()
  act(() => state.type('5'))
  done()
  await act(async () => state.writes[0]!.land())
  await settle()
  expect(state.writes.map(({ expected, to }) => [expected, to])).toEqual([
    [pak(1), pak(5)],
  ])
})

test('Done on an emptied field clears the quantity', () => {
  open()
  act(() => state.type(''))
  done()
  expect(state.writes[0]).toMatchObject({
    expected: pak(1),
    to: { quantity: null, unit: 'pak' },
  })
})

/** After the refusal, before the field shows the other Member's amount. */
const refusedThen = (tap: () => void) =>
  act(async () => {
    state.writes[0]!.fail()
    for (let turn = 0; turn < 10; turn++) await Promise.resolve()
    tap()
  })

test("Done at the refusal does not send text under another Member's unit", async () => {
  const { unit, show, shown } = open()
  unit('g')
  act(() => state.type('500'))
  show({ ...melk, unit: 'kg' })
  await refusedThen(() => {
    state.submit()
    state.blur()
  })
  await settle()
  expect(state.writes).toHaveLength(1)
  expect(shown()).toBe('1')
})

test("a step at the refusal starts from another Member's amount", async () => {
  const { more, increase, show } = open()
  more()
  show({ ...melk, ...pak(5) })
  await refusedThen(increase)
  expect(state.writes[1]).toMatchObject({ expected: pak(5), to: pak(6) })
})

test("a keystroke at the refusal does not move text to another Member's unit", async () => {
  const { unit, show } = open()
  unit('g')
  act(() => state.type('500'))
  show({ ...melk, unit: 'kg' })
  await refusedThen(() => state.type('5000'))
  done()
  expect(state.writes).toHaveLength(1)
})

test('Done before the row shows the unit that landed leaves no unsent text', async () => {
  const { unit, show, shown } = open()
  unit('g')
  act(() => state.type('500'))
  await act(async () => {
    state.writes[0]!.land()
    for (let turn = 0; turn < 10; turn++) await Promise.resolve()
    state.submit()
    show({ ...melk, unit: 'g' })
  })
  await settle()
  expect(state.writes).toHaveLength(1)
  expect(shown()).toBe('1')
})

/** Taps handled before the field renders again, then the first write lands. */
const atOnce = async (taps: () => void) => {
  act(taps)
  await act(async () => state.writes[0]!.land())
  await settle()
}

test('two steps before a render both count', async () => {
  const { increase } = open()
  await atOnce(() => {
    increase()
    increase()
  })
  expect(state.writes[1]).toMatchObject({ expected: pak(2), to: pak(3) })
})

test('a unit before the render of a step keeps the step', async () => {
  const { increase, find } = open()
  await atOnce(() => {
    increase()
    find('grocery-unit-g').click()
  })
  expect(state.writes[1]).toMatchObject({ to: { quantity: 2, unit: 'g' } })
})

test('a step before the render of a clear starts from nothing', async () => {
  const { increase, find } = open({ ...melk, ...pak(5) } as Task)
  await atOnce(() => {
    find('grocery-clear-amount').click()
    increase()
  })
  expect(state.writes[1]).toMatchObject({
    expected: { quantity: null, unit: null },
    to: { quantity: 2, unit: null },
  })
})

test('Done before the render of what was typed sends it', () => {
  open()
  act(() => {
    state.type('5')
    state.submit()
    state.blur()
  })
  expect(state.writes.map(({ to }) => to)).toEqual([pak(5)])
})

test('a failed aisle move is said, not only felt (APP-621)', async () => {
  state.aisleFails = true
  open()
  await act(async () => state.pickAisle('dairy'))
  await settle()
  expect(state.moves).toEqual([['melk', 'dairy']])
  expect(state.alerts).toEqual(['Could not move it to Dairy and eggs. Try again.'])
})

test('an aisle move that lands says nothing', async () => {
  open()
  await act(async () => state.pickAisle('dairy'))
  await settle()
  expect(state.moves).toEqual([['melk', 'dairy']])
  expect(state.alerts).toEqual([])
})

test('unit pills announce as radio buttons on iOS and Android (APP-697)', () => {
  state.os = 'ios'
  const ios = mount(createElement(GroceryFields, { task: melk, writable: false }))
  const iosSelected = ios.container.querySelector('[data-testid="grocery-unit-pak"]')
  const iosOther = ios.container.querySelector('[data-testid="grocery-unit-fles"]')
  expect(iosSelected?.getAttribute('role')).toBe('button')
  expect(iosSelected?.getAttribute('aria-selected')).toBe('true')
  expect(iosSelected?.getAttribute('aria-disabled')).toBe('true')
  expect(iosSelected?.getAttribute('aria-valuetext')).toBe('radio button')
  expect(iosOther?.getAttribute('aria-selected')).toBe('false')
  ios.unmount()

  state.os = 'android'
  const android = mount(createElement(GroceryFields, { task: melk, writable: true }))
  const androidSelected = android.container.querySelector('[data-testid="grocery-unit-pak"]')
  const androidOther = android.container.querySelector('[data-testid="grocery-unit-fles"]')
  expect(androidSelected?.getAttribute('role')).toBe('radio')
  expect(androidSelected?.getAttribute('aria-checked')).toBe('true')
  expect(androidSelected?.getAttribute('aria-disabled')).toBe('false')
  expect(androidOther?.getAttribute('aria-checked')).toBe('false')
  android.unmount()
})
