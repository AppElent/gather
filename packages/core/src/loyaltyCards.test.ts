import { describe, expect, test } from 'vitest'

import {
  compareLoyaltyCards,
  foldForSearch,
  isHexColor,
  searchRetailers,
  storeMonogram,
  textOnBrand,
} from './loyaltyCards'
import {
  LOYALTY_CARD_REFUSAL_CODES,
  loyaltyCardRefusal,
  readLoyaltyCardRefusal,
} from './refusals'

const RETAILERS = [
  { name: 'Albert Heijn', aliases: ['AH', 'Bonuskaart'] },
  { name: 'Hema', aliases: [] },
  { name: 'C&A', aliases: [] },
  { name: 'Ekoplaza', aliases: [] },
  { name: 'Hornbach', aliases: [] },
  { name: 'Pëtland', aliases: ['dierenwinkel'] },
]

const names = (query: string) =>
  searchRetailers(RETAILERS, query).map((retailer) => retailer.name)

describe('foldForSearch', () => {
  test('ignores case, accents and punctuation, and reads & as "en"', () => {
    expect(foldForSearch('HÉMA')).toBe('hema')
    expect(foldForSearch('C&A')).toBe('cena')
    expect(foldForSearch("  Jumbo's   Extra! ")).toBe('jumbo s extra')
  })
})

describe('searchRetailers', () => {
  test('ranks a name prefix above a word prefix above a substring', () => {
    expect(names('h')).toEqual(['Hema', 'Hornbach', 'Albert Heijn'])
    expect(names('heijn')).toEqual(['Albert Heijn'])
    expect(names('bach')).toEqual(['Hornbach'])
  })

  test('is case- and accent-insensitive both ways', () => {
    expect(names('ALBERT')).toEqual(['Albert Heijn'])
    expect(names('petland')).toEqual(['Pëtland'])
    expect(names('héma')).toEqual(['Hema'])
  })

  test('matches aliases, below any name match', () => {
    expect(names('bonus')).toEqual(['Albert Heijn'])
    expect(names('dieren')).toEqual(['Pëtland'])
    // "a" starts Albert Heijn's name and is an alias's prefix too: one hit.
    expect(names('ah')).toEqual(['Albert Heijn'])
  })

  test('ignores spaces as a last resort', () => {
    expect(names('albertheijn')).toEqual(['Albert Heijn'])
  })

  test('lists every retailer by name for an empty query', () => {
    expect(names('  ')).toEqual([
      'Albert Heijn',
      'C&A',
      'Ekoplaza',
      'Hema',
      'Hornbach',
      'Pëtland',
    ])
  })

  test('returns nothing for a miss', () => {
    expect(names('xyz')).toEqual([])
  })
})

describe('storeMonogram', () => {
  test('takes the initials of the first two words', () => {
    expect(storeMonogram('Albert Heijn')).toBe('AH')
    expect(storeMonogram('Kruidvat')).toBe('K')
    expect(storeMonogram('C&A')).toBe('CA')
    expect(storeMonogram('bakkerij de graaf')).toBe('BD')
    expect(storeMonogram('Étos')).toBe('É')
    expect(storeMonogram('  ')).toBe('?')
  })
})

describe('textOnBrand', () => {
  test('picks the more readable of black and white', () => {
    expect(textOnBrand('#ffffff')).toBe('#000000')
    expect(textOnBrand('#000000')).toBe('#ffffff')
    // Jumbo yellow and Albert Heijn blue.
    expect(textOnBrand('#fdc513')).toBe('#000000')
    expect(textOnBrand('#004c9b')).toBe('#ffffff')
    expect(textOnBrand('not a colour')).toBe('#ffffff')
  })

  test('isHexColor takes #rrggbb only', () => {
    expect(isHexColor('#00A0E2')).toBe(true)
    expect(isHexColor('#0af')).toBe(false)
    expect(isHexColor('00a0e2')).toBe(false)
  })
})

describe('compareLoyaltyCards', () => {
  test('sorts last used first, then by store and holder', () => {
    const cards = [
      { storeName: 'Hema' },
      { storeName: 'Albert Heijn', holder: 'Sam' },
      { storeName: 'Action', lastUsedAt: 10 },
      { storeName: 'Albert Heijn', holder: 'Nora' },
      { storeName: 'Zeeman', lastUsedAt: 20 },
    ]
    expect(
      [...cards]
        .sort(compareLoyaltyCards)
        .map((card) => `${card.storeName}${card.holder ? `/${card.holder}` : ''}`),
    ).toEqual([
      'Zeeman',
      'Action',
      'Albert Heijn/Nora',
      'Albert Heijn/Sam',
      'Hema',
    ])
  })
})

describe('loyalty card refusals', () => {
  test('round-trip through a ConvexError-shaped value', () => {
    for (const code of LOYALTY_CARD_REFUSAL_CODES) {
      expect(readLoyaltyCardRefusal({ data: loyaltyCardRefusal(code) })).toBe(
        code,
      )
    }
  })

  test('ignore other vocabularies and non-errors', () => {
    expect(readLoyaltyCardRefusal({ data: { kind: 'notFound' } })).toBeNull()
    expect(readLoyaltyCardRefusal(new Error('loyalty:notFound'))).toBeNull()
    expect(readLoyaltyCardRefusal(null)).toBeNull()
  })
})
