import { describe, expect, test } from 'vitest'
import {
  awayFromEvents,
  defaultEaters,
  eveningEvents,
  isEveningEvent,
  mealEaters,
  mealServings,
  planMove,
  weekdayIndex,
} from '../mealPlanner'
import {
  enabledSlots,
  fitsPreferences,
  recipeClashes,
  resolveMealPreferences,
} from '../mealPreferencesStandIn'

const event = (startMinutes?: number, endMinutes?: number, extra = {}) => ({
  date: '2026-11-25',
  title: 'Zwemles',
  startMinutes,
  endMinutes,
  ...extra,
})

describe('evenings', () => {
  test('an event overlapping 17:00 to 20:00 takes the evening', () => {
    expect(isEveningEvent(event(18 * 60, 19 * 60))).toBe(true)
    expect(isEveningEvent(event(16 * 60 + 30, 17 * 60 + 15))).toBe(true)
    expect(isEveningEvent(event(19 * 60 + 30))).toBe(true)
    expect(isEveningEvent(event(9 * 60, 10 * 60))).toBe(false)
    expect(isEveningEvent(event(20 * 60, 22 * 60))).toBe(false)
    expect(isEveningEvent(event(16 * 60, 17 * 60))).toBe(false)
    expect(isEveningEvent(event(undefined))).toBe(false)
    expect(isEveningEvent(event(18 * 60, 19 * 60, { allDay: true }))).toBe(false)
  })

  test('the day’s evening events come earliest first, and take their assignees', () => {
    const events = [
      event(19 * 60, undefined, { title: 'Late', assigneeIds: ['noor'] }),
      event(18 * 60, undefined, { title: 'Early', assigneeIds: ['daan'] }),
      event(18 * 60, undefined, { date: '2026-11-26', assigneeIds: ['sanne'] }),
    ]
    expect(eveningEvents(events, '2026-11-25').map((e) => e.title)).toEqual([
      'Early',
      'Late',
    ])
    expect([...awayFromEvents(events, '2026-11-25').keys()]).toEqual([
      'daan',
      'noor',
    ])
  })
})

describe('eaters and servings', () => {
  const defaults = [
    { userId: 'sanne', eatsByDefault: true },
    { userId: 'daan', eatsByDefault: true },
    { userId: 'mees', eatsByDefault: false },
  ]
  test('defaults leave out who does not eat along and who is away', () => {
    expect(defaultEaters(defaults, new Set(['daan']))).toEqual(['sanne'])
  })
  test('a chosen list wins, in Member order, and drops former Members', () => {
    const members = ['sanne', 'daan', 'mees']
    expect(mealEaters(undefined, members, ['sanne'])).toEqual(['sanne'])
    expect(mealEaters(['mees', 'gone', 'sanne'], members, [])).toEqual([
      'sanne',
      'mees',
    ])
  })
  test('servings follow who eats unless the meal or Group says otherwise', () => {
    expect(mealServings(undefined, undefined, 3)).toBe(3)
    expect(mealServings(undefined, 4, 3)).toBe(4)
    expect(mealServings(2, 4, 3)).toBe(2)
    expect(mealServings(undefined, undefined, 0)).toBe(1)
  })
})

describe('planMove', () => {
  const meals = [
    { id: 'a', date: '2026-11-23' },
    { id: 'b', date: '2026-11-24', slot: 'dinner' as const },
    { id: 'c', date: '2026-11-24', slot: 'lunch' as const },
  ]
  test('stays, moves into an empty slot, or swaps with a taken one', () => {
    expect(planMove(meals, 'a', { date: '2026-11-23', slot: 'dinner' })).toEqual({
      kind: 'stay',
    })
    expect(planMove(meals, 'a', { date: '2026-11-25', slot: 'dinner' }).kind).toBe(
      'move',
    )
    expect(planMove(meals, 'a', { date: '2026-11-24', slot: 'dinner' })).toMatchObject({
      kind: 'swap',
      other: { id: 'b' },
    })
    expect(planMove(meals, 'x', { date: '2026-11-24', slot: 'dinner' })).toEqual({
      kind: 'missing',
    })
  })
})

test('weekdays are Monday first', () => {
  expect(weekdayIndex('2026-11-23')).toBe(0)
  expect(weekdayIndex('2026-11-29')).toBe(6)
})

describe('meal preferences stand-in', () => {
  const members = [{ userId: 'sanne' }, { userId: 'daan' }]
  test('fills in APP-318’s defaults without a row', () => {
    const prefs = resolveMealPreferences(null, members)
    expect(prefs.memberDefaults).toEqual([
      { userId: 'sanne', eatsByDefault: true },
      { userId: 'daan', eatsByDefault: true },
    ])
    expect(prefs.defaultEaterIds).toEqual(['sanne', 'daan'])
    expect(prefs.servingsOverride).toBeNull()
    expect(prefs.servingsPerMeal).toBe(2)
    expect(enabledSlots(prefs, 0)).toEqual(['dinner'])
    expect(enabledSlots(prefs, 5)).toEqual(['lunch', 'dinner'])
    expect(prefs.cookingMinutes).toEqual([30, 30, 30, 30, 30, 60, 60])
  })
  test('keeps what a row says and fills the rest', () => {
    const prefs = resolveMealPreferences(
      {
        memberDefaults: [{ userId: 'daan', eatsByDefault: false }],
        slots: { breakfast: { enabled: true, days: [6] } },
        dislikes: ['koriander'],
      },
      members,
    )
    expect(prefs.memberDefaults[1]).toEqual({ userId: 'daan', eatsByDefault: false })
    expect(prefs.defaultEaterIds).toEqual(['sanne'])
    expect(prefs.servingsPerMeal).toBe(1)
    expect(enabledSlots(prefs, 6)).toEqual(['breakfast', 'lunch', 'dinner'])
    expect(
      recipeClashes(
        { title: 'Curry', ingredients: ['Verse Koriander'], prepMinutes: 45 },
        prefs,
        0,
      ),
    ).toEqual([
      { kind: 'time', minutes: 45, limit: 30 },
      { kind: 'dislike', label: 'koriander' },
    ])
    expect(recipeClashes({ title: 'Soup' }, prefs, 0)).toEqual([])
  })
  test('hides a recipe only on a certain clash', () => {
    expect(fitsPreferences([])).toBe(true)
    expect(
      fitsPreferences([
        { kind: 'allergen', id: 'milk', label: 'Melk', uncertain: true },
      ]),
    ).toBe(true)
    expect(fitsPreferences([{ kind: 'dislike', label: 'koriander' }])).toBe(
      false,
    )
  })
})
