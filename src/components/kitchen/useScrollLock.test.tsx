import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useScrollLock } from './useScrollLock'

let scrollY = 0

beforeEach(() => {
  scrollY = 300
  vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => scrollY)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.removeAttribute('style')
})

test('freezes the page where it was and puts it back on release', () => {
  const sheet = renderHook(() => useScrollLock())

  expect(document.body.style.position).toBe('fixed')
  expect(document.body.style.top).toBe('-300px')

  sheet.unmount()

  expect(document.body.style.position).toBe('')
  expect(window.scrollTo).toHaveBeenCalledWith(0, 300)
})

test('a sheet over a sheet keeps the page where the first one froze it', () => {
  const outer = renderHook(() => useScrollLock())
  // A frozen body reports no scroll offset.
  scrollY = 0
  const inner = renderHook(() => useScrollLock())

  expect(document.body.style.top).toBe('-300px')

  inner.unmount()
  expect(document.body.style.position).toBe('fixed')
  expect(window.scrollTo).not.toHaveBeenCalled()

  outer.unmount()
  expect(document.body.style.position).toBe('')
  expect(window.scrollTo).toHaveBeenCalledWith(0, 300)
})
