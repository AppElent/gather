import { describe, expect, test } from 'vitest'

import { QUICK_ACTIONS } from './quickActions'
import { SHELL_TABS } from './tabs'

describe('mobile app destinations', () => {
  test('keeps the five app-level destinations fixed', () => {
    expect(SHELL_TABS.map(({ name }) => name)).toEqual([
      'home',
      'search',
      'add',
      'profile',
      'all',
    ])
  })

  test('lets each working quick action declare how it opens', () => {
    expect(QUICK_ACTIONS.map(({ id, kind }) => ({ id, kind }))).toEqual([
      { id: 'task-new', kind: 'row' },
      { id: 'recipe-import', kind: 'sheet' },
      { id: 'meal-log', kind: 'sheet' },
      { id: 'recipe-new', kind: 'handoff' },
      { id: 'food-scan', kind: 'handoff' },
    ])
  })
})
