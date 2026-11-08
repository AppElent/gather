import { describe, expect, test } from 'vitest'

import { parseDecimal } from '../decimal'

describe('reading a number out of a box somebody is still typing', () => {
  test('a comma is a decimal point — some keyboards only offer one of them', () => {
    expect(parseDecimal('6,8')).toBe(6.8)
    expect(parseDecimal(' 6.8 ')).toBe(6.8)
  })

  test('empty and nonsense are null, never zero', () => {
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('  ')).toBeNull()
    expect(parseDecimal('abc')).toBeNull()
    expect(parseDecimal('1,2,3')).toBeNull()
    expect(parseDecimal(undefined)).toBeNull()
  })
})
