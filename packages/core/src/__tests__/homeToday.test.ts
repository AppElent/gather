import { describe, expect, it } from 'vitest'

import {
  clockTime,
  dueTodayTasks,
  overdueListCount,
  overdueListId,
  overdueTasks,
  railEntries,
  spelledDate,
  startOfDay,
} from '../homeToday'
import { en, nl } from '../messages'

const TODAY = '2026-11-16'

const task = (
  id: string,
  fields: { done?: boolean; dueDate?: string; listId?: string } = {},
) => ({ id, done: false, listId: 'a', ...fields })

describe('overdueTasks', () => {
  it('keeps open tasks due before today, and nothing else', () => {
    const tasks = [
      task('late', { dueDate: '2026-11-15' }),
      task('done-late', { dueDate: '2026-11-01', done: true }),
      task('today', { dueDate: TODAY }),
      task('later', { dueDate: '2026-11-20' }),
      task('undated'),
    ]
    expect(overdueTasks(tasks, TODAY).map((t) => t.id)).toEqual(['late'])
  })
})

describe('dueTodayTasks', () => {
  it('keeps open tasks due today only', () => {
    const tasks = [
      task('today', { dueDate: TODAY }),
      task('done-today', { dueDate: TODAY, done: true }),
      task('late', { dueDate: '2026-11-15' }),
      task('undated'),
    ]
    expect(dueTodayTasks(tasks, TODAY).map((t) => t.id)).toEqual(['today'])
  })
})

describe('overdueListId', () => {
  it('names the list when every overdue task is on it', () => {
    expect(overdueListId([task('1'), task('2')])).toBe('a')
  })

  it('is null across several lists, so Tasks itself opens', () => {
    const spread = [task('1'), task('2', { listId: 'b' })]
    expect(overdueListId(spread)).toBeNull()
    expect(overdueListCount(spread)).toBe(2)
  })

  it('is null with nothing overdue', () => {
    expect(overdueListId([])).toBeNull()
  })
})

describe('railEntries', () => {
  const noon = new Date(2026, 10, 16, 12, 0).getTime()
  const dayStart = startOfDay(noon)
  const at = (h: number, m: number) => new Date(2026, 10, 16, h, m).getTime()
  const children = [
    { _id: 'sanne', name: 'Sanne' },
    { _id: 'daan', name: 'Daan' },
  ]
  const words = en.shell.today
  const babyLog = en.baby.log

  it("puts every child's entries from today in time order, ending at now", () => {
    const events = {
      sanne: [
        {
          _id: 'bottle',
          type: 'feeding',
          timestamp: at(9, 22),
          data: { method: 'bottle', amountMl: 120 },
        },
        // Yesterday evening: not today.
        {
          _id: 'old',
          type: 'diaper',
          timestamp: at(9, 0) - 86_400_000,
          data: { kind: 'wet' },
        },
        // Typed ahead for this evening: not past yet.
        {
          _id: 'later',
          type: 'diaper',
          timestamp: at(18, 0),
          data: { kind: 'wet' },
        },
      ],
      daan: [
        {
          _id: 'nap',
          type: 'sleep',
          timestamp: at(8, 5),
          endTimestamp: at(9, 15),
          data: {},
        },
      ],
    }
    const rail = railEntries(children, events, {
      dayStart,
      now: noon,
      babyLog,
      words,
    })
    expect(rail.map((entry) => entry.id)).toEqual(['nap', 'bottle'])
    expect(rail[0]?.line).toBe('Sleep · 1 h 10 min · Daan')
    expect(rail[1]?.line).toBe('Bottle · 120 ml · Sanne')
  })

  it('skips a child whose entries are loading or failed', () => {
    const rail = railEntries(
      children,
      { sanne: undefined, daan: new Error('nope') },
      { dayStart, now: noon, babyLog, words },
    )
    expect(rail).toEqual([])
  })
})

describe('clockTime', () => {
  it('is the 24-hour clock with leading zeros', () => {
    expect(clockTime(new Date(2026, 10, 16, 8, 5).getTime())).toBe('08:05')
    expect(clockTime(new Date(2026, 10, 16, 18, 30).getTime())).toBe('18:30')
  })
})

describe('spelledDate', () => {
  const monday = new Date(2026, 10, 16, 9, 0).getTime()

  it('spells the date out in English', () => {
    expect(spelledDate(monday, 'en', en.shell.today.date)).toBe(
      'Monday 16 November',
    )
  })

  it('starts the Dutch date with a capital', () => {
    expect(spelledDate(monday, 'nl', nl.shell.today.date)).toBe(
      'Maandag 16 november',
    )
  })
})
