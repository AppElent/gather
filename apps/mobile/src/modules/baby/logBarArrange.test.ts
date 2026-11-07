import { describe, expect, test } from 'vitest'

import { dragTarget, residualOffset } from './logBarArrange'

describe('which slot a drag is over', () => {
  test('snaps once the finger is past a button’s halfway point', () => {
    expect(dragTarget(6, 0, 29, 60)).toBe(0)
    expect(dragTarget(6, 0, 31, 60)).toBe(1)
  })

  test('several slots at once', () => {
    expect(dragTarget(6, 0, 185, 60)).toBe(3)
  })

  test('backwards', () => {
    expect(dragTarget(6, 4, -125, 60)).toBe(2)
  })

  test('off the end does nothing rather than wrapping to the other end', () => {
    expect(dragTarget(6, 0, -400, 60)).toBe(0)
    expect(dragTarget(6, 5, 400, 60)).toBe(5)
  })

  test('a bar that has not been measured yet places nothing', () => {
    expect(dragTarget(6, 2, 300, 0)).toBe(2)
  })
})

describe('keeping the held button under the finger', () => {
  test('no swap yet, so it follows the drag exactly', () => {
    expect(residualOffset(25, 0, 0, 60)).toBe(25)
  })

  test('after one swap it carries only what is left over', () => {
    expect(residualOffset(70, 0, 1, 60)).toBe(10)
  })

  test('and backwards', () => {
    expect(residualOffset(-70, 2, 1, 60)).toBe(-10)
  })
})
