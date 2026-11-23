import { describe, expect, test } from 'vitest'

import { EDGE_BAND, EDGE_MAX_STEP, edgeStep, stepped } from './edgeScroll'

describe('edgeStep', () => {
  // A window from 100 to 800 on screen.
  const step = (y: number) => edgeStep(y, 100, 800)

  test('nothing in the middle of the window', () => {
    expect(step(450)).toBe(0)
    expect(step(100 + EDGE_BAND)).toBe(0)
    expect(step(800 - EDGE_BAND)).toBe(0)
  })

  test('up near the top, down near the bottom, faster deeper in', () => {
    expect(step(100 + EDGE_BAND / 2)).toBeLessThan(0)
    expect(step(800 - EDGE_BAND / 2)).toBeGreaterThan(0)
    expect(Math.abs(step(105))).toBeGreaterThan(Math.abs(step(160)))
  })

  test('never faster than the cap, past the edge too', () => {
    expect(step(40)).toBe(-EDGE_MAX_STEP)
    expect(step(900)).toBe(EDGE_MAX_STEP)
  })

  test('a window too short for two bands never scrolls', () => {
    expect(edgeStep(0, 0, EDGE_BAND * 2)).toBe(0)
  })
})

describe('stepped', () => {
  test('stays inside the scrollable range, an inset top included', () => {
    expect(stepped({ offset: -90, min: -90, max: 600 }, -16)).toBe(-90)
    expect(stepped({ offset: 590, min: -90, max: 600 }, 16)).toBe(600)
    expect(stepped({ offset: 0, min: -90, max: 600 }, 16)).toBe(16)
  })
})
