import { describe, expect, test } from 'vitest'
import { createGroceryDictionary, editDistance } from './dictionary'
import { recogniseGroceryLine } from './index'
import { cleanGroceryName, groceryKey } from './normalise'
import { parseGroceryLine } from './parse'
import { resolveGroceryLine } from './resolve'

describe('parseGroceryLine', () => {
  test.each([
    ['2 liter melk', 2, 'l', 'melk'],
    ['500g gehakt', 500, 'g', 'gehakt'],
    ['3x yoghurt', 3, null, 'yoghurt'],
    ['½ kilo uien', 0.5, 'kg', 'uien'],
    ['pak koffie', 1, 'pak', 'koffie'],
    ['2 tins of chopped tomatoes', 2, 'blik', 'chopped tomatoes'],
    ['spaghetti 500g', 500, 'g', 'spaghetti'],
    ['penne 2 pakken', 2, 'pak', 'penne'],
    ['bananen', null, null, 'bananen'],
  ])('%s', (line, quantity, unit, name) => {
    expect(parseGroceryLine(line)).toEqual({ quantity, unit, name })
  })

  test('keeps words that only look like a container in English', () => {
    expect(parseGroceryLine('tin foil')).toEqual({
      quantity: null,
      unit: null,
      name: 'tin foil',
    })
  })

  test('does not read a size or stage as an amount', () => {
    expect(parseGroceryLine('luiers maat 4').quantity).toBeNull()
  })
})

describe('names', () => {
  test('a key is the same for singular, plural and diminutive', () => {
    expect(groceryKey('tomaten')).toBe(groceryKey('tomaat'))
    expect(groceryKey('eitjes')).toBe(groceryKey('eieren'))
    expect(groceryKey('Kiwi’s')).toBe(groceryKey('kiwi'))
  })

  test('drops an article and a store brand, not a product brand', () => {
    expect(cleanGroceryName('De AH halfvolle melk')).toBe('halfvolle melk')
    expect(cleanGroceryName('Calvé pindakaas')).toBe('calvé pindakaas')
  })

  test('keeps penne apart from peen', () => {
    expect(groceryKey('penne')).not.toBe(groceryKey('peen'))
  })
})

describe('dictionary lookup', () => {
  const dictionary = createGroceryDictionary({
    dairy: `${groceryKey('melk')}:4|${groceryKey('kwark')}:4`,
    meat_fish: `${groceryKey('filet')}:4`,
    drinks: `${groceryKey('sap')}:4`,
    produce: `${groceryKey('komkommer')}:4`,
  })

  test.each([
    ['melk', 'dairy', 'exact'],
    ['halfvolle melk', 'dairy', 'phrase'],
    ['diepvries spinazie', 'frozen', 'frozen'],
    ['kipdijfilet', 'meat_fish', 'compound'],
    ['appelsap', 'drinks', 'compound'],
    ['komkommr', 'produce', 'typo'],
  ])('%s → %s by %s', (name, aisle, match) => {
    expect(dictionary.lookup(name)).toMatchObject({ aisle, match })
  })

  test('knows nothing it was not given', () => {
    expect(dictionary.lookup('doenjang')).toBeNull()
  })

  // APP-368: the stray matches the eval found.
  describe('does not over-match', () => {
    const strict = createGroceryDictionary({
      dairy: `${groceryKey('dairy')}:1|${groceryKey('melk')}:4`,
      meat_fish: `${groceryKey('saté')}:4|${groceryKey('kokkel')}:1`,
      drinks: `${groceryKey('wit')}:1|${groceryKey('cola')}:4`,
      snacks: `${groceryKey('chocolade')}:4`,
      produce: `${groceryKey('druiven')}:4|${groceryKey('paprika')}:4|${groceryKey('laurier')}:1`,
      frozen: `${groceryKey('iglo')}:4`,
    })

    test.each([
      // A slip rarely hits the first letter.
      ['Fairy', null],
      ['Wokkels', null],
      // A piece under four letters does not end a compound or stand for a name.
      ['tandpasat', null],
      ['druiven wit', 'produce'],
      // One slip from a whole word beats a piece of it.
      ['chocola', 'snacks'],
      // Ground, powdered or flaked produce is a spice.
      ['paprika powder', 'tins_sauces'],
      ['laurierblaadjes', 'tins_sauces'],
      // A frozen brand first makes the name frozen.
      ['Iglo spinazie', 'frozen'],
    ])('%s → %s', (name, aisle) => {
      expect(strict.lookup(name)?.aisle ?? null).toBe(aisle)
    })
  })

  test('the more trusted source wins a disagreement', () => {
    const both = createGroceryDictionary({
      drinks: `${groceryKey('kokosmelk')}:1`,
      pasta_world: `${groceryKey('kokosmelk')}:4`,
    })
    expect(both.exact(groceryKey('kokosmelk'))).toBe('pasta_world')
    expect(
      createGroceryDictionary({ drinks: `${groceryKey('kokosmelk')}:1` }, 2).size,
    ).toBe(0)
  })

  test('edit distance counts a swap once', () => {
    expect(editDistance('melk', 'mlek')).toBe(1)
    expect(editDistance('kaas', 'brood', 2)).toBe(2)
  })
})

describe('lookup order', () => {
  const dictionary = createGroceryDictionary({ dairy: `${groceryKey('melk')}:4` })

  test('the Group’s own choice beats history, dictionary and cache', () => {
    const result = resolveGroceryLine('melk', dictionary, {
      override: () => 'drinks',
      history: () => 'snacks',
      cache: () => 'frozen',
    })
    expect(result).toMatchObject({ aisle: 'drinks', source: 'override' })
  })

  test('history beats the dictionary', () => {
    expect(
      resolveGroceryLine('melk', dictionary, { history: () => 'snacks' }),
    ).toMatchObject({ aisle: 'snacks', source: 'history' })
  })

  test('the cache answers only what the dictionary does not know', () => {
    expect(
      resolveGroceryLine('melk', dictionary, { cache: () => 'frozen' }).source,
    ).toBe('dictionary')
    expect(
      resolveGroceryLine('doenjang', dictionary, { cache: () => 'pasta_world' }),
    ).toMatchObject({ aisle: 'pasta_world', source: 'cache' })
  })

  test('nothing known is other', () => {
    expect(resolveGroceryLine('doenjang', dictionary)).toMatchObject({
      aisle: 'other',
      source: 'none',
      key: 'doenjang',
    })
  })
})

describe('the bundled dictionary', () => {
  test.each([
    ['2 liter halfvolle melk', 'dairy'],
    ['Pampers luiers', 'care_baby'],
    ['wc papier', 'household'],
    ['kipfilet', 'meat_fish'],
    ['Iglo vissticks', 'frozen'],
    ['sambal oelek', 'pasta_world'],
    ['2 blikken tomaten', 'tins_sauces'],
    ['tomaten', 'produce'],
  ])('%s → %s', (line, aisle) => {
    expect(recogniseGroceryLine(line).aisle).toBe(aisle)
  })
})
