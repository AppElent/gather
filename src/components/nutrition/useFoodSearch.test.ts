import { expect, test } from 'vitest'
import {
  OFF_SEARCH_MIN_INTERVAL_MS,
  offSearchWait,
  shouldSearchOff,
} from './useFoodSearch'

test('Open Food Facts is not queried while local results are still loading', () => {
  expect(shouldSearchOff('yoghurt', undefined)).toBe(false)
})

test('Open Food Facts is not queried when local foods already matched', () => {
  expect(shouldSearchOff('yoghurt', [{ _id: 'f1' }])).toBe(false)
})

test('Open Food Facts is queried once local search resolved to nothing', () => {
  expect(shouldSearchOff('yoghurt', [])).toBe(true)
})

test('a term under three characters never reaches Open Food Facts', () => {
  expect(shouldSearchOff('yo', [])).toBe(false)
  expect(shouldSearchOff('  yo  ', [])).toBe(false)
  expect(shouldSearchOff('', [])).toBe(false)
})

test('surrounding whitespace does not count towards the three characters', () => {
  expect(shouldSearchOff(' brie ', [])).toBe(true)
})

test('a call is deferred by whatever is left of the minimum interval', () => {
  expect(offSearchWait(1_000, 0)).toBe(OFF_SEARCH_MIN_INTERVAL_MS - 1_000)
})

test('a call that is already past the minimum interval waits for nothing', () => {
  expect(offSearchWait(OFF_SEARCH_MIN_INTERVAL_MS + 1, 0)).toBe(0)
  expect(offSearchWait(100_000, 0)).toBe(0)
})

test('the first call of a session waits for nothing', () => {
  expect(offSearchWait(Date.now(), 0)).toBe(0)
})
