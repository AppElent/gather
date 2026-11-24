import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  canonicalTimeZone,
  listTimeZones,
  sameTimeZone,
  searchTimeZones,
} from '../timeZones'

afterEach(() => vi.restoreAllMocks())

describe('canonicalTimeZone', () => {
  test('is the name as the runtime writes it', () => {
    expect(canonicalTimeZone('europe/amsterdam')).toBe('Europe/Amsterdam')
    expect(canonicalTimeZone('Etc/UTC')).toBe(canonicalTimeZone('UTC'))
  })

  test('refuses offsets, with either minus, and unknown names', () => {
    for (const value of ['+01:00', '-01:00', '−01:00', '', 'Mars/Olympus'])
      expect(canonicalTimeZone(value)).toBeNull()
  })
})

test('sameTimeZone sees through an alias', () => {
  expect(sameTimeZone('Asia/Calcutta', 'Asia/Kolkata')).toBe(
    canonicalTimeZone('Asia/Calcutta') === canonicalTimeZone('Asia/Kolkata'),
  )
  expect(sameTimeZone('europe/amsterdam', 'Europe/Amsterdam')).toBe(true)
  expect(sameTimeZone('Asia/Tokyo', 'Europe/Amsterdam')).toBe(false)
  expect(sameTimeZone(undefined, 'Europe/Amsterdam')).toBe(false)
})

describe('listTimeZones', () => {
  test('lists UTC and the zones asked for, once each, sorted', () => {
    const zones = listTimeZones('Europe/Amsterdam', 'Mars/Olympus', undefined)
    expect(zones).toContain('UTC')
    expect(zones).toContain('Mars/Olympus')
    expect(zones.filter((zone) => zone === 'Europe/Amsterdam')).toHaveLength(1)
    expect(zones).toEqual([...zones].sort())
  })

  test('has the IANA list where the runtime lists none, all of it real', () => {
    vi.spyOn(Intl, 'supportedValuesOf').mockImplementation(() => {
      throw new TypeError('not a function')
    })
    const zones = listTimeZones()
    expect(zones.length).toBeGreaterThan(400)
    expect(zones).toContain('UTC')
    expect(zones).toContain('Pacific/Kiritimati')
    expect(zones.filter((zone) => canonicalTimeZone(zone) === null)).toEqual([])
  })
})

test('searchTimeZones matches every word, reading _ and / as spaces', () => {
  const zones = ['America/New_York', 'Asia/Tokyo', 'Europe/Amsterdam']
  expect(searchTimeZones(zones, 'new york')).toEqual(['America/New_York'])
  expect(searchTimeZones(zones, 'york america')).toEqual(['America/New_York'])
  expect(searchTimeZones(zones, 'Europe/Am')).toEqual(['Europe/Amsterdam'])
  expect(searchTimeZones(zones, ' ')).toEqual(zones)
  expect(searchTimeZones(zones, 'mars')).toEqual([])
})
