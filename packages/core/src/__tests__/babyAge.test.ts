import { describe, expect, test } from 'vitest'
import { formatAge } from '../babyAge'
import { en, nl } from '../messages'

const DAY = 24 * 60 * 60 * 1000

const AGE = en.baby.log.child.age

describe('formatAge', () => {
  test('under two weeks reports days', () => {
    const birth = '2026-01-01'
    const at = new Date('2026-01-01T00:00:00').getTime() + 5 * DAY
    expect(formatAge(birth, AGE, 'en', at)).toBe('5 days old')
  })

  test('singular day', () => {
    const birth = '2026-01-01'
    const at = new Date('2026-01-01T00:00:00').getTime() + 1 * DAY
    expect(formatAge(birth, AGE, 'en', at)).toBe('1 day old')
  })

  test('two to eight weeks reports weeks', () => {
    const birth = '2026-01-01'
    const at = new Date('2026-01-01T00:00:00').getTime() + 21 * DAY
    expect(formatAge(birth, AGE, 'en', at)).toBe('3 weeks old')
  })

  test('two months and beyond reports months', () => {
    expect(
      formatAge(
        '2026-01-01',
        AGE,
        'en',
        new Date('2026-04-01T00:00:00').getTime(),
      ),
    ).toBe('3 months old')
  })

  test('two years and beyond reports years, with leftover months', () => {
    expect(
      formatAge(
        '2024-01-01',
        AGE,
        'en',
        new Date('2026-07-01T00:00:00').getTime(),
      ),
    ).toBe('2 yr 6 mo old')
  })

  test('two years and beyond in Dutch', () => {
    expect(
      formatAge(
        '2024-01-01',
        nl.baby.log.child.age,
        'nl',
        new Date('2026-07-01T00:00:00').getTime(),
      ),
    ).toBe('2 jr 6 mnd oud')
  })

  test('exact whole years with no leftover months', () => {
    expect(
      formatAge(
        '2024-01-01',
        AGE,
        'en',
        new Date('2026-01-01T00:00:00').getTime(),
      ),
    ).toBe('2 years old')
  })

  test("counts age on the Group's day when a zone is given", () => {
    // 22:00Z on 5 Jan is still 5 Jan in Amsterdam (4 days), 6 Jan in Tokyo (5 days).
    const instant = Date.parse('2026-01-05T22:00:00Z')
    expect(formatAge('2026-01-01', AGE, 'en', instant, 'Europe/Amsterdam')).toBe(
      '4 days old',
    )
    expect(formatAge('2026-01-01', AGE, 'en', instant, 'Asia/Tokyo')).toBe(
      '5 days old',
    )
  })
})
