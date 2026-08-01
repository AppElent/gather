import { describe, expect, test } from 'vitest'
import { canonicalJson, stableDigest } from './stableDigest'

/**
 * The one property that matters: the same data digests the same way twice, and
 * different data does not. A verification output an operator is told to diff by
 * eye is worthless if either half of that fails.
 */
describe('stableDigest', () => {
  test('does not depend on the order the keys were written in', () => {
    const a = { method: 'bottle', amountMl: 90, side: 'left' }
    const b = { side: 'left', amountMl: 90, method: 'bottle' }

    expect(stableDigest(a)).toBe(stableDigest(b))
  })

  test('changes when any value changes', () => {
    const before = stableDigest({ method: 'bottle', amountMl: 90 })

    expect(stableDigest({ method: 'bottle', amountMl: 91 })).not.toBe(before)
    expect(stableDigest({ method: 'breast', amountMl: 90 })).not.toBe(before)
  })

  test('tells a missing field from a field set to zero', () => {
    expect(stableDigest({ celsius: 37 })).not.toBe(
      stableDigest({ celsius: 37, headCircumferenceCm: 0 }),
    )
  })

  test('treats an unset optional field as absent', () => {
    expect(stableDigest({ celsius: 37, method: undefined })).toBe(
      stableDigest({ celsius: 37 }),
    )
  })

  test('keeps array order, because there the order is the data', () => {
    expect(stableDigest({ names: ['a', 'b'] })).not.toBe(
      stableDigest({ names: ['b', 'a'] }),
    )
  })

  test('is sixteen hex characters, whatever it is given', () => {
    for (const value of [{}, { a: 1 }, { deeply: { nested: [1, 2, 3] } }]) {
      expect(stableDigest(value)).toMatch(/^[0-9a-f]{16}$/)
    }
  })

  test('canonical text sorts nested keys too', () => {
    expect(canonicalJson({ b: { d: 1, c: 2 }, a: 3 })).toBe(
      '{"a":3,"b":{"c":2,"d":1}}',
    )
  })
})
