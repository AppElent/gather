import { expect, test } from 'vitest'
import { isOffImageUrl } from './foodsLookup'

/**
 * `importFromOff` is a public action, so the image URL it is handed is
 * whatever a caller sent rather than whatever our own search returned. This is
 * what stops gather's storage being used to mirror the public internet;
 * `safeFetch` separately refuses private addresses.
 */

test('accepts an Open Food Facts image host over https', () => {
  expect(
    isOffImageUrl(
      'https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.4.200.jpg',
    ),
  ).toBe(true)
  expect(isOffImageUrl('https://static.openfoodfacts.org/images/x.jpg')).toBe(
    true,
  )
  expect(isOffImageUrl('https://openfoodfacts.org/images/x.jpg')).toBe(true)
})

test('refuses anywhere else, however plausible it looks', () => {
  expect(isOffImageUrl('https://example.com/huge.bin')).toBe(false)
  // The suffix check is on the host, not on the string: a lookalike domain and
  // a path that mentions Open Food Facts are both still somewhere else.
  expect(isOffImageUrl('https://openfoodfacts.org.evil.example/x.jpg')).toBe(
    false,
  )
  expect(isOffImageUrl('https://evil.example/openfoodfacts.org/x.jpg')).toBe(
    false,
  )
})

test('refuses anything that is not https, and anything that is not a URL', () => {
  expect(isOffImageUrl('http://images.openfoodfacts.org/x.jpg')).toBe(false)
  expect(isOffImageUrl('file:///etc/passwd')).toBe(false)
  expect(isOffImageUrl('not a url')).toBe(false)
  expect(isOffImageUrl('')).toBe(false)
})
