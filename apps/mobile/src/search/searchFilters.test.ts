import { TASTING_KIND_SPECS, type TastingKind } from '@gather/core/tastings'
import { describe, expect, it } from 'vitest'

import {
  applyFilters,
  dayOf,
  type FilterableRecord,
  groupByModule,
  initialFilters,
  inWhen,
  moduleFilters,
  moduleOf,
  narrowed,
  searchModuleOfKind,
  typesFor,
  withModule,
} from './searchFilters'

const TODAY = '2026-11-25' // a Wednesday

const at = (iso: string) => new Date(`${iso}T12:00:00`).getTime()

const records: (FilterableRecord & { id: string })[] = [
  { id: 'open-task', type: 'task', done: false, createdBy: 'sam', dueDate: TODAY },
  { id: 'done-task', type: 'task', done: true, createdBy: 'ann', creationTime: at('2026-10-02') },
  { id: 'note', type: 'note', createdBy: 'sam', creationTime: at('2026-11-23') },
  { id: 'recipe', type: 'recipe', createdBy: 'ann', creationTime: at('2026-11-02') },
  { id: 'event', type: 'calendarEvent', createdBy: 'ann', date: '2026-11-30', creationTime: at('2026-01-01') },
  { id: 'wine', type: 'tasting', kind: 'wine', createdBy: 'sam', creationTime: at(TODAY) },
]

const ids = (found: { id: string }[]) => found.map((record) => record.id)

describe('moduleOf', () => {
  it('reads a tasting’s Module from its Kind', () => {
    expect(moduleOf({ type: 'tasting', kind: 'wine' })).toBe('wines')
    expect(moduleOf({ type: 'tasting', kind: 'cheese' })).toBe('cheeses')
    expect(moduleOf({ type: 'tasting' })).toBeNull()
    expect(moduleOf({ type: 'loyaltyCard' })).toBe('loyalty-cards')
  })
})

describe('typesFor', () => {
  it('asks for one Module’s type, or every shown Module’s under All', () => {
    expect(typesFor('tasks', () => true)).toEqual(['task'])
    expect(typesFor('wines', () => true)).toEqual(['tasting'])
    expect(typesFor(null, (id) => id !== 'loyalty-cards')).toEqual([
      'task',
      'note',
      'recipe',
      'calendarEvent',
      'tasting',
    ])
    expect(typesFor(null, (id) => id === 'notes')).toEqual(['note'])
  })
})

describe('the Module’s own filters', () => {
  it('gives Tasks a Status and the others nothing', () => {
    expect(moduleFilters('tasks')).toEqual(['status'])
    expect(moduleFilters('notes')).toEqual([])
    expect(moduleFilters(null)).toEqual([])
  })

  it('drops Status when the Module changes and keeps the shared filters', () => {
    const tasks = { ...initialFilters('tasks'), status: 'done' as const, who: 'sam', when: 'week' as const }
    expect(withModule(tasks, 'notes')).toEqual({ module: 'notes', who: 'sam', when: 'week', status: null })
    expect(withModule(tasks, null).status).toBeNull()
    expect(withModule(tasks, 'tasks').status).toBe('done')
  })
})

describe('When', () => {
  it('uses an event’s date, a task’s due date, and otherwise the day it was added', () => {
    expect(dayOf(records[4])).toBe('2026-11-30')
    expect(dayOf(records[0])).toBe(TODAY)
    expect(dayOf(records[1])).toBe('2026-10-02')
    expect(dayOf({ type: 'note' })).toBeNull()
  })

  it('nests today in this week in this month, with Earlier before the month', () => {
    expect(inWhen(TODAY, 'today', TODAY)).toBe(true)
    expect(inWhen('2026-11-23', 'week', TODAY)).toBe(true) // Monday
    expect(inWhen('2026-11-29', 'week', TODAY)).toBe(true) // Sunday
    expect(inWhen('2026-11-30', 'week', TODAY)).toBe(false)
    expect(inWhen('2026-11-01', 'month', TODAY)).toBe(true)
    expect(inWhen('2026-10-31', 'month', TODAY)).toBe(false)
    expect(inWhen('2026-10-31', 'earlier', TODAY)).toBe(true)
    expect(inWhen('2026-11-01', 'earlier', TODAY)).toBe(false)
  })
})

describe('applyFilters', () => {
  it('passes everything with no filters', () => {
    expect(applyFilters(records, initialFilters(), TODAY)).toHaveLength(records.length)
  })

  it('narrows by Module, Who and When together', () => {
    expect(ids(applyFilters(records, initialFilters('tasks'), TODAY))).toEqual(['open-task', 'done-task'])
    expect(ids(applyFilters(records, { ...initialFilters(), who: 'sam' }, TODAY))).toEqual(['open-task', 'note', 'wine'])
    expect(ids(applyFilters(records, { ...initialFilters(), when: 'today' }, TODAY))).toEqual(['open-task', 'wine'])
    expect(ids(applyFilters(records, { ...initialFilters(), when: 'week' }, TODAY))).toEqual(['open-task', 'note', 'wine'])
    expect(ids(applyFilters(records, { ...initialFilters(), when: 'earlier' }, TODAY))).toEqual(['done-task'])
    expect(ids(applyFilters(records, { ...initialFilters(), who: 'ann', when: 'month' }, TODAY))).toEqual(['recipe', 'event'])
  })

  it('reads Status on tasks, and a task with no `done` as open', () => {
    const open = { ...initialFilters('tasks'), status: 'open' as const }
    const done = { ...initialFilters('tasks'), status: 'done' as const }
    expect(ids(applyFilters(records, open, TODAY))).toEqual(['open-task'])
    expect(ids(applyFilters(records, done, TODAY))).toEqual(['done-task'])
    expect(ids(applyFilters([{ id: 'old', type: 'task' }], open, TODAY))).toEqual(['old'])
  })

  it('says whether anything past the Module narrows', () => {
    expect(narrowed(initialFilters('tasks'))).toBe(false)
    expect(narrowed({ ...initialFilters(), when: 'today' })).toBe(true)
  })
})

describe('groupByModule', () => {
  it('groups in the Module order and keeps rank order inside a group', () => {
    const grouped = groupByModule([records[2], records[0], records[5], records[1], { id: 'loose', type: 'tasting' }])
    expect(grouped.map((group) => group.module)).toEqual(['tasks', 'notes', 'wines'])
    expect(ids(grouped[0].records)).toEqual(['open-task', 'done-task'])
  })
})

describe('searchModuleOfKind', () => {
  it('agrees with the catalogue’s Module for every Kind', () => {
    for (const [kind, spec] of Object.entries(TASTING_KIND_SPECS)) {
      expect(searchModuleOfKind(kind as TastingKind)).toBe(spec.moduleId)
    }
  })
})
