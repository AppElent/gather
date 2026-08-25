import { describe, expect, test } from 'vitest'
import { dropIndex, movedTo, shiftFor } from './reorder'

describe('task reorder helpers', () => {
  test('clamps a drag to the open rows', () => {
    expect(dropIndex(3, 0, -200, 50)).toBe(0)
    expect(dropIndex(3, 0, 110, 50)).toBe(2)
  })

  test('moves one id without changing the other ids', () => {
    expect(movedTo(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(shiftFor(1, 0, 2, 50)).toBe(-50)
  })
})
