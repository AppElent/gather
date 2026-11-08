import { expect, test } from 'vitest'
import { offCacheKey, shouldSearchOff } from './useFoodSearch'

test('a barcode is still worth asking Open Food Facts about', () => {
  // So the barcode lookup and the text gate never disagree about whether to
  // reach Open Food Facts at all.
  expect(shouldSearchOff('8712345678901')).toBe(true)
})

test('a term of three characters or more is worth asking Open Food Facts about', () => {
  expect(shouldSearchOff('brie')).toBe(true)
  expect(shouldSearchOff(' brie ')).toBe(true)
})

test('a term under three characters never reaches Open Food Facts', () => {
  expect(shouldSearchOff('yo')).toBe(false)
  expect(shouldSearchOff('  yo  ')).toBe(false)
  expect(shouldSearchOff('')).toBe(false)
})

test('the same term in another language is another search', () => {
  expect(offCacheKey('melk', 'nl')).not.toBe(offCacheKey('melk', 'en'))
})

test('another term is another search', () => {
  expect(offCacheKey('melk', 'nl')).not.toBe(offCacheKey('kaas', 'nl'))
})
