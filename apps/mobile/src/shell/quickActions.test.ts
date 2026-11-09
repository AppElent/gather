import { TASTING_KINDS } from '@gather/core/tastings'
import { describe, expect, test } from 'vitest'

import { QUICK_ACTIONS } from './quickActions'

describe('the Add tab launcher', () => {
  test('lets each working quick action declare how it opens', () => {
    expect(QUICK_ACTIONS.map(({ id, kind }) => ({ id, kind }))).toEqual([
      { id: 'cheese-tasting', kind: 'compose' },
      { id: 'wine-tasting', kind: 'compose' },
      { id: 'beer-tasting', kind: 'compose' },
      { id: 'task-new', kind: 'row' },
      { id: 'recipe-import', kind: 'handoff' },
    ])
  })

  test('offers nothing for Nutrition, which has no phone screens', () => {
    expect(
      QUICK_ACTIONS.filter((action) => action.module === 'nutrition'),
    ).toEqual([])
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

  test('writing a recipe from blank is not advertised in the launcher', () => {
    expect(QUICK_ACTIONS.map(({ id }) => id)).not.toContain('recipe-new')
  })
})
