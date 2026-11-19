// @vitest-environment jsdom
import { act } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { mount } from '../../testing/dom'
import { LINGER_MS, useLingering } from './useLingering'

type Row = { id: string; done: boolean }

function renderHook(tasks: Row[], ready: boolean) {
  const result = { current: new Set<string>() as ReadonlySet<string> }
  function Probe(props: { tasks: Row[]; ready: boolean }) {
    result.current = useLingering(props.tasks, props.ready)
    return null
  }
  const view = mount(<Probe tasks={tasks} ready={ready} />)
  return {
    result,
    rerender: (next: Row[], nextReady = true) =>
      view.rerender(<Probe tasks={next} ready={nextReady} />),
  }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

test('items checked before the rows arrived never linger', () => {
  const { result, rerender } = renderHook([], false)
  rerender([
    { id: 'melk', done: true },
    { id: 'brood', done: false },
  ])
  expect([...result.current]).toEqual([])
})

test('an item checked while open lingers, then leaves', () => {
  const { result, rerender } = renderHook([{ id: 'melk', done: false }], true)
  rerender([{ id: 'melk', done: true }])
  expect([...result.current]).toEqual(['melk'])
  act(() => vi.advanceTimersByTime(LINGER_MS))
  expect([...result.current]).toEqual([])
})
