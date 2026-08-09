import { expect, test } from 'vitest'
import { barcodeTerm, offCacheKey, shouldSearchOff } from './useFoodSearch'

test('a barcode typed into the search box is resolved as a barcode', () => {
  // Not restated here: the search box borrows the pattern the lookup itself
  // uses, so "what counts as a barcode" has one definition (#80).
  expect(barcodeTerm('8712345678901')).toBe('8712345678901')
})

test('digits still arriving stay an ordinary search', () => {
  // The mode is decided about the debounced term, so these are the states a
  // pause could land on, not every keystroke — but each of them still has to
  // mean "keep searching by text" rather than "look this up and find nothing".
  expect(barcodeTerm('871')).toBeNull()
  expect(barcodeTerm('8712345')).toBeNull()
  // …and a term that is a barcode is still worth asking OFF about, so the two
  // gates never disagree about whether to reach Open Food Facts at all.
  expect(shouldSearchOff('8712345678901')).toBe(true)
})

test('a barcode lookup is cached and rate-limited like any other term', () => {
  // It goes through the same per-term cache: the key is the term, whatever
  // kind of term it turned out to be.
  expect(offCacheKey('8712345678901', 'nl')).toBe(
    offCacheKey('8712345678901', 'nl'),
  )
  expect(offCacheKey('8712345678901', 'nl')).not.toBe(
    offCacheKey('8712345678901', 'en'),
  )
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
