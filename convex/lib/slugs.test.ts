import { describe, expect, test } from 'vitest'
import { MAX_SLUG_LENGTH, normaliseSlug, nthSlugCandidate } from './slugs'

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
