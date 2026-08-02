import { describe, expect, test } from 'vitest'
import {
  ACTIVITY_MODULE_ID,
  ACTIVITY_PHRASES,
  activityModuleLabel,
  formatActivityTime,
} from './groupActivity'
import { moduleById } from './modules'

/**
 * The client half of an activity entry: which Module it came from, and when.
 */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const NOW = new Date('2026-08-01T12:00:00Z').getTime()

describe('every kind of entry names a real Module', () => {
  test('each maps to a Module the registry declares', () => {
    for (const id of Object.values(ACTIVITY_MODULE_ID)) {
      expect(moduleById(id)).toBeDefined()
    }
  })

  test('and is labelled the way the rest of the app labels it', () => {
    expect(activityModuleLabel('recipe')).toBe('Recipes')
    expect(activityModuleLabel('task')).toBe('Tasks')
    expect(activityModuleLabel('babyEvent')).toBe('Baby log')
  })

  test('every kind has a sentence to sit in', () => {
    for (const kind of Object.keys(ACTIVITY_MODULE_ID) as Array<
      keyof typeof ACTIVITY_MODULE_ID
    >) {
      expect(ACTIVITY_PHRASES[kind].verb.length).toBeGreaterThan(0)
    }
  })
})

describe('when it happened', () => {
  test('the last minute reads as just now', () => {
    expect(formatActivityTime(NOW - 1_000, NOW)).toBe('Just now')
    expect(formatActivityTime(NOW, NOW)).toBe('Just now')
  })

  test('a clock running slightly ahead does not produce a negative age', () => {
    expect(formatActivityTime(NOW + 5_000, NOW)).toBe('Just now')
  })

  test('minutes, hours and days, singular and plural', () => {
    expect(formatActivityTime(NOW - MINUTE, NOW)).toBe('1 minute ago')
    expect(formatActivityTime(NOW - 5 * MINUTE, NOW)).toBe('5 minutes ago')
    expect(formatActivityTime(NOW - HOUR, NOW)).toBe('1 hour ago')
    expect(formatActivityTime(NOW - 5 * HOUR, NOW)).toBe('5 hours ago')
    expect(formatActivityTime(NOW - DAY, NOW)).toBe('Yesterday')
    expect(formatActivityTime(NOW - 3 * DAY, NOW)).toBe('3 days ago')
  })

  test('beyond a week it is a date, because "43 days ago" is not an answer', () => {
    const formatted = formatActivityTime(NOW - 43 * DAY, NOW)
    expect(formatted).not.toMatch(/ago/)
    expect(formatted).toMatch(/2026/)
  })
})
