import { describe, expect, test } from 'vitest'

import {
  plotTrend,
  type TrendSource,
  toPolyline,
  trendValues,
} from './trendPoints'

describe('pulling measurements out of the log', () => {
  const events: TrendSource[] = [
    { type: 'growth', timestamp: 30, data: { weightKg: 6.8 } },
    { type: 'growth', timestamp: 10, data: { weightKg: 5.1 } },
    { type: 'growth', timestamp: 20, data: { heightCm: 62 } },
    { type: 'feeding', timestamp: 25, data: { amountMl: 120 } },
  ]

  test('oldest first, whatever order they were logged in', () => {
    expect(trendValues(events, 'growth', 'weightKg')).toEqual([
      { at: 10, value: 5.1 },
      { at: 30, value: 6.8 },
    ])
  })

  test('an entry of the right type without that measurement is skipped', () => {
    expect(trendValues(events, 'growth', 'headCircumferenceCm')).toEqual([])
  })
})

describe('scaling into the box', () => {
  test('one point is not a trend', () => {
    expect(plotTrend([{ at: 1, value: 5 }], 100, 50)).toBeNull()
  })

  test('two points span the full width', () => {
    const plotted = plotTrend(
      [
        { at: 0, value: 1 },
        { at: 10, value: 3 },
      ],
      100,
      50,
    )
    expect(plotted?.points[0]).toEqual({ x: 0, y: 50 })
    expect(plotted?.points[1]).toEqual({ x: 100, y: 0 })
  })

  test('identical values sit in the middle, not through the top of the box', () => {
    const plotted = plotTrend(
      [
        { at: 0, value: 37 },
        { at: 10, value: 37 },
      ],
      100,
      50,
    )
    expect(plotted?.points.map((p) => p.y)).toEqual([25, 25])
  })

  test('measurements taken at the same instant spread evenly instead of dividing by zero', () => {
    const plotted = plotTrend(
      [
        { at: 5, value: 1 },
        { at: 5, value: 2 },
        { at: 5, value: 3 },
      ],
      100,
      50,
    )
    expect(plotted?.points.map((p) => p.x)).toEqual([0, 50, 100])
  })

  test('the latest value is the last one, for the caption', () => {
    const plotted = plotTrend(
      [
        { at: 0, value: 3.2 },
        { at: 10, value: 6.8 },
      ],
      100,
      50,
    )
    expect(plotted?.latest).toBe(6.8)
    expect(plotted?.min).toBe(3.2)
    expect(plotted?.max).toBe(6.8)
  })
})

describe('the polyline attribute', () => {
  test('is x,y pairs to one decimal', () => {
    expect(
      toPolyline([
        { x: 0, y: 12.345 },
        { x: 10, y: 0 },
      ]),
    ).toBe('0.0,12.3 10.0,0.0')
  })
})
