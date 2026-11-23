import { resolveMealPreferences } from '@gather/core/meal-preferences'
import { describe, expect, test } from 'vitest'

import { en } from '../../../i18n/messages/en'
import {
  daySlots,
  dinnersPlanned,
  eatersOf,
  eatingLabel,
  joinNames,
  mealMeta,
  type PlannedMeal,
  shortNames,
  type WeekData,
  weekdayInText,
  weekdayName,
  weekRange,
} from './week'

const words = en.mealPlanner
const members = [
  { userId: 'daan', name: 'Daan' },
  { userId: 'noor', name: 'Noor' },
  { userId: 'sanne', name: 'Sanne' },
] as WeekData['members']
const preferences = resolveMealPreferences(null, members)
const meal = (over: Partial<PlannedMeal>): PlannedMeal =>
  ({
    _id: 'meal',
    date: '2026-11-26',
    slot: 'dinner',
    title: 'Snert',
    prepMinutes: 45,
    imageUrl: null,
    ...over,
  }) as PlannedMeal
const swimming = {
  _id: 'event',
  date: '2026-11-26',
  title: 'Zwemles',
  startMinutes: 18 * 60,
  endMinutes: 19 * 60,
  assigneeIds: ['daan'],
} as WeekData['events'][number]
const data = { members, preferences, events: [swimming] }

describe('week menu', () => {
  test('a weekday shows dinner; a weekend lunch too; a planned slot stays', () => {
    expect(daySlots(preferences, '2026-11-26', [])).toEqual(['dinner'])
    expect(daySlots(preferences, '2026-11-28', [])).toEqual(['lunch', 'dinner'])
    expect(
      daySlots(preferences, '2026-11-26', [meal({ slot: 'breakfast' })]),
    ).toEqual(['breakfast', 'dinner'])
  })

  test('an evening event takes someone from dinner, not from lunch', () => {
    expect(eatersOf(data, '2026-11-26', 'dinner')).toEqual(['noor', 'sanne'])
    expect(eatersOf(data, '2026-11-26', 'lunch')).toEqual([
      'daan',
      'noor',
      'sanne',
    ])
    expect(eatersOf(data, '2026-11-26', 'dinner', ['daan'])).toEqual(['daan'])
  })

  test('the coins say who eats in one label', () => {
    expect(eatingLabel(members, ['daan', 'noor', 'sanne'], words, 'en')).toBe(
      'All 3 eating',
    )
    expect(eatingLabel(members, ['noor', 'sanne'], words, 'en')).toBe(
      '2 eating, without Daan',
    )
    expect(eatingLabel(members, [], words, 'en')).toBe('Nobody eating')
    expect(joinNames(['A', 'B', 'C'], words)).toBe('A, B and C')
  })

  test('a row says minutes, servings and who is out', () => {
    expect(mealMeta(meal({}), data, words, 'en')).toBe(
      '45 min · 2 people, without Daan',
    )
    expect(mealMeta(meal({ servings: 5, eaterIds: undefined }), data, words, 'en')).toBe(
      '45 min · 5 people, without Daan',
    )
  })

  test('the week reads as one range, with the month once', () => {
    expect(weekRange('2026-11-23', 'nl')).toBe('23 – 29 nov')
    expect(weekRange('2026-11-23', 'en')).toBe('Nov 23 – 29')
    expect(weekRange('2026-11-30', 'nl')).toBe('30 nov – 6 dec')
  })

  test('the summary counts this week’s dinners only', () => {
    expect(
      dinnersPlanned(
        [
          meal({}),
          meal({ slot: 'lunch' }),
          meal({ date: '2026-12-01' }),
        ],
        '2026-11-23',
      ),
    ).toBe(1)
  })
})

describe('weekdayInText', () => {
  test('lower case inside a Dutch sentence, capitalised in English', () => {
    expect(weekdayInText('2026-11-26', 'nl')).toBe('donderdag')
    expect(weekdayInText('2026-11-26', 'en')).toBe('Thursday')
    expect(weekdayName('2026-11-26', 'nl')).toBe('Donderdag')
  })

  test('labels use first names, full names only when two share one', () => {
    const family = [
      { userId: 'sam', name: 'Sam Okonkwo' },
      { userId: 'noor', name: 'Noor de Vries' },
      { userId: 'sanne', name: 'Sanne Jansen' },
    ] as WeekData['members']
    expect(eatingLabel(family, ['noor', 'sanne'], words, 'en')).toBe(
      '2 eating, without Sam',
    )
    const twoSams = [
      ...family,
      { userId: 'sam2', name: 'Sam Bakker' },
    ] as WeekData['members']
    expect(shortNames(twoSams).get('noor')).toBe('Noor')
    expect(eatingLabel(twoSams, ['noor', 'sanne'], words, 'en')).toBe(
      '2 eating, without Sam Okonkwo and Sam Bakker',
    )
  })
})
