import { parseQuickAdd } from '@gather/core/task-quick-add'
import { describe, expect, test } from 'vitest'

import {
  afterTyping,
  composedTask,
  dateShortcuts,
  draftAfterHold,
  emptyDraft,
  isDirty,
  lineAfterChoice,
  nextDraft,
  QUICK_REPEATS,
  type TaskDraft,
} from './composerDraft'

const today = '2026-11-18' // a Wednesday
const parse = (line: string, dismissed: readonly string[] = []) =>
  parseQuickAdd(line, {
    today,
    now: '10:00',
    members: [{ id: 'daan', name: 'Daan' }],
    dismissed,
  })
const drafted = (line: string, rest: Partial<TaskDraft> = {}): TaskDraft => ({
  ...emptyDraft({}),
  line,
  ...rest,
})

describe('the task a draft saves', () => {
  test('reads the line into the same details a tap sets', () => {
    const line = 'Stofzuigen morgen elke week @Daan #keuken'
    const task = composedTask(drafted(line), parse(line))
    expect(task).toMatchObject({
      title: 'Stofzuigen',
      dueDate: '2026-11-19',
      assigneeId: 'daan',
      labels: ['keuken'],
    })
    expect(task.repeat).toBeDefined()
  })

  test('a tapped value wins over what the line read', () => {
    const line = 'Bins tomorrow'
    const task = composedTask(
      drafted(line, { choices: { dueDate: '2026-11-25', labels: [] } }),
      parse(line),
    )
    expect(task.dueDate).toBe('2026-11-25')
  })

  test('chosen none hides what the line read', () => {
    const line = 'Bins tomorrow'
    const task = composedTask(
      drafted(line, { choices: { dueDate: null, labels: [] } }),
      parse(line),
    )
    expect(task.dueDate).toBeUndefined()
  })

  test('a typed time is a reminder on the task’s day', () => {
    const line = 'Call the vet tomorrow 14:30'
    const task = composedTask(drafted(line), parse(line))
    expect(task.reminder).toEqual({ date: '2026-11-19', time: '14:30' })
  })

  test('labels picked and typed are both kept, once', () => {
    const line = 'Weed #garden'
    const task = composedTask(
      drafted(line, { choices: { labels: ['garden', 'weekend'] } }),
      parse(line),
    )
    expect(task.labels).toEqual(['garden', 'weekend'])
  })

  test('the description is the notes, trimmed; an empty one is none', () => {
    expect(composedTask(drafted('A', { body: '  bring keys ' }), parse('A')).notes).toBe(
      'bring keys',
    )
    expect(composedTask(drafted('A', { body: '   ' }), parse('A')).notes).toBeUndefined()
  })

  test('a typed repeat takes its weekday from the date picked on the chip', () => {
    const line = 'Bins every week'
    // Today is a Wednesday; Friday the 20th is picked on the date chip.
    const task = composedTask(
      drafted(line, { choices: { dueDate: '2026-11-20', labels: [] } }),
      parse(line),
    )
    expect(task.repeat).toMatchObject({ unit: 'week', every: 1, weekdays: [5] })
  })

  test('a typed monthly repeat takes its day from the date picked on the chip', () => {
    const line = 'Rent every month'
    const task = composedTask(
      drafted(line, { choices: { dueDate: '2026-12-03', labels: [] } }),
      parse(line),
    )
    expect(task.repeat).toMatchObject({ unit: 'month', monthDay: 3 })
  })

  test('a weekday typed in the repeat stays, whatever date is picked', () => {
    const line = 'Gym every tuesday'
    const task = composedTask(
      drafted(line, { choices: { dueDate: '2026-11-20', labels: [] } }),
      parse(line),
    )
    expect(task.repeat).toMatchObject({ unit: 'week', weekdays: [2] })
  })

  test('priority comes from a tap only', () => {
    const task = composedTask(
      drafted('A', { choices: { priority: 2, labels: [] } }),
      parse('A'),
    )
    expect(task.priority).toBe(2)
  })
})

describe('a tap and the line', () => {
  test('tapping a date takes the words the line read for it out', () => {
    const line = 'Bins tomorrow at the front'
    expect(lineAfterChoice(line, parse(line), 'date')).toBe('Bins at the front')
  })

  test('leaves the other kinds alone', () => {
    const line = 'Bins tomorrow @Daan'
    expect(lineAfterChoice(line, parse(line), 'member')).toBe('Bins tomorrow')
  })

  test('typing a new part of a kind replaces the tapped value', () => {
    const before = new Set(parse('Bins').parts.map((part) => part.key))
    const choices = { dueDate: '2026-11-25', priority: 1 as const, labels: [] }
    const next = afterTyping(choices, before, parse('Bins tomorrow').parts)
    expect(next.dueDate).toBeUndefined()
    expect(next.priority).toBe(1)
  })

  test('a part already there replaces nothing', () => {
    const parts = parse('Bins tomorrow').parts
    const before = new Set(parts.map((part) => part.key))
    const choices = { dueDate: null, labels: [] }
    expect(afterTyping(choices, before, parts)).toBe(choices)
  })
})

describe('the draft between tasks', () => {
  test('starts with what the place chooses', () => {
    const draft = emptyDraft({ listId: 'l1', dueDate: today, assigneeId: 'me' })
    expect(draft.listId).toBe('l1')
    expect(draft.choices).toEqual({ dueDate: today, assigneeId: 'me', labels: [] })
    expect(isDirty(draft, { listId: 'l1', dueDate: today, assigneeId: 'me' })).toBe(
      false,
    )
  })

  test('after a save: empty, on the list it was on, the place’s date back', () => {
    const preset = { listId: 'l1', dueDate: today }
    const draft: TaskDraft = {
      line: 'Bins',
      dismissed: ['x'],
      body: 'notes',
      showBody: true,
      listId: 'l2',
      choices: { dueDate: '2026-12-01', priority: 1, labels: ['a'] },
      saveKey: 'composer-saved-one',
    }
    const next = nextDraft(draft, preset)
    expect(next).toEqual({
      ...emptyDraft(preset),
      listId: 'l2',
      saveKey: expect.any(String),
    })
    // The next task is a new create, never a replay of the one just saved.
    expect(next.saveKey).not.toBe(draft.saveKey)
  })

  test('a composer reopened mid-save never gets the held draft back', () => {
    const preset = { listId: 'l1', dueDate: today }
    const held: TaskDraft = {
      ...emptyDraft(preset),
      line: 'Bins',
      listId: 'l2',
      saveKey: 'composer-held',
    }
    // Saved: the next task, on the list it went to.
    const saved = draftAfterHold(true, held, preset)
    expect(saved).toMatchObject({ line: '', listId: 'l2' })
    expect(saved.saveKey).not.toBe(held.saveKey)
    // Discarded: gone, back to what the place starts with.
    const discarded = draftAfterHold(false, held, preset)
    expect(discarded).toMatchObject({ line: '', listId: 'l1', body: '' })
    expect(discarded.saveKey).not.toBe(held.saveKey)
  })

  test('every new draft has its own save key, long enough for the server', () => {
    const a = emptyDraft({})
    const b = emptyDraft({})
    expect(a.saveKey).not.toBe(b.saveKey)
    expect(a.saveKey.length).toBeGreaterThanOrEqual(8)
    expect(a.saveKey.length).toBeLessThanOrEqual(100)
  })

  test('is kept on close once anything is typed or chosen', () => {
    const preset = { dueDate: today }
    expect(isDirty(emptyDraft(preset), preset)).toBe(false)
    expect(isDirty({ ...emptyDraft(preset), line: 'x' }, preset)).toBe(true)
    expect(isDirty({ ...emptyDraft(preset), body: 'x' }, preset)).toBe(true)
    expect(
      isDirty(
        { ...emptyDraft(preset), choices: { dueDate: null, labels: [] } },
        preset,
      ),
    ).toBe(true)
    expect(
      isDirty(
        {
          ...emptyDraft(preset),
          choices: { dueDate: today, repeat: QUICK_REPEATS.week, labels: [] },
        },
        preset,
      ),
    ).toBe(true)
  })
})

test('the date menu’s shortcuts', () => {
  expect(dateShortcuts(today, '2026-11-21')).toEqual({
    today,
    tomorrow: '2026-11-19',
    weekend: '2026-11-21',
    nextWeek: '2026-11-23',
  })
})
