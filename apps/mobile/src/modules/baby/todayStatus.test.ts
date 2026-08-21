import { describe, expect, test } from 'vitest'

import { resolveSelectedChild } from './selectedChild'
import {
  type LoggedEvent,
  shortDuration,
  sleepTotalMs,
  startOfDay,
  tileStatus,
  tileTypes,
} from './todayStatus'

const t = {
  ago: (d: string) => `${d} ago`,
  countToday: (c: number) => `${c} today`,
  never: 'never',
  at: (time: string) => `at ${time}`,
  formatTime: () => '08:30',
}

const NOW = new Date('2026-08-20T14:52:00').getTime()
const DAY = startOfDay(NOW)

function at(hour: number, minute = 0) {
  return new Date(
    `2026-08-20T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
  ).getTime()
}

describe('short durations', () => {
  test('minutes below an hour', () => {
    expect(shortDuration(32 * 60_000)).toBe('32m')
  })

  test('hours drop the minutes when there are none', () => {
    expect(shortDuration(3 * 3_600_000)).toBe('3h')
    expect(shortDuration(3 * 3_600_000 + 10 * 60_000)).toBe('3h 10m')
  })

  test('a negative gap reads as zero rather than as a negative age', () => {
    expect(shortDuration(-5000)).toBe('0m')
  })
})

describe("today's sleep total", () => {
  test('sums only the sleeps that ended', () => {
    const events: LoggedEvent[] = [
      {
        type: 'sleep',
        timestamp: at(11, 30),
        endTimestamp: at(13, 0),
        data: {},
      },
      { type: 'sleep', timestamp: at(9, 0), endTimestamp: at(9, 30), data: {} },
    ]
    expect(sleepTotalMs(events, DAY)).toBe(120 * 60_000)
  })

  test('an open-ended sleep contributes nothing — it means unknown, not still asleep', () => {
    const events: LoggedEvent[] = [
      { type: 'sleep', timestamp: at(11, 30), data: {} },
    ]
    expect(sleepTotalMs(events, DAY)).toBe(0)
  })

  test('yesterday does not leak into today', () => {
    const events: LoggedEvent[] = [
      {
        type: 'sleep',
        timestamp: DAY - 3_600_000,
        endTimestamp: DAY - 1_800_000,
        data: {},
      },
    ]
    expect(sleepTotalMs(events, DAY)).toBe(0)
  })
})

describe('a tile', () => {
  test('a type with nothing logged says so instead of showing a zero', () => {
    expect(tileStatus('feeding', [], NOW, t)).toEqual({
      type: 'feeding',
      headline: null,
      detail: 'never',
    })
  })

  test('feeding counts today and ages the last one', () => {
    const events: LoggedEvent[] = [
      { type: 'feeding', timestamp: at(14, 20), data: {} },
      { type: 'feeding', timestamp: at(10, 45), data: {} },
    ]
    expect(tileStatus('feeding', events, NOW, t)).toEqual({
      type: 'feeding',
      headline: '32m ago',
      detail: '2 today',
    })
  })

  test('temperature shows the reading, to one decimal', () => {
    const events: LoggedEvent[] = [
      { type: 'temperature', timestamp: at(8, 30), data: { celsius: 37.2 } },
    ]
    expect(tileStatus('temperature', events, NOW, t).headline).toBe('37.2 °C')
  })
})

describe('which types get a tile', () => {
  test('most recently logged first — the tiles are the last-used actions', () => {
    const events: LoggedEvent[] = [
      { type: 'note', timestamp: at(14, 0), data: {} },
      { type: 'feeding', timestamp: at(9, 0), data: {} },
    ]
    expect(tileTypes(['feeding', 'diaper', 'note'], events)).toEqual([
      'note',
      'feeding',
      'diaper',
    ])
  })

  test('never more than the cap, so the grid stays two rows', () => {
    expect(
      tileTypes(['feeding', 'diaper', 'sleep', 'temperature', 'note'], []),
    ).toHaveLength(4)
  })

  test('a type this Child does not track never gets a tile, however recent', () => {
    const events: LoggedEvent[] = [
      { type: 'medication', timestamp: at(14, 30), data: {} },
    ]
    expect(tileTypes(['feeding'], events)).toEqual(['feeding'])
  })
})

describe('which Child the log opens on', () => {
  const children = [{ _id: 'a' }, { _id: 'b' }]

  test('the remembered one', () => {
    expect(resolveSelectedChild(children, 'b')).toEqual({ _id: 'b' })
  })

  test('a remembered Child that is gone falls back to the first, not to nothing', () => {
    expect(resolveSelectedChild(children, 'deleted')).toEqual({ _id: 'a' })
  })

  test('no children at all is the empty Module, not a broken selection', () => {
    expect(resolveSelectedChild([], 'a')).toBeNull()
  })
})
