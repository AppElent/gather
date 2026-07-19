// Read fixtures via a plain file:// URL relative to this file. The default
// jsdom test environment runs modules through Vite's client transform, which
// intercepts `new URL(relative, import.meta.url)` as an asset-URL reference
// and resolves it against a fake http://localhost origin instead of disk —
// force the Node environment for this file so it resolves to a real path.
// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { extractJsonLdRecipe } from './recipeParsing'

// Real JSON-LD payloads captured from live recipe sites (see
// __fixtures__/jsonld/README.md for source URLs and capture dates).
// These test the parser against real-world mess, not the spec.
function fixtureHtml(name: string): string {
  const json = readFileSync(
    new URL(`./__fixtures__/jsonld/${name}.json`, import.meta.url),
    'utf8',
  )
  return `<html><head><script type="application/ld+json">${json}</script></head><body></body></html>`
}

describe('leukerecepten.nl (WP Recipe Maker, HowToSection steps)', () => {
  const recipe = extractJsonLdRecipe(fixtureHtml('leukerecepten'))
  test('extracts the core recipe', () => {
    expect(recipe?.title).toBe('Foe yong hai')
    expect(recipe?.ingredients.length).toBeGreaterThan(2)
    expect(recipe?.steps.length).toBeGreaterThan(1)
  })
  test('extracts servings and nutrition', () => {
    expect(recipe?.servings).toBe(2)
    expect(recipe?.nutrition).toMatchObject({
      calories: 520,
      fat: 18,
      saturatedFat: 3,
      carbs: 63,
      sugars: 12,
      fiber: 6,
      protein: 23,
      salt: 4.5, // 1800 mg sodium → 1.8 g × 2.5
    })
  })
})

describe('lekkerensimpel.com (WP Recipe Maker, @graph-wrapped)', () => {
  const recipe = extractJsonLdRecipe(fixtureHtml('lekkerensimpel'))
  test('extracts the core recipe', () => {
    expect(recipe?.title).toBe('Nasi goreng')
    expect(recipe?.ingredients.length).toBeGreaterThan(2)
    expect(recipe?.steps.length).toBeGreaterThan(1)
  })
  test('has no servings/nutrition beyond what the source provides', () => {
    expect(recipe?.servings).toBe(2)
    // This page publishes no <NutritionInformation> block at all.
    expect(recipe?.nutrition).toBeUndefined()
  })
})

describe('uitpaulineskeuken.nl (@graph-wrapped, full nutrition)', () => {
  const recipe = extractJsonLdRecipe(fixtureHtml('uitpaulineskeuken'))
  test('extracts the core recipe', () => {
    expect(recipe?.title).toBe('Courgette ovenschotel')
    expect(recipe?.ingredients.length).toBeGreaterThan(2)
    expect(recipe?.steps.length).toBeGreaterThan(1)
  })
  test('extracts servings and nutrition', () => {
    expect(recipe?.servings).toBe(4)
    expect(recipe?.nutrition).toMatchObject({
      calories: 305,
      carbs: 24,
      sugars: 11,
      protein: 22,
      fat: 16,
      saturatedFat: 9,
      fiber: 6,
      salt: 1.5, // 604 mg sodium → 0.6 g (rounded) × 2.5
    })
  })
})

describe('24kitchen.nl (TV-network site, ISO duration with day designator)', () => {
  const recipe = extractJsonLdRecipe(fixtureHtml('24kitchen'))
  test('extracts the core recipe', () => {
    expect(recipe?.title).toBe('Warm & crispy roomijspakketje')
    expect(recipe?.ingredients.length).toBeGreaterThan(2)
    expect(recipe?.steps.length).toBeGreaterThan(1)
  })
  test('extracts servings; publishes no nutrition block', () => {
    expect(recipe?.servings).toBe(1)
    expect(recipe?.nutrition).toBeUndefined()
  })
  test('parses prepTime expressed as "P0DT0H4M" (full ISO 8601 with zero-day designator)', () => {
    expect(recipe?.prepMinutes).toBe(4)
  })
})

describe('bbcgoodfood.com (international, spelled-out nutrition units)', () => {
  const recipe = extractJsonLdRecipe(fixtureHtml('bbcgoodfood'))
  test('extracts the core recipe', () => {
    expect(recipe?.title).toBe('Chicken tikka masala')
    expect(recipe?.ingredients.length).toBeGreaterThan(2)
    expect(recipe?.steps.length).toBeGreaterThan(1)
  })
  test('extracts servings and nutrition', () => {
    expect(recipe?.servings).toBe(10)
    expect(recipe?.nutrition).toMatchObject({
      calories: 345,
      fat: 19,
      saturatedFat: 8,
      carbs: 13,
      sugars: 10,
      fiber: 3,
      protein: 31,
      // "1.04 milligram of sodium" → 0.00104 g × 2.5 rounds to 0. A
      // suspiciously tiny number for a curry, but that's the literal value
      // this site's structured data publishes — see README caveat.
      salt: 0,
    })
  })
})

describe('keukenliefde.nl (@graph-wrapped, no nutrition published)', () => {
  const recipe = extractJsonLdRecipe(fixtureHtml('keukenliefde'))
  test('extracts the core recipe', () => {
    expect(recipe?.title).toBe('Pasta carbonara met groene asperges')
    expect(recipe?.ingredients.length).toBeGreaterThan(2)
    expect(recipe?.steps.length).toBeGreaterThan(1)
  })
  test('has no servings/nutrition beyond what the source provides', () => {
    expect(recipe?.servings).toBe(2)
    expect(recipe?.nutrition).toBeUndefined()
  })
})

describe('ah.nl / Allerhande (corporate site, partial nutrition, empty image slot)', () => {
  const recipe = extractJsonLdRecipe(fixtureHtml('ah'))
  test('extracts the core recipe', () => {
    expect(recipe?.title).toBe('Spicy komkommersalade met kip en witte bonen')
    expect(recipe?.ingredients.length).toBeGreaterThan(2)
    expect(recipe?.steps.length).toBeGreaterThan(1)
  })
  test('extracts servings and a partial nutrition block (no sugars/fiber/salt published)', () => {
    expect(recipe?.servings).toBe(4)
    expect(recipe?.nutrition).toMatchObject({
      calories: 565,
      fat: 35,
      saturatedFat: 7,
      carbs: 33,
      protein: 25,
    })
    expect(recipe?.nutrition).not.toHaveProperty('sugars')
    expect(recipe?.nutrition).not.toHaveProperty('fiber')
    expect(recipe?.nutrition).not.toHaveProperty('salt')
  })
})

describe('jumbo.com/recepten (corporate site, calories-only nutrition)', () => {
  const recipe = extractJsonLdRecipe(fixtureHtml('jumbo'))
  test('extracts the core recipe', () => {
    expect(recipe?.title).toBe('Pompoen traybake met aardappel en worst')
    expect(recipe?.ingredients.length).toBeGreaterThan(2)
    expect(recipe?.steps.length).toBeGreaterThan(1)
  })
  test('extracts servings and a calories-only nutrition block', () => {
    expect(recipe?.servings).toBe(4)
    expect(recipe?.nutrition).toMatchObject({ calories: 534 })
  })
})
