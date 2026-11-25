import { renderHook } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { useStartCreating } from './useStartCreating'

/**
 * Add sends somebody to a Module's index with `?new`. The index opens its
 * create dialog once and asks the route to drop the flag, so a reload or Back
 * does not open it again.
 */

test('opens the dialog once, then asks for the flag to go', () => {
  const open = vi.fn()
  const onCreateStarted = vi.fn()
  const { rerender } = renderHook((props) => useStartCreating(props, open), {
    initialProps: { startCreating: true as boolean, onCreateStarted },
  })

  expect(open).toHaveBeenCalledOnce()
  expect(onCreateStarted).toHaveBeenCalledOnce()
  expect(open.mock.invocationCallOrder[0]).toBeLessThan(
    onCreateStarted.mock.invocationCallOrder[0] ?? 0,
  )

  // A new callback identity on the next render is not a second request.
  rerender({ startCreating: true, onCreateStarted: vi.fn() })
  expect(open).toHaveBeenCalledOnce()

  // Once the route dropped the flag, nothing reopens it.
  rerender({ startCreating: false, onCreateStarted })
  expect(open).toHaveBeenCalledOnce()
})

test('does nothing without the flag', () => {
  const open = vi.fn()
  renderHook(() => useStartCreating({}, open))
  expect(open).not.toHaveBeenCalled()
})

test('opens again when Add is used again from the index itself', () => {
  const open = vi.fn()
  const { rerender } = renderHook(
    (props) => useStartCreating(props, open),
    { initialProps: { startCreating: true as boolean } },
  )
  rerender({ startCreating: false })
  rerender({ startCreating: true })
  expect(open).toHaveBeenCalledTimes(2)
})
