import { describe, expect, test } from 'vitest'
import {
  ACTIVITY_MODULE_ID,
  activityModuleLabel,
  activityPhrase,
  formatActivityTime,
} from './groupActivity'
import { en } from './i18n/messages/en'
import { nl } from './i18n/messages/nl'
import { moduleById } from './modules'

/**
 * The client half of an activity entry: which Module it came from, and when.
 *
 * The words come in as an argument, so these read the same as they always did
 * — with `en` passed where the strings used to be hardcoded — and one case at
 * the end proves the argument is actually being used.
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
    expect(activityModuleLabel('recipe', en)).toBe('Recipes')
    expect(activityModuleLabel('task', en)).toBe('Tasks')
    expect(activityModuleLabel('babyEvent', en)).toBe('Baby log')
  })

  test('every kind has a sentence to sit in', () => {
    for (const kind of Object.keys(ACTIVITY_MODULE_ID) as Array<
      keyof typeof ACTIVITY_MODULE_ID
    >) {
      expect(activityPhrase(kind, en).verb.length).toBeGreaterThan(0)
    }
  })

  // A recipe entry carries no context, so there is nothing for a connector to
  // join it to — and no word for a translator to have to invent.
  test('only the kinds that carry a context have a connector', () => {
    expect(activityPhrase('recipe', en).connector).toBeNull()
    expect(activityPhrase('task', en).connector).toBe('to')
    expect(activityPhrase('babyEvent', en).connector).toBe('for')
  })
})

describe('when it happened', () => {
  test('the last minute reads as just now', () => {
    expect(formatActivityTime(NOW - 1_000, en, 'en', NOW)).toBe('Just now')
    expect(formatActivityTime(NOW, en, 'en', NOW)).toBe('Just now')
  })

  test('a clock running slightly ahead does not produce a negative age', () => {
    expect(formatActivityTime(NOW + 5_000, en, 'en', NOW)).toBe('Just now')
  })

  test('minutes, hours and days, singular and plural', () => {
    const ago = (elapsed: number) =>
      formatActivityTime(NOW - elapsed, en, 'en', NOW)
    expect(ago(MINUTE)).toBe('1 minute ago')
    expect(ago(5 * MINUTE)).toBe('5 minutes ago')
    expect(ago(HOUR)).toBe('1 hour ago')
    expect(ago(5 * HOUR)).toBe('5 hours ago')
    expect(ago(DAY)).toBe('Yesterday')
    expect(ago(3 * DAY)).toBe('3 days ago')
  })

  test('beyond a week it is a date, because "43 days ago" is not an answer', () => {
    const formatted = formatActivityTime(NOW - 43 * DAY, en, 'en', NOW)
    expect(formatted).not.toMatch(/ago/)
    expect(formatted).toMatch(/2026/)
  })

  // The locale is not decoration: it picks the plural form and formats the
  // date past a week. Both would look fine in English if it were ignored.
  test('reads in the locale it was given', () => {
    expect(formatActivityTime(NOW - MINUTE, nl, 'nl', NOW)).toBe(
      '1 minuut geleden',
    )
    expect(formatActivityTime(NOW - 5 * MINUTE, nl, 'nl', NOW)).toBe(
      '5 minuten geleden',
    )
    expect(formatActivityTime(NOW - DAY, nl, 'nl', NOW)).toBe('Gisteren')
  })
})
