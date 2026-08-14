import { describe, expect, test } from 'vitest'
import {
  BABY_EVENT_TYPES,
  MEAL_NAMES,
  NUTRIENT_KEYS,
  QUANTITY_UNITS,
} from '../domain'
import { fmt, isLocale, plural, resolveLocale } from '../i18n'
import { en, nl } from '../messages'
import { MODULE_GROUPS, MODULES, moduleText } from '../modules'
import { DEFAULT_PINS, pinnedModuleIds } from '../pins'

function leaves(value: unknown, path = ''): Map<string, string> {
  if (typeof value === 'string') return new Map([[path, value]])
  if (typeof value !== 'object' || value === null) return new Map()

  return Object.entries(value).reduce((all, [key, child]) => {
    for (const [childPath, text] of leaves(child, `${path}.${key}`)) {
      all.set(childPath, text)
    }
    return all
  }, new Map<string, string>())
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
}

describe('the portable Gather catalogue', () => {
  test('keeps the complete catalogue and its message join in one contract', () => {
    expect(MODULES).toHaveLength(13)
    expect(MODULE_GROUPS).toEqual(['kitchen', 'money', 'home', 'tasting'])
    expect(moduleText(MODULES[0], en).label).toBe('Recipes')
    expect(moduleText(MODULES[0], nl).label).toBe('Recepten')
  })

  test('normalizes default Pins without a client runtime', () => {
    expect(pinnedModuleIds(undefined)).toEqual(DEFAULT_PINS)
    expect(pinnedModuleIds(['tasks', 'missing', 'tasks'])).toEqual(['tasks'])
  })
})

describe('the portable locale contract', () => {
  test('has matching populated message trees', () => {
    const english = leaves(en)
    const dutch = leaves(nl)

    expect([...dutch.keys()].sort()).toEqual([...english.keys()].sort())
    for (const [path, source] of english) {
      const translation = dutch.get(path)
      expect(source, `${path} must not be empty`).not.toBe('')
      expect(translation, `${path} must not be empty`).not.toBe('')
      expect(placeholders(translation ?? '')).toEqual(placeholders(source))
    }
  })

  test('formats, resolves, and pluralizes Gather locales without Intl', () => {
    expect(fmt('Hello, {name}', { name: 'Eric' })).toBe('Hello, Eric')
    expect(isLocale(['en', 'nl'] as const, 'nl')).toBe(true)
    expect(resolveLocale(['en', 'nl'] as const, 'en', undefined, 'nl-NL')).toBe(
      'nl',
    )
    expect(
      plural('en', 1, { one: '{count} item', other: '{count} items' }),
    ).toBe('1 item')
    expect(
      plural('nl', 2, { one: '{count} item', other: '{count} items' }),
    ).toBe('2 items')
  })
})

test('shares the domain vocabulary outside Convex validators', () => {
  expect(BABY_EVENT_TYPES).toContain('feeding')
  expect(NUTRIENT_KEYS).toContain('protein')
  expect(MEAL_NAMES).toContain('lunch')
  expect(QUANTITY_UNITS).toContain('serving')
})
