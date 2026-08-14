import { describe, expect, test } from 'vitest'
import {
  APPEARANCE_PREFERENCES,
  appearancePreference,
  resolveScheme,
} from '../appearance'

describe('the appearance preference', () => {
  test('offers exactly light, system and dark, in that order', () => {
    expect(APPEARANCE_PREFERENCES).toEqual(['light', 'system', 'dark'])
  })

  test('reads back what was stored', () => {
    for (const preference of APPEARANCE_PREFERENCES) {
      expect(appearancePreference(preference)).toBe(preference)
    }
  })

  test('falls back to system for anything a store could hand back', () => {
    // A store that has never been written, one written by an older build, and
    // one whose value is not a string at all. None of these is an error: an
    // unreadable preference is a phone that follows its owner's phone.
    expect(appearancePreference(null)).toBe('system')
    expect(appearancePreference(undefined)).toBe('system')
    expect(appearancePreference('auto')).toBe('system')
    expect(appearancePreference('Dark')).toBe('system')
    expect(appearancePreference(0)).toBe('system')
    expect(appearancePreference({ mode: 'dark' })).toBe('system')
  })
})

describe('resolving a preference against the device', () => {
  test('an explicit choice wins over the device, in both directions', () => {
    expect(resolveScheme('dark', 'light')).toBe('dark')
    expect(resolveScheme('light', 'dark')).toBe('light')
  })

  test('system follows the device', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark')
    expect(resolveScheme('system', 'light')).toBe('light')
  })

  test('a device that will not say is light', () => {
    // React Native reports `'unspecified'` when the platform has no preference
    // to report, and `null` on some versions. Neither is a third scheme, and
    // light is the assumption the tokens are written against.
    expect(resolveScheme('system', 'unspecified')).toBe('light')
    expect(resolveScheme('dark', 'unspecified')).toBe('dark')
    expect(resolveScheme('system', null)).toBe('light')
    expect(resolveScheme('system', undefined)).toBe('light')
    expect(resolveScheme('dark', null)).toBe('dark')
  })
})
