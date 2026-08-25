import { describe, expect, test } from 'vitest'
import { en, nl } from '../messages'
import { moduleById } from '../modules'
import {
  FACTS_LINE_PARTS,
  isValidTastingRating,
  normalizeTastingAttributes,
  SELECT_PICKER_THRESHOLD,
  TASTING_FIELD_TYPES,
  TASTING_KIND_SPECS,
  TASTING_KINDS,
  TASTING_VOCABULARIES,
  TASTING_VOCABULARY_IDS,
  tastingAverage,
  tastingFactsLine,
  tastingFields,
  tastingKindForModule,
  tastingSelectPresentation,
  validateTastingAttributes,
} from '../tastings'

/**
 * A Kind spec is pure data, so this seam is cheap and total: it can assert
 * things about *every* Kind, *every* field and *every* term rather than about
 * the three somebody remembered to write a case for.
 *
 * What it is really guarding is the promise that adding a fourth Kind is an
 * entry in a table. Each test below is a way that promise breaks quietly —
 * a field type the renderer has no component for, a vocabulary that does not
 * exist, a term nobody translated.
 */

const everyField = TASTING_KINDS.flatMap((kind) => [
  ...tastingFields(kind, 'subject').map((field) => ({ kind, field })),
  ...tastingFields(kind, 'tasting').map((field) => ({ kind, field })),
])

describe('every Kind spec', () => {
  test('uses only field types the renderer has a component for', () => {
    for (const { kind, field } of everyField) {
      expect(TASTING_FIELD_TYPES, `${kind}.${field.key}`).toContain(field.type)
    }
  })

  test('names a vocabulary that exists on every select and tags field', () => {
    for (const { kind, field } of everyField) {
      if (field.type !== 'select' && field.type !== 'tags') continue
      expect(field.vocabulary, `${kind}.${field.key}`).toBeDefined()
      expect(TASTING_VOCABULARY_IDS).toContain(field.vocabulary)
    }
  })

  test('puts a vocabulary only where one means something', () => {
    for (const { kind, field } of everyField) {
      if (field.type === 'select' || field.type === 'tags') continue
      expect(field.vocabulary, `${kind}.${field.key}`).toBeUndefined()
    }
  })

  test('puts a unit and a range only on numbers', () => {
    for (const { kind, field } of everyField) {
      if (field.type === 'number') continue
      expect(field.unit, `${kind}.${field.key}`).toBeUndefined()
      expect(field.min, `${kind}.${field.key}`).toBeUndefined()
      expect(field.max, `${kind}.${field.key}`).toBeUndefined()
    }
  })

  test('declares no field twice within one scope', () => {
    for (const kind of TASTING_KINDS) {
      for (const scope of ['subject', 'tasting'] as const) {
        const keys = tastingFields(kind, scope).map((field) => field.key)
        expect(new Set(keys).size, `${kind}.${scope}`).toBe(keys.length)
      }
    }
  })

  test('is reached through a Module that is in the catalogue', () => {
    for (const kind of TASTING_KINDS) {
      const moduleId = TASTING_KIND_SPECS[kind].moduleId
      expect(moduleById(moduleId), moduleId).toBeDefined()
      expect(tastingKindForModule(moduleId)).toBe(kind)
    }
  })

  test('carries a score field on none of them — the score is not an attribute', () => {
    // The rating is one column on the row, shared by every Kind, and never a
    // per-Kind field. A Kind that declared its own would quietly opt out of
    // "what did we love this year".
    for (const { field } of everyField) {
      expect(field.key).not.toBe('rating')
      expect(field.key).not.toBe('score')
    }
  })
})

describe('the catalog', () => {
  test('cheese declares one and wine and beer do not (ADR-0024)', () => {
    expect(TASTING_KIND_SPECS.cheese.catalog).toBe(true)
    expect(TASTING_KIND_SPECS.wine.catalog).toBe(false)
    expect(TASTING_KIND_SPECS.beer.catalog).toBe(false)
  })
})

describe('every word the Modules say', () => {
  test('names every Kind in both locales', () => {
    for (const kind of TASTING_KINDS) {
      expect(en.tastings.kinds[kind].one, kind).toBeTruthy()
      expect(nl.tastings.kinds[kind].one, kind).toBeTruthy()
      expect(en.tastings.kinds[kind].many, kind).toBeTruthy()
      expect(nl.tastings.kinds[kind].many, kind).toBeTruthy()
    }
  })

  test('names every declared field in both locales', () => {
    for (const { kind, field } of everyField) {
      const key = field.key as keyof typeof en.tastings.fields
      expect(en.tastings.fields[key], `${kind}.${field.key}`).toBeTruthy()
      expect(nl.tastings.fields[key], `${kind}.${field.key}`).toBeTruthy()
    }
  })

  test('names every term of every vocabulary in both locales', () => {
    for (const id of TASTING_VOCABULARY_IDS) {
      const english = en.tastings.vocabularies[id] as Record<string, string>
      const dutch = nl.tastings.vocabularies[id] as Record<string, string>
      for (const term of TASTING_VOCABULARIES[id] as readonly string[]) {
        expect(english[term], `en.${id}.${term}`).toBeTruthy()
        expect(dutch[term], `nl.${id}.${term}`).toBeTruthy()
      }
      // And nothing beyond them: a translated term the spec no longer ships is
      // a word nobody can reach and nobody will notice going stale.
      expect(Object.keys(english).sort()).toEqual(
        [...TASTING_VOCABULARIES[id]].sort(),
      )
    }
  })

  test('names every Module in the catalogue, so Beers is not undefined', () => {
    for (const kind of TASTING_KINDS) {
      const id = TASTING_KIND_SPECS[kind]
        .moduleId as keyof typeof en.modules.byId
      expect(en.modules.byId[id].label).toBeTruthy()
      expect(nl.modules.byId[id].label).toBeTruthy()
    }
  })
})

describe('how a select is drawn', () => {
  test('a short vocabulary is chips and a long one is a picker', () => {
    expect(tastingSelectPresentation('milkType')).toBe('chips')
    expect(tastingSelectPresentation('wineRegion')).toBe('picker')
    expect(TASTING_VOCABULARIES.milkType.length).toBeLessThanOrEqual(
      SELECT_PICKER_THRESHOLD,
    )
  })
})

describe('the score', () => {
  test('accepts 1 to 5 in half steps', () => {
    expect(isValidTastingRating(0.5)).toBe(true)
    expect(isValidTastingRating(4.5)).toBe(true)
    expect(isValidTastingRating(5)).toBe(true)
  })

  test('refuses a third of a star, nothing, and more than five', () => {
    expect(isValidTastingRating(4.3)).toBe(false)
    expect(isValidTastingRating(0)).toBe(false)
    expect(isValidTastingRating(5.5)).toBe(false)
    expect(isValidTastingRating('4.5')).toBe(false)
    expect(isValidTastingRating(Number.NaN)).toBe(false)
  })

  test('averages to one decimal, and never without its count', () => {
    expect(tastingAverage([4.5, 4.5, 4])).toEqual({ average: 4.3, count: 3 })
    expect(tastingAverage([5])).toEqual({ average: 5, count: 1 })
    expect(tastingAverage([])).toBeNull()
  })
})

describe('normalizing what a form sends', () => {
  test('drops the fields nobody filled in', () => {
    expect(
      normalizeTastingAttributes({
        producer: '',
        notes: '   ',
        aromas: [],
        vintage: undefined,
        region: null,
      }),
    ).toEqual({})
  })

  test('trims, de-duplicates and keeps the rest', () => {
    expect(
      normalizeTastingAttributes({
        producer: '  G.D. Vajra ',
        aromas: ['cherry', ' cherry ', 'leather', '  '],
        vintage: 2019,
      }),
    ).toEqual({
      producer: 'G.D. Vajra',
      aromas: ['cherry', 'leather'],
      vintage: 2019,
    })
  })
})

describe('validating against the spec', () => {
  test('a complete, well-formed wine passes', () => {
    expect(
      validateTastingAttributes('wine', 'subject', {
        producer: 'G.D. Vajra',
        vintage: 2019,
        grapes: ['nebbiolo'],
        region: 'piedmont',
        style: 'red',
        abv: 14.5,
      }),
    ).toEqual([])
  })

  test('an empty bag passes — every attribute is optional', () => {
    expect(validateTastingAttributes('beer', 'tasting', {})).toEqual([])
  })

  test('refuses a field the Kind does not have', () => {
    expect(
      validateTastingAttributes('beer', 'subject', { vintage: 2019 }),
    ).toEqual([{ field: 'vintage', problem: 'unknownField' }])
  })

  test("refuses a subject's field sent as an impression, and the reverse", () => {
    expect(
      validateTastingAttributes('wine', 'tasting', { vintage: 2019 }),
    ).toEqual([{ field: 'vintage', problem: 'unknownField' }])
    expect(validateTastingAttributes('wine', 'subject', { tannin: 4 })).toEqual(
      [{ field: 'tannin', problem: 'unknownField' }],
    )
  })

  test('refuses a term the vocabulary does not have on a select', () => {
    expect(
      validateTastingAttributes('cheese', 'subject', { milk: 'yak' }),
    ).toEqual([{ field: 'milk', problem: 'notInVocabulary' }])
  })

  test('accepts a tag the vocabulary does not have — it is a prompt', () => {
    expect(
      validateTastingAttributes('wine', 'tasting', {
        aromas: ['cherry', 'wet slate'],
      }),
    ).toEqual([])
  })

  test('refuses half a step on a scale', () => {
    expect(
      validateTastingAttributes('wine', 'tasting', { tannin: 3.5 }),
    ).toEqual([{ field: 'tannin', problem: 'wrongType' }])
    expect(validateTastingAttributes('wine', 'tasting', { tannin: 6 })).toEqual(
      [{ field: 'tannin', problem: 'outOfRange' }],
    )
  })

  test('refuses a number outside the field’s range', () => {
    expect(validateTastingAttributes('beer', 'subject', { abv: 140 })).toEqual([
      { field: 'abv', problem: 'outOfRange' },
    ])
    expect(
      validateTastingAttributes('wine', 'subject', { vintage: 20019 }),
    ).toEqual([{ field: 'vintage', problem: 'outOfRange' }])
  })

  test('refuses a value of the wrong shape', () => {
    expect(
      validateTastingAttributes('cheese', 'subject', { producer: 12 }),
    ).toEqual([{ field: 'producer', problem: 'wrongType' }])
    expect(
      validateTastingAttributes('cheese', 'tasting', { aromas: 'nutty' }),
    ).toEqual([{ field: 'aromas', problem: 'wrongType' }])
  })

  test('reports every bad field rather than the first', () => {
    expect(
      validateTastingAttributes('cheese', 'subject', {
        milk: 'yak',
        age: -3,
      }),
    ).toHaveLength(2)
  })
})

describe('the facts line a row shows', () => {
  const words = (vocabulary: string, key: string) =>
    (en.tastings.vocabularies as Record<string, Record<string, string>>)[
      vocabulary
    ]?.[key] ?? key
  const units = (unit: 'percent' | 'months') => en.tastings.units[unit]

  test('reads the Kind’s selects in declaration order', () => {
    expect(
      tastingFactsLine(
        'cheese',
        { milk: 'cow', country: 'france', style: 'hard', producer: 'Petite' },
        words,
        units,
      ),
    ).toBe('Cow · France · Hard')
  })

  test('a cheese with three selects does not also show its age', () => {
    expect(
      tastingFactsLine(
        'cheese',
        { milk: 'cow', country: 'france', style: 'hard', age: 24 },
        words,
        units,
      ),
    ).toBe('Cow · France · Hard')
  })

  /**
   * The rule that makes the line worth having on every Kind rather than on the
   * one somebody tuned it for: beer declares a single select, so its ABV tops
   * the line up instead of the row reading "Tripel" and stopping.
   */
  test('a Kind with few selects tops the line up with its numbers', () => {
    expect(
      tastingFactsLine(
        'beer',
        { brewery: 'Westmalle', style: 'tripel', abv: 9.5 },
        words,
        units,
      ),
    ).toBe('Tripel · 9.5%')
  })

  test('a tag counts as one part, and only its first entry', () => {
    expect(
      tastingFactsLine(
        'wine',
        { grapes: ['nebbiolo', 'barbera'], region: 'piedmont', style: 'red' },
        words,
        units,
      ),
    ).toBe('Nebbiolo · Piedmont · Red')
  })

  test('never runs past three parts, whatever is filled in', () => {
    const line = tastingFactsLine(
      'wine',
      {
        grapes: ['nebbiolo'],
        region: 'piedmont',
        style: 'red',
        vintage: 2019,
        abv: 14.5,
      },
      words,
      units,
    )
    expect(line.split(' · ')).toHaveLength(FACTS_LINE_PARTS)
  })

  test('falls back to a text fact rather than reading blank', () => {
    expect(
      tastingFactsLine('beer', { brewery: 'Westmalle' }, words, units),
    ).toBe('Westmalle')
  })

  test('is empty when there are no facts at all', () => {
    expect(tastingFactsLine('wine', {}, words, units)).toBe('')
  })
})
