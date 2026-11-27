// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { mount } from '../../testing/dom'
import {
  completionUndo,
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

function server(latest: string | null = null) {
  return {
    latest: vi.fn(async (_taskId: string) => latest),
    undo: vi.fn(async (_completionId: string) => null as unknown),
  }
}

test('takes back the check this phone made, by the completion it heard of', async () => {
  const backend = server('older')
  const undo = completionUndo(backend)
  undo.heard('melk', 'mine')
  await expect(undo.undo('melk')).resolves.toBe(true)
  expect(backend.undo).toHaveBeenCalledWith('mine')
  expect(backend.latest).not.toHaveBeenCalled()
})

test("takes back another Member's check by the server's latest completion", async () => {
  const backend = server('theirs')
  const undo = completionUndo(backend)
  await expect(undo.undo('melk')).resolves.toBe(true)
  expect(backend.latest).toHaveBeenCalledWith('melk')
  expect(backend.undo).toHaveBeenCalledWith('theirs')
})

test('fails when the server has no completion to take back', async () => {
  const backend = server(null)
  const undo = completionUndo(backend)
  await expect(undo.undo('melk')).resolves.toBe(false)
  expect(backend.undo).not.toHaveBeenCalled()
})

test('a second tap before the check landed waits for it, then undoes it', async () => {
  const backend = server('older')
  const undo = completionUndo(backend)
  let land!: (ok: boolean) => void
  undo.checking('melk', new Promise<boolean>((resolve) => (land = resolve)))
  const tapped = undo.undo('melk')
  await Promise.resolve()
  expect(backend.undo).not.toHaveBeenCalled()
  // The check's answer names its completion before it settles.
  undo.heard('melk', 'mine')
  land(true)
  await expect(tapped).resolves.toBe(true)
  expect(backend.undo).toHaveBeenCalledWith('mine')
})

test('a second tap on a check that failed undoes nothing older', async () => {
  const backend = server('last-week')
  const undo = completionUndo(backend)
  undo.checking('melk', Promise.resolve(false))
  await expect(undo.undo('melk')).resolves.toBe(false)
  expect(backend.undo).not.toHaveBeenCalled()
})

test('an undo that failed can be tried again', async () => {
  const backend = server('mine')
  backend.undo.mockRejectedValueOnce(new Error('offline'))
  const undo = completionUndo(backend)
  undo.heard('melk', 'mine')
  await expect(undo.undo('melk')).resolves.toBe(false)
  await expect(undo.undo('melk')).resolves.toBe(true)
  expect(backend.undo).toHaveBeenCalledTimes(2)
  expect(backend.undo).toHaveBeenLastCalledWith('mine')
})

test('a tap while an undo is on its way joins it', async () => {
  const backend = server('mine')
  const undo = completionUndo(backend)
  const first = undo.undo('melk')
  const second = undo.undo('melk')
  await expect(Promise.all([first, second])).resolves.toEqual([true, true])
  expect(backend.undo).toHaveBeenCalledTimes(1)
})
