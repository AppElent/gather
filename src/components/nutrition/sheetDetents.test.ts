import { expect, test } from 'vitest'
import {
  DETENTS,
  nearestDetent,
  releaseDetent,
  rubberBand,
} from './sheetDetents'

test('a resting position snaps to the detent it is closest to', () => {
  expect(nearestDetent(0.05)).toBe('full')
  expect(nearestDetent(0.4)).toBe('peek')
  expect(nearestDetent(0.95)).toBe('closed')
})

test('a flick down from full collapses to peek rather than closing outright', () => {
  expect(releaseDetent(DETENTS.full, 1.2, 'full')).toBe('peek')
})

test('a flick down from peek closes', () => {
  expect(releaseDetent(DETENTS.peek, 1.2, 'peek')).toBe('closed')
})

test('a flick up goes full from wherever it started', () => {
  expect(releaseDetent(0.8, -1.2, 'peek')).toBe('full')
  expect(releaseDetent(0.5, -0.9, 'full')).toBe('full')
})

test('a slow drag lands on position, not on where it came from', () => {
  expect(releaseDetent(0.1, 0.2, 'peek')).toBe('full')
  expect(releaseDetent(0.9, -0.2, 'full')).toBe('closed')
})

test('dragging above full gives a quarter of the movement and never more than a hair', () => {
  expect(rubberBand(-0.04)).toBeCloseTo(-0.01)
  expect(rubberBand(-10)).toBe(-0.04)
})

test('dragging below closed is refused', () => {
  expect(rubberBand(1.5)).toBe(1)
  expect(rubberBand(0.6)).toBe(0.6)
})
