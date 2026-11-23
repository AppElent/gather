import { resolveMealPreferences } from '@gather/core/meal-preferences'
import { describe, expect, test } from 'vitest'

import { en } from '../../../i18n/messages/en'
import { nl } from '../../../i18n/messages/nl'
import type { PlannedMeal, WeekData } from './week'
import {
  defaultPlanSlots,
  draftReason,
  emptyTargets,
  planDays,
  planSlotChoices,
  planUses,
  slotChipLabel,
  swapReason,
} from './week-plan'

const members = [
  { userId: 'daan', name: 'Daan' },
  { userId: 'noor', name: 'Noor' },
] as WeekData['members']
const preferences = resolveMealPreferences(null, members)
const dinner = (date: string) =>
  ({ _id: date, date, slot: 'dinner', title: 'Snert', imageUrl: null }) as PlannedMeal
const data = {
  meals: [dinner('2026-11-23'), dinner('2026-11-24')],
  members,
  events: [
    {
      _id: 'e',
      date: '2026-11-25',
      title: 'Zwemles',
      startMinutes: 18 * 60,
      endMinutes: 19 * 60,
      assigneeIds: ['daan'],
    },
  ],
  preferences,
} as unknown as WeekData

describe('the start sheet', () => {
  const choices = planSlotChoices(preferences)

  test('offers the planned slots, dinner on by default, lunch with its days', () => {
    expect(choices.map((c) => c.slot)).toEqual(['lunch', 'dinner'])
    expect(defaultPlanSlots(choices)).toEqual(['dinner'])
    expect(slotChipLabel(choices[0], nl.mealPlanner, nl.mealPreferences)).toBe(
      'Lunch (za, zo)',
    )
    expect(slotChipLabel(choices[1], nl.mealPlanner, nl.mealPreferences)).toBe(
      'Avondeten',
    )
  })

  test('planned days are locked, past days start skipped, a tap flips a day', () => {
    const days = planDays('2026-11-23', data, choices, ['dinner'], new Set(['2026-11-29']), '2026-11-24')
    expect(days.map((d) => d.state)).toEqual([
      'planned',
      'planned',
      'fill',
      'fill',
      'fill',
      'fill',
      'skip',
    ])
    // With lunch chosen too, the weekend still has an empty slot.
    const withLunch = planDays('2026-11-23', data, choices, ['lunch', 'dinner'], new Set(), '2026-11-20')
    expect(withLunch[0].state).toBe('planned')
  })

  test('only empty slots on the chosen days are targets', () => {
    expect(
      emptyTargets(data, choices, ['lunch', 'dinner'], ['2026-11-24', '2026-11-28']),
    ).toEqual([
      { date: '2026-11-28', slot: 'lunch' },
      { date: '2026-11-28', slot: 'dinner' },
    ])
  })

  test('what Gather takes into account, rows without content left out', () => {
    const uses = planUses({
      data,
      dates: ['2026-11-25', '2026-11-26'],
      lowNames: ['Pompoen'],
      stockNames: ['Rijst'],
      words: nl.mealPlanner,
      prefWords: nl.mealPreferences,
      locale: 'nl',
    })
    expect(uses.map((u) => [u.kind, u.sub])).toEqual([
      ['preferences', 'doordeweeks hooguit 30 min'],
      ['calendar', 'Woensdag Zwemles 18:00: iets snels'],
      ['eaters', 'Woensdag zonder Daan: voor 1'],
      ['stock', 'Pompoen bijna op · rijst'],
    ])
    const quiet = planUses({
      data: { ...data, events: [] },
      dates: ['2026-11-26'],
      lowNames: [],
      stockNames: [],
      words: en.mealPlanner,
      prefWords: en.mealPreferences,
      locale: 'en',
    })
    expect(quiet.map((u) => u.kind)).toEqual(['preferences'])
  })
})

describe('draftReason', () => {
  test('the model’s reason with the minutes, else the rules', () => {
    expect(draftReason({ reason: 'Hoog beoordeeld', prepMinutes: 25 }, nl.mealPlanner)).toBe(
      'Hoog beoordeeld · 25 min',
    )
    expect(draftReason({ reason: undefined, prepMinutes: 20 }, nl.mealPlanner)).toBe(
      '20 min · volgens jullie regels',
    )
    expect(draftReason({ reason: undefined, prepMinutes: undefined }, en.mealPlanner)).toBe(
      'following your rules',
    )
  })
})

describe('swapReason', () => {
  test('the model’s reason as it is', () => {
    expect(swapReason({ reason: 'Spinazie in huis', source: 'ai' }, nl.mealPlanner, 'nl')).toBe(
      'Spinazie in huis',
    )
    expect(swapReason({ source: 'ai' }, nl.mealPlanner, 'nl')).toBeNull()
  })

  test('a rules pick says what it uses and the time it fits', () => {
    const rulesReason = { low: ['Kipdij'], inStock: ['Rijst', 'Spinazie'], fitsMinutes: 30 }
    expect(swapReason({ source: 'rules', rulesReason }, nl.mealPlanner, 'nl')).toBe(
      'Kipdij bijna op · Met rijst en spinazie uit huis · Past in 30 min',
    )
    expect(swapReason({ source: 'rules', rulesReason }, en.mealPlanner, 'en')).toBe(
      'Kipdij running low · Uses your rijst and spinazie · Fits in 30 min',
    )
  })

  test('with nothing to say, or from an older server, the rules line', () => {
    const empty = { low: [], inStock: [] }
    expect(swapReason({ source: 'rules', rulesReason: empty }, nl.mealPlanner, 'nl')).toBe(
      'volgens jullie regels',
    )
    expect(swapReason({ source: 'rules' }, en.mealPlanner, 'en')).toBe('following your rules')
  })
})
