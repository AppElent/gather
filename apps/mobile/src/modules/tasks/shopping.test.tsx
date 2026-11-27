// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { mount } from '../../testing/dom'
import {
  SHOPPING_IDLE_MS,
  shoppingIds,
  shoppingProgress,
  shoppingRows,
  useIdleTimeout,
} from './shopping'

const TODAY = '2026-11-27'

const state = vi.hoisted(() => ({
  listener: null as null | ((state: string) => void),
}))

vi.mock('react-native', () => ({
  AppState: {
    addEventListener: (_: string, listener: (next: string) => void) => {
      state.listener = listener
      return { remove: () => (state.listener = null) }
    },
  },
}))

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

test('shows what was open when shopping began, not what was checked before', () => {
  const shown = shoppingIds(new Set(), [
    { id: 'melk', done: false },
    { id: 'brood', done: true },
  ], TODAY)
  expect([...shown]).toEqual(['melk'])
})

test('a checked row stays, and an item added or put back joins', () => {
  const start = shoppingIds(new Set(), [{ id: 'melk', done: false }], TODAY)
  const later = shoppingIds(
    start,
    [
      { id: 'melk', done: true },
      { id: 'kaas', done: false },
    ],
    TODAY,
  )
  expect([...later]).toEqual(['melk', 'kaas'])
})

test('nothing new keeps the same set', () => {
  const start = shoppingIds(new Set(), [{ id: 'melk', done: false }], TODAY)
  expect(shoppingIds(start, [{ id: 'melk', done: true }], TODAY)).toBe(start)
})

test('a repeating item checked off stays, drawn checked, until its date (APP-520)', () => {
  const repeat = { mode: 'afterDone', every: 1, unit: 'week' }
  const due = { id: 'koffie', done: false, repeat, dueDate: TODAY }
  const start = shoppingIds(new Set(), [due], TODAY)
  expect([...start]).toEqual(['koffie'])
  // Checked: it moved on a week and is still open.
  const moved = { ...due, dueDate: '2026-12-04' }
  expect(shoppingIds(start, [moved], TODAY)).toBe(start)
  expect(shoppingRows(start, [moved], TODAY)).toEqual([
    { ...moved, done: true },
  ])
  // One that already waits when shopping begins is not shown at all.
  expect([...shoppingIds(new Set(), [moved], TODAY)]).toEqual([])
})

test('progress counts the checked rows of all rows shown', () => {
  expect(
    shoppingProgress([{ done: true }, { done: false }, { done: true }]),
  ).toEqual({ done: 2, total: 3 })
})

function Idle(props: { active: boolean; onIdle: () => void; probe: { touch?: () => void } }) {
  props.probe.touch = useIdleTimeout(props.active, SHOPPING_IDLE_MS, props.onIdle)
  return null
}

test('ends after 30 minutes without a tap, once', () => {
  const onIdle = vi.fn()
  mount(<Idle active onIdle={onIdle} probe={{}} />)
  vi.advanceTimersByTime(SHOPPING_IDLE_MS - 1)
  expect(onIdle).not.toHaveBeenCalled()
  vi.advanceTimersByTime(1)
  expect(onIdle).toHaveBeenCalledTimes(1)
  vi.advanceTimersByTime(SHOPPING_IDLE_MS * 2)
  expect(onIdle).toHaveBeenCalledTimes(1)
})

test('a tap restarts the wait', () => {
  const onIdle = vi.fn()
  const probe: { touch?: () => void } = {}
  mount(<Idle active onIdle={onIdle} probe={probe} />)
  vi.advanceTimersByTime(20 * 60_000)
  probe.touch?.()
  vi.advanceTimersByTime(20 * 60_000)
  expect(onIdle).not.toHaveBeenCalled()
  vi.advanceTimersByTime(10 * 60_000)
  expect(onIdle).toHaveBeenCalledTimes(1)
})

test('time in the background counts when the app comes back', () => {
  const onIdle = vi.fn()
  mount(<Idle active onIdle={onIdle} probe={{}} />)
  // Timers do not run while the app is suspended; the clock does.
  vi.setSystemTime(Date.now() + SHOPPING_IDLE_MS + 1)
  expect(onIdle).not.toHaveBeenCalled()
  state.listener?.('active')
  expect(onIdle).toHaveBeenCalledTimes(1)
})

test('waits only while the mode is showing', () => {
  const onIdle = vi.fn()
  mount(<Idle active={false} onIdle={onIdle} probe={{}} />)
  vi.advanceTimersByTime(SHOPPING_IDLE_MS * 2)
  expect(onIdle).not.toHaveBeenCalled()
})
