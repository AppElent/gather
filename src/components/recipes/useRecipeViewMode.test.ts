import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { useRecipeViewMode } from './useRecipeViewMode'

afterEach(() => {
  window.localStorage.clear()
})

test('defaults to grid mode', () => {
  const { result } = renderHook(() => useRecipeViewMode())
  expect(result.current[0]).toBe('grid')
})

test('reads a previously stored mode on mount', () => {
  window.localStorage.setItem('gather.recipes.viewMode', 'compact')
  const { result } = renderHook(() => useRecipeViewMode())
  expect(result.current[0]).toBe('compact')
})

test('setMode updates state and persists to localStorage', () => {
  const { result } = renderHook(() => useRecipeViewMode())
  act(() => {
    result.current[1]('banner')
  })
  expect(result.current[0]).toBe('banner')
  expect(window.localStorage.getItem('gather.recipes.viewMode')).toBe('banner')
})
