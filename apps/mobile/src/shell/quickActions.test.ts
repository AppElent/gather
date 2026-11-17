import { TASTING_KINDS } from '@gather/core/tastings'
import { describe, expect, test } from 'vitest'

import {
  QUICK_ACTIONS,
  quickCardsSection,
  quickGridColumns,
  quickGridRows,
  quickTileWidth,
} from './quickActions'

describe('the Add tab launcher', () => {
  test('lets each working quick action declare how it opens', () => {
    expect(QUICK_ACTIONS.map(({ id, kind }) => ({ id, kind }))).toEqual([
      { id: 'cheese-tasting', kind: 'compose' },
      { id: 'wine-tasting', kind: 'compose' },
      { id: 'beer-tasting', kind: 'compose' },
      { id: 'task-new', kind: 'row' },
      { id: 'recipe-import', kind: 'handoff' },
      { id: 'loyalty-card-add', kind: 'handoff' },
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

  test('writing a recipe from blank is not advertised in the launcher', () => {
    expect(QUICK_ACTIONS.map(({ id }) => id)).not.toContain('recipe-new')
  })
})

describe('the quick-actions sheet’s Loyalty cards (APP-206)', () => {
  const ah = { _id: 'ah', storeName: 'Albert Heijn', lastUsedAt: 300 }
  const jumbo = { _id: 'jumbo', storeName: 'Jumbo', lastUsedAt: 200 }
  const hema = { _id: 'hema', storeName: 'HEMA' }

  test('shows the live cards last used first, with their usage', () => {
    const section = quickCardsSection({
      live: [hema, jumbo, ah],
      shown: [hema, jumbo, ah],
      saved: undefined,
    })
    expect(section).toEqual({
      kind: 'cards',
      cards: [ah, jumbo, hema],
      usageKnown: true,
    })
  })

  test('shows a copy in its saved order, without claiming usage', () => {
    const copy = [jumbo, ah, hema].map(({ _id, storeName }) => ({
      _id,
      storeName,
    }))
    expect(
      quickCardsSection({ live: undefined, shown: copy, saved: undefined }),
    ).toEqual({ kind: 'cards', cards: copy, usageKnown: false })
    expect(
      quickCardsSection({ live: undefined, shown: undefined, saved: copy }),
    ).toEqual({ kind: 'cards', cards: copy, usageKnown: false })
  })

  test('prefers the live answer over any copy', () => {
    const section = quickCardsSection({
      live: [ah],
      shown: [ah],
      saved: [jumbo, hema],
    })
    expect(section.kind === 'cards' && section.cards).toEqual([ah])
  })

  test('a Group with no cards offers the scanner, not a wait', () => {
    expect(
      quickCardsSection({ live: [], shown: [], saved: undefined }),
    ).toEqual({ kind: 'empty' })
    expect(
      quickCardsSection({ live: undefined, shown: undefined, saved: [] }),
    ).toEqual({ kind: 'empty' })
  })

  test('nothing to show yet is loading', () => {
    expect(
      quickCardsSection({
        live: undefined,
        shown: undefined,
        saved: undefined,
      }),
    ).toEqual({ kind: 'loading' })
  })
})

describe('the quick-actions sheet’s Add grid (APP-206)', () => {
  test('is three columns, and two at the accessibility text sizes', () => {
    expect(quickGridColumns(1)).toBe(3)
    expect(quickGridColumns(1.35)).toBe(3)
    expect(quickGridColumns(1.5)).toBe(2)
    expect(quickGridColumns(3)).toBe(2)
  })

  test('keeps every action, in order, padding only the last row', () => {
    const ids = QUICK_ACTIONS.map(({ id }) => id)
    for (const columns of [2, 3]) {
      const rows = quickGridRows(ids, columns)
      expect(rows.every((row) => row.length === columns)).toBe(true)
      expect(rows.flat().filter(Boolean)).toEqual(ids)
    }
    expect(quickGridRows(['a', 'b', 'c', 'd'], 3)).toEqual([
      ['a', 'b', 'c'],
      ['d', null, null],
    ])
    expect(quickGridRows([], 3)).toEqual([])
  })

  test('gives every column the same width, gaps included', () => {
    expect(quickTileWidth(0, 3, 12)).toBeUndefined()
    expect(quickTileWidth(342, 3, 12)).toBe(106)
    expect(quickTileWidth(342, 2, 12)).toBe(165)
    // Rounded down, so three columns never overflow the row.
    expect(3 * (quickTileWidth(343, 3, 12) ?? 0) + 2 * 12).toBeLessThanOrEqual(
      343,
    )
  })
})
