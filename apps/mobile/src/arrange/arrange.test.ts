import { describe, expect, test } from 'vitest'
import { dropIndex, movedTo, shiftFor } from './arrange'

describe('task reorder helpers', () => {
  test('clamps a drag to the open rows', () => {
    expect(dropIndex(3, 0, -200, 50)).toBe(0)
    expect(dropIndex(3, 0, 110, 50)).toBe(2)
  })

  test('moves one id without changing the other ids', () => {
    expect(movedTo(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(shiftFor(1, 0, 2, 50)).toBe(-50)
  })

  test('moves backwards as well as forwards', () => {
    expect(movedTo(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  test('moving onto itself is a copy, not a mutation', () => {
    const order = ['a', 'b', 'c', 'd']
    const same = movedTo(order, 1, 1)
    expect(same).toEqual(order)
    expect(same).not.toBe(order)
  })

  test('out of bounds leaves the order alone', () => {
    const order = ['a', 'b', 'c', 'd']
    expect(movedTo(order, 0, 9)).toEqual(order)
    expect(movedTo(order, -1, 2)).toEqual(order)
  })
})
