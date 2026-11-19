// @vitest-environment jsdom
import { act } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { mount } from '../testing/dom'
import { INVITE_CODE_PATIENCE_MS, useInviteCode } from './useInviteCode'

const server = vi.hoisted(() => ({ answer: undefined as unknown }))

vi.mock('../convex/queries', () => ({
  useQueries: () => ({ code: server.answer }),
}))

function renderHook(slug = 'kitchen') {
  const result = {
    current: undefined as unknown as ReturnType<typeof useInviteCode>,
  }
  function Probe() {
    result.current = useInviteCode(slug)
    return null
  }
  const root = mount(<Probe />)
  return { result, rerender: () => root.rerender(<Probe />) }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  server.answer = undefined
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

test('shows the code once the server answers', () => {
  const { result, rerender } = renderHook()
  expect(result.current.state).toBe('loading')

  server.answer = 'abc12345'
  rerender()
  expect(result.current).toMatchObject({ state: 'ready', code: 'abc12345' })
})

test('fails, rather than loading forever, when the code never answers', () => {
  const { result } = renderHook()

  act(() => vi.advanceTimersByTime(INVITE_CODE_PATIENCE_MS - 1))
  expect(result.current.state).toBe('loading')
  act(() => vi.advanceTimersByTime(1))
  expect(result.current.state).toBe('failed')
})

test('Retry starts the wait again, and a late code still replaces the failure', () => {
  const { result, rerender } = renderHook()
  act(() => vi.advanceTimersByTime(INVITE_CODE_PATIENCE_MS))
  expect(result.current.state).toBe('failed')

  act(() => result.current.retry())
  expect(result.current.state).toBe('loading')
  act(() => vi.advanceTimersByTime(INVITE_CODE_PATIENCE_MS))
  expect(result.current.state).toBe('failed')

  server.answer = 'abc12345'
  rerender()
  expect(result.current).toMatchObject({ state: 'ready', code: 'abc12345' })
})

test('fails at once when the server refuses', () => {
  server.answer = new Error('Not a member of that group')
  const { result } = renderHook()
  expect(result.current.state).toBe('failed')
})
