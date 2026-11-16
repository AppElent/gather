import { expect, test } from 'vitest'

import { isAccessibilityTextSize } from './text-scale'

test('the standard sizes up to XXXL are not accessibility sizes', () => {
  for (const scale of [0.82, 1, 1.12, 1.24, 1.35]) {
    expect(isAccessibilityTextSize(scale)).toBe(false)
  }
})

test('AX1 and up are', () => {
  for (const scale of [1.65, 1.94, 2.35, 3.12]) {
    expect(isAccessibilityTextSize(scale)).toBe(true)
  }
})
