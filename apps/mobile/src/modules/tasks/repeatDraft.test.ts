import { sameRepeat, type TaskRepeat } from '@gather/core/task-repeat'
import { describe, expect, test } from 'vitest'

import { draftRule, repeatDraft } from './repeatDraft'

const TODAY = '2026-11-19'

/** What the sheet would save if opened on `task` and closed with Klaar. */
const reopened = (task: { repeat?: TaskRepeat; dueDate?: string }) =>
  draftRule(repeatDraft(task, TODAY), task.dueDate ?? TODAY)

describe('the Repeat sheet opened and closed unchanged (APP-303)', () => {
  test('a monthly rule on the 31st, waiting on the 30th, keeps the 31st', () => {
    const repeat: TaskRepeat = {
      mode: 'fixed',
      unit: 'month',
      every: 1,
      monthDay: 31,
    }
    const rule = reopened({ repeat, dueDate: '2026-11-30' })
    expect(rule).toEqual(repeat)
    expect(sameRepeat(rule, repeat)).toBe(true)
  })

  test('a yearly rule on 29 February, waiting on the 28th, keeps the 29th', () => {
    const repeat: TaskRepeat = {
      mode: 'fixed',
      unit: 'year',
      every: 1,
      month: 2,
      monthDay: 29,
    }
    expect(reopened({ repeat, dueDate: '2027-02-28' })).toEqual(repeat)
  })

  test('a weekly and an after-done rule come back as they were', () => {
    const weekly: TaskRepeat = {
      mode: 'fixed',
      unit: 'week',
      every: 2,
      weekdays: [2, 6],
    }
    const afterDone: TaskRepeat = { mode: 'afterDone', unit: 'day', every: 3 }
    expect(reopened({ repeat: weekly, dueDate: '2026-11-21' })).toEqual(weekly)
    expect(reopened({ repeat: afterDone })).toEqual(afterDone)
  })

  test('every 2 months instead of 1 keeps the 31st', () => {
    const draft = repeatDraft(
      {
        repeat: { mode: 'fixed', unit: 'month', every: 1, monthDay: 31 },
        dueDate: '2026-11-30',
      },
      TODAY,
    )
    const everyOther = { ...draft, fixed: { ...draft.fixed, every: 2 } }
    expect(draftRule(everyOther, '2026-11-30')).toEqual({
      mode: 'fixed',
      unit: 'month',
      every: 2,
      monthDay: 31,
    })
  })

  test('changing the unit takes the day from the due date', () => {
    const draft = repeatDraft(
      {
        repeat: { mode: 'fixed', unit: 'month', every: 1, monthDay: 31 },
        dueDate: '2026-11-30',
      },
      TODAY,
    )
    const yearly = { ...draft, fixed: { ...draft.fixed, unit: 'year' as const } }
    expect(draftRule(yearly, '2026-11-30')).toEqual({
      mode: 'fixed',
      unit: 'year',
      every: 1,
      month: 11,
      monthDay: 30,
    })
  })

  test('a new monthly rule takes the due date’s day', () => {
    const draft = repeatDraft({ dueDate: '2026-11-30' }, TODAY)
    const monthly = {
      ...draft,
      mode: 'fixed' as const,
      fixed: { ...draft.fixed, unit: 'month' as const },
    }
    expect(draftRule(monthly, '2026-11-30')).toMatchObject({ monthDay: 30 })
  })
})
