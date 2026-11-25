import { expect, test } from 'vitest'
import {
  canMoveTo,
  cardSlots,
  type Draft,
  openDrafts,
  recordLink,
  validateRecordSearch,
  validateWeekSearch,
  type WeekData,
  weekLink,
  weekSummary,
} from './data'

const ALL = [0, 1, 2, 3, 4, 5, 6]
const data = {
  meals: [
    { _id: 'm1', date: '2026-11-23', slot: 'dinner', title: 'Pasta' },
    { _id: 'm2', date: '2026-11-25', slot: 'lunch', title: 'Toast' },
  ],
  members: [],
  events: [],
  preferences: {
    slots: {
      breakfast: { enabled: false, days: ALL },
      lunch: { enabled: true, days: [2] },
      dinner: { enabled: true, days: ALL },
    },
  },
} as unknown as WeekData
const draft = (date: string, slot: string) =>
  ({ _id: `d-${date}-${slot}`, date, slot }) as unknown as Draft

test('a week in the address is its Monday; junk is dropped', () => {
  expect(validateWeekSearch({ week: '2026-11-25' })).toEqual({
    week: '2026-11-23',
  })
  expect(validateWeekSearch({ week: 'soon', meal: 3 })).toEqual({})
  expect(validateRecordSearch({ week: '2026-11-25', meal: 'm' })).toEqual({
    week: '2026-11-23',
  })
})

test('a meal wins over a draft: one panel at a time', () => {
  expect(validateWeekSearch({ meal: 'm', draft: 'd' })).toEqual({ meal: 'm' })
})

test('a row opens the panel on a desktop and its own page below', () => {
  expect(
    recordLink({ kind: 'meal', id: 'm1' }, '2026-11-23', true),
  ).toMatchObject({ search: { week: '2026-11-23', meal: 'm1' } })
  expect(recordLink({ kind: 'draft', id: 'd1' }, '2026-11-23', false)).toMatchObject(
    { params: { draftId: 'd1' }, search: { week: '2026-11-23' } },
  )
  expect(weekLink(undefined).search).toEqual({})
})

test('the summary counts the slots the Group plans', () => {
  expect(weekSummary(data, '2026-11-23')).toEqual({
    total: 8,
    planned: 2,
    slots: ['lunch', 'dinner'],
  })
})

test('a draft gives a card its slot, and a filled slot hides its draft', () => {
  expect(cardSlots(data, [draft('2026-11-24', 'lunch')], '2026-11-24')).toEqual([
    'lunch',
    'dinner',
  ])
  expect(
    openDrafts(data, [
      draft('2026-11-23', 'dinner'),
      draft('2026-11-24', 'dinner'),
    ]).map((each) => each.date),
  ).toEqual(['2026-11-24'])
})

test('a meal only moves to a slot its day plans', () => {
  const [dinner, lunch] = data.meals
  expect(canMoveTo(data, dinner, '2026-11-24')).toBe(true)
  expect(canMoveTo(data, dinner, '2026-11-23')).toBe(false)
  expect(canMoveTo(data, lunch, '2026-11-24')).toBe(false)
  expect(canMoveTo(data, lunch, '2026-11-24', 'dinner')).toBe(true)
})
