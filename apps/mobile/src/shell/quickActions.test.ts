import { describe, expect, test } from 'vitest'

import { QUICK_ACTIONS } from './quickActions'
import { SHELL_TABS } from './tabs'

describe('mobile app destinations', () => {
  test('keeps the five app-level destinations fixed', () => {
    expect(SHELL_TABS.map(({ name }) => name)).toEqual([
      'home',
      'search',
      'add',
      'settings',
      'all',
    ])
  })

  test('lets each working quick action declare how it opens', () => {
    expect(QUICK_ACTIONS.map(({ id, kind }) => ({ id, kind }))).toEqual([
      { id: 'task-new', kind: 'row' },
      { id: 'recipe-import', kind: 'handoff' },
      { id: 'meal-log', kind: 'sheet' },
      { id: 'food-scan', kind: 'handoff' },
    ])
  })

  test('a handoff into a built Module names its own screen', () => {
    const action = QUICK_ACTIONS.find(({ id }) => id === 'recipe-import')
    expect(action && 'href' in action ? action.href : null).toBe(
      '/home/recipes/import',
    )
  })

  test('a handoff with nowhere built yet falls through to the shared form', () => {
    const action = QUICK_ACTIONS.find(({ id }) => id === 'food-scan')
    expect(action && 'href' in action).toBe(false)
  })

  test('writing a recipe from blank is not advertised in the launcher', () => {
    expect(QUICK_ACTIONS.map(({ id }) => id)).not.toContain('recipe-new')
  })
})
