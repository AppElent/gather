import { expect, test } from 'vitest'
import { offCacheKey, shouldSearchOff } from './useFoodSearch'

test('a term of three characters or more is worth asking Open Food Facts about', () => {
  expect(shouldSearchOff('brie')).toBe(true)
  expect(shouldSearchOff(' brie ')).toBe(true)
})

test('a term under three characters never reaches Open Food Facts', () => {
  expect(shouldSearchOff('yo')).toBe(false)
  expect(shouldSearchOff('  yo  ')).toBe(false)
  expect(shouldSearchOff('')).toBe(false)
})

test('asking Open Food Facts does not depend on what the local search found', () => {
  // The gate used to be "local search returned exactly zero rows", so one poor
  // local match hid the entire external catalogue. Nothing but the term now.
  expect(shouldSearchOff('hagelslag')).toBe(true)
})

test('the same term in another language is another search', () => {
  expect(offCacheKey('melk', 'nl')).not.toBe(offCacheKey('melk', 'en'))
})

test('the same term in the same language is the same cache entry', () => {
  expect(offCacheKey('melk', 'nl')).toBe(offCacheKey('melk', 'nl'))
})
