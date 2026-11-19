import { describe, expect, it } from 'vitest'
import { en, nl } from './messages'
import {
  assigneeUnavailable,
  asTaskListKind,
  groupBySection,
  iconChoices,
  normalizeTaskUrl,
  TASK_LIST_KINDS,
  TASK_LIST_TEMPLATES,
  taskListFace,
  taskUrlHost,
  templateStarters,
} from './taskLists'

describe('task list kinds', () => {
  it('reads an unknown or missing kind as a plain list', () => {
    expect(asTaskListKind(undefined)).toBe('plain')
    expect(asTaskListKind(null)).toBe('plain')
    expect(asTaskListKind('shopping-for-mars')).toBe('plain')
    expect(asTaskListKind('packing')).toBe('packing')
  })

  it('draws a list without its own face in its kind’s icon and colour', () => {
    expect(taskListFace({})).toEqual({ icon: 'list', color: 'home' })
    expect(taskListFace({ kind: 'packing' })).toEqual({
      icon: 'suitcase',
      color: 'money',
    })
    expect(
      taskListFace({ kind: 'packing', icon: 'gift', color: 'kitchen' }),
    ).toEqual({ icon: 'gift', color: 'kitchen' })
    expect(taskListFace({ icon: 'rocket', color: 'neon' })).toEqual({
      icon: 'list',
      color: 'home',
    })
  })

  it('offers the kind’s own icon first, then four others, never twice', () => {
    for (const kind of TASK_LIST_KINDS) {
      const icons = iconChoices(kind)
      expect(icons).toHaveLength(5)
      expect(icons[0]).toBe(TASK_LIST_TEMPLATES[kind].icon)
      expect(new Set(icons).size).toBe(5)
    }
  })

  it('has every starter item and section in both languages', () => {
    for (const kind of TASK_LIST_KINDS) {
      for (const { section, items } of TASK_LIST_TEMPLATES[kind].sections) {
        expect(en.tasks.starterSections[section]).toBeTruthy()
        expect(nl.tasks.starterSections[section]).toBeTruthy()
        for (const key of items) {
          expect(en.tasks.starters[key]).toBeTruthy()
          expect(nl.tasks.starters[key]).toBeTruthy()
        }
      }
    }
    expect(templateStarters(TASK_LIST_TEMPLATES.chores)).toHaveLength(8)
    expect(templateStarters(TASK_LIST_TEMPLATES.packing)).toHaveLength(18)
  })

  it('puts chores by room and packing by bag, as the design shows', () => {
    expect(
      TASK_LIST_TEMPLATES.chores.sections.map(({ section }) => section),
    ).toEqual(['kitchen', 'bathroom', 'everywhere'])
    expect(
      TASK_LIST_TEMPLATES.packing.sections.map(({ section }) => section),
    ).toEqual(['clothes', 'toiletries', 'kids'])
  })
})

describe('sections', () => {
  const sections = [
    { id: 'a', name: 'Kitchen' },
    { id: 'b', name: 'Bathroom' },
  ]

  it('draws a list without sections as one group of everything', () => {
    const tasks = [{ id: 1 }, { id: 2, sectionId: 'gone' }]
    expect(groupBySection([], tasks)).toEqual([
      { id: null, name: null, tasks },
    ])
  })

  it('groups by section in section order, keeping task order', () => {
    const tasks = [
      { id: 1, sectionId: 'b' },
      { id: 2, sectionId: 'a' },
      { id: 3, sectionId: 'b' },
    ]
    expect(
      groupBySection(sections, tasks).map((g) => [
        g.id,
        g.tasks.map((t) => t.id),
      ]),
    ).toEqual([
      ['a', [2]],
      ['b', [1, 3]],
    ])
  })

  it('puts tasks with no section, or a deleted one, first under null', () => {
    const tasks = [
      { id: 1, sectionId: 'a' },
      { id: 2 },
      { id: 3, sectionId: 'deleted' },
      { id: 4, sectionId: null },
    ]
    const groups = groupBySection(sections, tasks)
    expect(groups[0]).toEqual({
      id: null,
      name: null,
      tasks: [tasks[1], tasks[2], tasks[3]],
    })
    expect(groups.map((g) => g.id)).toEqual([null, 'a', 'b'])
  })
})

describe('wishlist links', () => {
  it('keeps http and https links and adds https to a bare address', () => {
    expect(normalizeTaskUrl(' https://example.com/a?b=1 ')).toBe(
      'https://example.com/a?b=1',
    )
    expect(normalizeTaskUrl('http://shop.nl')).toBe('http://shop.nl')
    expect(normalizeTaskUrl('bol.com/p/123')).toBe('https://bol.com/p/123')
  })

  it('refuses anything that is not a web address', () => {
    expect(normalizeTaskUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeTaskUrl('JavaScript:alert(1)')).toBeNull()
    expect(normalizeTaskUrl('file:///etc/passwd')).toBeNull()
    expect(normalizeTaskUrl('data:text/html,hi')).toBeNull()
    expect(normalizeTaskUrl('not a link')).toBeNull()
    expect(normalizeTaskUrl('localhost')).toBeNull()
    expect(normalizeTaskUrl('')).toBeNull()
    expect(normalizeTaskUrl(`https://a.nl/${'x'.repeat(2048)}`)).toBeNull()
  })

  it('shows the host without www', () => {
    expect(taskUrlHost('https://www.bol.com/p/123')).toBe('bol.com')
  })
})

describe('who a task can be given to (APP-302, ADR-0021 capabilities)', () => {
  it('lets a local list take any current Member', () => {
    expect(assigneeUnavailable({ provider: 'local', writable: true })).toBeNull()
  })

  it('turns Todoist off until Gather can write to it, then only for shared projects', () => {
    // Every linked list today: no provider write path yet.
    expect(
      assigneeUnavailable({ provider: 'todoist', writable: false, shared: true }),
    ).toBe('readOnly')
    expect(
      assigneeUnavailable({ provider: 'todoist', writable: true, shared: false }),
    ).toBe('notShared')
    expect(
      assigneeUnavailable({ provider: 'todoist', writable: true }),
    ).toBe('notShared')
    expect(
      assigneeUnavailable({ provider: 'todoist', writable: true, shared: true }),
    ).toBeNull()
  })

  it('never offers it on Notion, writable or not', () => {
    expect(assigneeUnavailable({ provider: 'notion', writable: false })).toBe(
      'unsupported',
    )
    expect(assigneeUnavailable({ provider: 'notion', writable: true })).toBe(
      'unsupported',
    )
  })

  it('has an explanation in both languages for every reason', () => {
    for (const reason of ['readOnly', 'notShared', 'unsupported'] as const) {
      expect(en.tasks.assignee.unavailable[reason]).toContain('{provider}')
      expect(nl.tasks.assignee.unavailable[reason]).toContain('{provider}')
    }
  })
})
