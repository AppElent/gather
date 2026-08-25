import { TASTING_KINDS } from '@gather/core/tastings'
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
      { id: 'cheese-tasting', kind: 'compose' },
      { id: 'wine-tasting', kind: 'compose' },
      { id: 'beer-tasting', kind: 'compose' },
      { id: 'task-new', kind: 'row' },
      { id: 'recipe-import', kind: 'sheet' },
      { id: 'meal-log', kind: 'sheet' },
      { id: 'recipe-new', kind: 'handoff' },
      { id: 'food-scan', kind: 'handoff' },
    ])
  })

  /**
   * Three rows, one per Kind — the launcher is a flat list of verbs, and a
   * Kind chooser inside one "Tasting" row would cost everyone a tap to save
   * three rows nobody minds. A fourth Kind therefore has to appear here too.
   */
  test('offers every tasting Kind its own row, each naming which', () => {
    const composing = QUICK_ACTIONS.filter(
      (action) => action.kind === 'compose',
    )
    expect(composing.map((action) => action.tastingKind)).toEqual([
      ...TASTING_KINDS,
    ])
  })

  test('and only a compose action names a Kind', () => {
    for (const action of QUICK_ACTIONS) {
      if (action.kind === 'compose') continue
      expect(action, action.id).not.toHaveProperty('tastingKind')
    }
  })
})
