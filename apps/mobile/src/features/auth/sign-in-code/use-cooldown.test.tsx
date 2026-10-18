// @vitest-environment jsdom
import { act } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { mount } from '../../../testing/dom'
import { useCooldown } from './use-cooldown'

function renderHook(seconds: number) {
  const result = {
    current: undefined as unknown as ReturnType<typeof useCooldown>,
  }
  function Probe() {
    result.current = useCooldown(seconds)
    return null
  }
  mount(<Probe />)
  return result
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

test('is idle until armed, then counts whole seconds down to zero', () => {
  const result = renderHook(30)
  expect(result.current.remaining).toBe(0)

  act(() => result.current.start())
  expect(result.current.remaining).toBe(30)

  act(() => vi.advanceTimersByTime(10_000))
  expect(result.current.remaining).toBe(20)

  act(() => vi.advanceTimersByTime(20_000))
  expect(result.current.remaining).toBe(0)
})

test('arming again restarts the clock', () => {
  const result = renderHook(30)
  act(() => result.current.start())
  act(() => vi.advanceTimersByTime(25_000))
  act(() => result.current.start())
  expect(result.current.remaining).toBe(30)
})
