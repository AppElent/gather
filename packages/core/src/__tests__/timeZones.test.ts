import { afterEach, describe, expect, test, vi } from 'vitest'
import { en } from '../messages/en'
import { nl } from '../messages/nl'
import {
  canonicalTimeZone,
  listTimeZones,
  sameTimeZone,
  searchTimeZones,
  sortTimeZones,
  timeZoneLabel,
  timeZoneName,
  timeZonePlace,
} from '../timeZones'

afterEach(() => vi.restoreAllMocks())

describe('canonicalTimeZone', () => {
  test('is the name as the runtime writes it', () => {
    expect(canonicalTimeZone('europe/amsterdam')).toBe('Europe/Amsterdam')
    expect(canonicalTimeZone('Etc/UTC')).toBe(canonicalTimeZone('UTC'))
  })

  test("is IANA's name, not the older one ICU keeps", () => {
    expect(canonicalTimeZone('Asia/Calcutta')).toBe('Asia/Kolkata')
    expect(canonicalTimeZone('Asia/Kolkata')).toBe('Asia/Kolkata')
    expect(canonicalTimeZone('europe/kiev')).toBe('Europe/Kyiv')
    expect(canonicalTimeZone('US/Eastern')).toBe('America/New_York')
  })

  test('every listed zone is its own canonical name, whatever the runtime lists', () => {
    const zones = listTimeZones('Asia/Saigon')
    expect(zones.filter((zone) => canonicalTimeZone(zone) !== zone)).toEqual([])
    expect(zones).not.toContain('Asia/Saigon')
    expect(zones).toContain('Asia/Ho_Chi_Minh')
  })

  test('refuses offsets, with either minus, and unknown names', () => {
    for (const value of ['+01:00', '-01:00', '−01:00', '', 'Mars/Olympus'])
      expect(canonicalTimeZone(value)).toBeNull()
  })
})

test('sameTimeZone sees through an alias', () => {
  expect(sameTimeZone('Asia/Calcutta', 'Asia/Kolkata')).toBe(true)
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

const places = { 'Europe/Vienna': 'Wenen', 'America/Curacao': 'Curaçao' }

test('searchTimeZones matches every word of a label or an IANA name', () => {
  const zones = ['America/New_York', 'Asia/Tokyo', 'Europe/Vienna', 'America/Curacao']
  const find = (query: string) => searchTimeZones(zones, query, 'nl', places)
  expect(find('new york')).toEqual(['America/New_York'])
  expect(find('york america')).toEqual(['America/New_York'])
  expect(find('wenen')).toEqual(['Europe/Vienna'])
  expect(find('europe/vi')).toEqual(['Europe/Vienna'])
  expect(find('midden-europese')).toEqual(['Europe/Vienna'])
  expect(find('curacao')).toEqual(['America/Curacao'])
  expect(find(' ')).toEqual(zones)
  expect(find('mars')).toEqual([])
})

describe('labels', () => {
  test('name the place and the zone in the language', () => {
    expect(timeZoneLabel('Europe/Vienna', 'nl', places)).toBe(
      'Wenen, Midden-Europese tijd',
    )
    expect(timeZoneLabel('America/New_York', 'en', {})).toBe('New York, Eastern Time')
    expect(timeZonePlace('America/Indiana/Knox', {})).toBe('Knox, Indiana')
    expect(timeZoneLabel('UTC', 'en', {})).toBe('UTC, Coordinated Universal Time')
  })

  test('fall back to a plainer name, then to the place alone', () => {
    expect(timeZoneLabel('Mars/Olympus', 'en', {})).toBe('Olympus')
    const real = Intl.DateTimeFormat
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (
      locale,
      options,
    ) {
      // Hermes on an older iOS.
      if (options?.timeZoneName === 'longGeneric') throw new RangeError('no')
      return new real(locale, options)
    } as typeof Intl.DateTimeFormat)
    expect(timeZoneName('Asia/Tokyo', 'en')).toBe('Japan Standard Time')
  })

  test('are sorted by place', () => {
    expect(
      sortTimeZones(['America/Toronto', 'Europe/Vienna', 'Asia/Aden'], 'nl', places),
    ).toEqual(['Asia/Aden', 'America/Toronto', 'Europe/Vienna'])
  })

  test('the translated places are real, listed zones', () => {
    expect(Object.keys(nl.settings.group.timeZonePlaces)).toEqual(
      Object.keys(en.settings.group.timeZonePlaces),
    )
    for (const zone of Object.keys(en.settings.group.timeZonePlaces))
      expect(listTimeZones()).toContain(zone)
  })
})
