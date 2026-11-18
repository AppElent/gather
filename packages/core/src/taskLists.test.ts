import { describe, expect, it } from 'vitest'
import { en, nl } from './messages'
import {
  asTaskListKind,
  iconChoices,
  normalizeTaskUrl,
  TASK_LIST_KINDS,
  TASK_LIST_TEMPLATES,
  taskListFace,
  taskUrlHost,
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

  it('has every starter item in both languages', () => {
    for (const kind of TASK_LIST_KINDS) {
      for (const key of TASK_LIST_TEMPLATES[kind].starters) {
        expect(en.tasks.starters[key]).toBeTruthy()
        expect(nl.tasks.starters[key]).toBeTruthy()
      }
    }
    expect(TASK_LIST_TEMPLATES.chores.starters).toHaveLength(8)
    expect(TASK_LIST_TEMPLATES.packing.starters).toHaveLength(18)
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
