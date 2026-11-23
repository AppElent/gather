import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { useEnergyToday } from './energyShared'

afterEach(() => {
  vi.useRealTimers()
})

test('today moves on at Amsterdam midnight while the page stays open', () => {
  vi.useFakeTimers()
  // 23:59 on 30 November in Amsterdam.
  vi.setSystemTime(new Date('2026-11-30T22:59:30Z'))
  const { result } = renderHook(() => useEnergyToday())
  expect(result.current).toMatchObject({ today: '2026-11-30', month: '2026-11' })
  const before = result.current

  act(() => {
    vi.advanceTimersByTime(20_000)
  })
  expect(result.current).toBe(before)

  act(() => {
    vi.advanceTimersByTime(60_000)
  })
  expect(result.current).toMatchObject({ today: '2026-12-01', month: '2026-12' })
})
