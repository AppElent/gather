import { describe, expect, test } from 'vitest'
import {
  MAX_SLUG_LENGTH,
  nthSlugCandidate,
  normaliseSlug,
  personalSlugBase,
  RESERVED_SLUGS,
  sharedSlugBase,
} from './slugs'

describe('normaliseSlug', () => {
  test('lowercases and hyphenates words', () => {
    expect(normaliseSlug('Jansen Household')).toBe('jansen-household')
  })

  test('strips diacritics rather than dropping the letters', () => {
    expect(normaliseSlug('Café Ölçü')).toBe('cafe-olcu')
    expect(normaliseSlug('Ærø Ångström')).toBe('aero-angstrom')
  })

  test('collapses any run of punctuation or whitespace into one hyphen', () => {
    expect(normaliseSlug("  Bob's   BBQ & Grill!!  ")).toBe('bob-s-bbq-grill')
  })

  test('drops emoji entirely', () => {
    expect(normaliseSlug('Pizza 🍕 night')).toBe('pizza-night')
  })

  test('never leaves a leading or trailing hyphen', () => {
    expect(normaliseSlug('---Wine club---')).toBe('wine-club')
  })

  test('falls back to "group" for input with nothing sluggable in it', () => {
    expect(normaliseSlug('')).toBe('group')
    expect(normaliseSlug('   ')).toBe('group')
    expect(normaliseSlug('!!! ??? ...')).toBe('group')
    expect(normaliseSlug('🍕')).toBe('group')
  })

  test('caps the result at the maximum slug length', () => {
    const long = normaliseSlug('a'.repeat(80))
    expect(long).toHaveLength(MAX_SLUG_LENGTH)
  })

  test('does not leave a trailing hyphen after capping', () => {
    // The cut lands exactly on the hyphen between the two words.
    const name = `${'a'.repeat(MAX_SLUG_LENGTH - 1)} household`
    expect(normaliseSlug(name)).toBe('a'.repeat(MAX_SLUG_LENGTH - 1))
  })

  test('transliterates letters that carry no combining mark to strip', () => {
    expect(normaliseSlug('Straße')).toBe('strasse')
    expect(normaliseSlug('Œuf')).toBe('oeuf')
  })
})

describe('sharedSlugBase', () => {
  test('leaves an ordinary household name alone', () => {
    expect(sharedSlugBase('Jansen Household')).toBe('jansen-household')
  })

  test('escapes a name that would land on a reserved segment', () => {
    for (const reserved of RESERVED_SLUGS) {
      expect(sharedSlugBase(reserved)).toBe(`g-${reserved}`)
    }
  })

  test('escapes a name that would land in the Personal namespace', () => {
    expect(sharedSlugBase('Me and Bob')).toBe('g-me-and-bob')
    expect(sharedSlugBase('Me')).toBe('g-me')
  })

  test('never produces a reserved segment or the Personal namespace', () => {
    const names = ['settings', 'API', 'me', 'me-too', 'g', '', '???', 'Home']
    for (const name of names) {
      const slug = sharedSlugBase(name)
      expect(RESERVED_SLUGS.has(slug)).toBe(false)
      expect(slug.startsWith('me-')).toBe(false)
    }
  })

  test('stays within the maximum slug length after escaping', () => {
    expect(sharedSlugBase(`Me ${'a'.repeat(80)}`).length).toBeLessThanOrEqual(
      MAX_SLUG_LENGTH,
    )
  })
})

describe('personalSlugBase', () => {
  test('puts a person in the reserved Personal namespace', () => {
    expect(personalSlugBase('Alice')).toBe('me-alice')
    expect(personalSlugBase('Ada Lovelace')).toBe('me-ada-lovelace')
  })

  test('falls back to me-member when the name normalises to nothing', () => {
    expect(personalSlugBase('')).toBe('me-member')
    expect(personalSlugBase('🙂')).toBe('me-member')
  })

  test('does not double the prefix for a person literally called Me', () => {
    expect(personalSlugBase('Me')).toBe('me-me')
  })

  test('stays within the maximum slug length', () => {
    expect(personalSlugBase('a'.repeat(80)).length).toBeLessThanOrEqual(
      MAX_SLUG_LENGTH,
    )
  })

  test('is always inside the namespace a shared Group is kept out of', () => {
    for (const name of ['Alice', '', 'Me', 'Ölçü']) {
      expect(personalSlugBase(name).startsWith('me-')).toBe(true)
    }
  })
})

describe('the collision ladder', () => {
  test('offers the bare base first, then numbered suffixes from 2', () => {
    const ladder = [1, 2, 3, 4].map((n) => nthSlugCandidate('household', n))
    expect(ladder).toEqual([
      'household',
      'household-2',
      'household-3',
      'household-4',
    ])
  })
})
