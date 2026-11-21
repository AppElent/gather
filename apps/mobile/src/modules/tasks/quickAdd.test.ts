import { en as coreEn } from '@gather/core/messages'
import { parseQuickAdd } from '@gather/core/task-quick-add'
import { describe, expect, test } from 'vitest'

import { quickAddChipLabel, quickAddLists, quickAddTarget } from './quickAdd'

const enRepeat = coreEn.tasks.repeat.summary

const list = (id: string, order: number, writable = true) => ({
  _id: id,
  name: id,
  order,
  writable,
})

describe("the Add tab's task lists", () => {
  test('offers only lists Gather can write to, in list order', () => {
    const lists = [list('b', 2), list('notion', 0, false), list('a', 1)]
    expect(quickAddLists(lists).map(({ _id }) => _id)).toEqual(['a', 'b'])
  })

  test('aims at the first list until somebody picks another', () => {
    const lists = quickAddLists([list('a', 0), list('b', 1)])
    expect(quickAddTarget(lists, null)?._id).toBe('a')
    expect(quickAddTarget(lists, 'b')?._id).toBe('b')
  })

  test('falls back to the first list when the pick is no longer offered', () => {
    const lists = quickAddLists([list('a', 0), list('gone', 1, false)])
    expect(quickAddTarget(lists, 'gone')?._id).toBe('a')
  })

  test('has nowhere to aim when no list is writable', () => {
    expect(quickAddTarget(quickAddLists([list('n', 0, false)]), null)).toBe(
      undefined,
    )
  })
})

describe('quick add chips', () => {
  const words = {
    today: 'Today',
    tomorrow: 'Tomorrow',
    repeat: enRepeat,
  }
  const today = '2026-11-18'
  const chip = (text: string, locale = 'en-GB') => {
    const parsed = parseQuickAdd(text, {
      today,
      now: '10:00',
      members: [{ id: 'd', name: 'Daan' }],
    })
    return parsed.parts.map((part) =>
      quickAddChipLabel(part, parsed, today, locale, words),
    )
  }

  test('says a near date with its word and the date itself', () => {
    expect(chip('Bins tomorrow')).toEqual(['Tomorrow, Thu 19 Nov'])
    expect(chip('Bins vrijdag')).toEqual(['Fri 20 Nov'])
  })

  test('adds the year to a date in another year', () => {
    expect(chip('Tandarts 12/3')).toEqual(['Fri, 12 Mar 2027'])
  })

  test('names a repeat on the weekday of its due date', () => {
    expect(chip('Bins tomorrow every week')).toEqual([
      'Tomorrow, Thu 19 Nov',
      'Every week, Thu',
    ])
  })

  test('shows a time, a Member and a label as typed', () => {
    expect(chip('Call at 9:00 @daan #home')).toEqual(['09:00', 'Daan', '#home'])
  })
})
