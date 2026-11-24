import { describe, expect, test } from 'vitest'

import {
  closeDistance,
  DRAG_CLOSE,
  DRAG_CLOSE_EXPANDED,
  DRAG_EXPAND,
  dragOffset,
  dragOutcome,
} from './composer-gestures'

const drag = (translationY: number, velocityY = 0) => ({ translationY, velocityY })

describe('a small card', () => {
  test('expands on a drag up past the threshold', () => {
    expect(dragOutcome(drag(-DRAG_EXPAND - 1), false)).toBe('expand')
    expect(dragOutcome(drag(-DRAG_EXPAND + 1), false)).toBeNull()
  })

  test('expands on a short, fast flick up', () => {
    expect(dragOutcome(drag(-10, -800), false)).toBe('expand')
    expect(dragOutcome(drag(-10, -300), false)).toBeNull()
  })

  test('closes on a drag down past the threshold, or a flick', () => {
    expect(dragOutcome(drag(DRAG_CLOSE + 1), false)).toBe('close')
    expect(dragOutcome(drag(DRAG_CLOSE - 1), false)).toBeNull()
    expect(dragOutcome(drag(20, 1200), false)).toBe('close')
  })

  test('follows a drag down, and a drag up with resistance', () => {
    expect(dragOffset(40, false)).toBe(40)
    expect(dragOffset(-100, false)).toBeCloseTo(-35)
  })
})

describe('an expanded card', () => {
  test('collapses on a drag down, and closes on a long one', () => {
    expect(dragOutcome(drag(DRAG_CLOSE + 1), true)).toBe('collapse')
    expect(dragOutcome(drag(20, 1200), true)).toBe('collapse')
    expect(dragOutcome(drag(DRAG_CLOSE_EXPANDED + 1), true)).toBe('close')
  })

  test('ignores a drag up or a short drag down', () => {
    expect(dragOutcome(drag(-200, -1200), true)).toBeNull()
    expect(dragOutcome(drag(DRAG_CLOSE - 1), true)).toBeNull()
  })

  test('follows a drag down only', () => {
    expect(dragOffset(-100, true)).toBe(0)
    expect(dragOffset(60, true)).toBe(60)
  })
})

describe('closing from expanded', () => {
  test('happens past where the small card sits, then a small close', () => {
    const at = closeDistance({ small: 120, expanded: 560 })
    expect(at).toBe(560 - 120 + DRAG_CLOSE)
    expect(dragOutcome(drag(at - 1), true, at)).toBe('collapse')
    expect(dragOutcome(drag(at + 1), true, at)).toBe('close')
  })

  test('falls back to a fixed distance until both sizes are measured', () => {
    expect(closeDistance({ small: 0, expanded: 560 })).toBe(DRAG_CLOSE_EXPANDED)
    expect(closeDistance({ small: 120, expanded: 0 })).toBe(DRAG_CLOSE_EXPANDED)
  })
})

describe('a card with one size', () => {
  test('never expands, and closes on a drag down', () => {
    expect(dragOutcome(drag(-200, -1200), false, undefined, false)).toBeNull()
    expect(dragOutcome(drag(DRAG_CLOSE + 1), false, undefined, false)).toBe('close')
  })

  test('follows a drag down only', () => {
    expect(dragOffset(-100, false, false)).toBe(0)
    expect(dragOffset(60, false, false)).toBe(60)
  })
})
