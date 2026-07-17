import { describe, expect, test } from 'vitest'
import {
  extractJsonLdRecipe,
  htmlToText,
  parseIsoDurationMinutes,
} from './recipeParsing'

function htmlWithJsonLd(json: unknown): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify(json)}</script></head><body></body></html>`
}

describe('extractJsonLdRecipe', () => {
  test('returns null when there is no ld+json script', () => {
    expect(
      extractJsonLdRecipe('<html><body>no recipe here</body></html>'),
    ).toBeNull()
  })

  test('parses a single Recipe object with string instructions', () => {
    const html = htmlWithJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: 'Sunday Roast Chicken',
      description: 'A classic Sunday roast.',
      image: ['https://example.com/roast.jpg'],
      recipeIngredient: ['1 whole chicken', '2 tbsp butter', 'salt'],
      recipeInstructions: 'Preheat oven to 200C.\nRoast for 90 minutes.',
      keywords: 'dinner, comfort food',
      prepTime: 'PT20M',
    })

    expect(extractJsonLdRecipe(html)).toEqual({
      title: 'Sunday Roast Chicken',
      description: 'A classic Sunday roast.',
      ingredients: ['1 whole chicken', '2 tbsp butter', 'salt'],
      steps: ['Preheat oven to 200C.', 'Roast for 90 minutes.'],
      tags: ['dinner', 'comfort food'],
      prepMinutes: 20,
      imageUrl: 'https://example.com/roast.jpg',
    })
  })

  test('parses HowToStep instruction objects', () => {
    const html = htmlWithJsonLd({
      '@type': 'Recipe',
      name: 'Pasta',
      recipeIngredient: ['pasta', 'salt'],
      recipeInstructions: [
        { '@type': 'HowToStep', text: 'Boil water.' },
        { '@type': 'HowToStep', text: 'Cook pasta for 10 minutes.' },
      ],
    })

    expect(extractJsonLdRecipe(html)?.steps).toEqual([
      'Boil water.',
      'Cook pasta for 10 minutes.',
    ])
  })

  test('finds a Recipe node nested inside a @graph array', () => {
    const html = htmlWithJsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', name: 'Some Blog' },
        {
          '@type': 'Recipe',
          name: 'Graph Recipe',
          recipeIngredient: ['flour'],
          recipeInstructions: ['Mix it.'],
        },
      ],
    })

    expect(extractJsonLdRecipe(html)?.title).toBe('Graph Recipe')
  })

  test('returns null when the ld+json has no Recipe type', () => {
    const html = htmlWithJsonLd({ '@type': 'WebSite', name: 'Some Blog' })
    expect(extractJsonLdRecipe(html)).toBeNull()
  })

  test('returns null when the ld+json is malformed', () => {
    const html = '<script type="application/ld+json">{not valid json</script>'
    expect(extractJsonLdRecipe(html)).toBeNull()
  })

  test('extracts servings and nutrition from NutritionInformation', () => {
    const html = htmlWithJsonLd({
      '@type': 'Recipe',
      name: 'Stamppot',
      recipeIngredient: ['1 kg aardappelen', '500 g boerenkool'],
      recipeInstructions: 'Kook en stamp.',
      recipeYield: '4 personen',
      nutrition: {
        '@type': 'NutritionInformation',
        calories: '520 kcal',
        proteinContent: '18,5 g',
        carbohydrateContent: '65 g',
        sugarContent: '4 g',
        fatContent: '20 g',
        saturatedFatContent: '8 g',
        fiberContent: '9 g',
        sodiumContent: '800 mg',
      },
    })
    const recipe = extractJsonLdRecipe(html)
    expect(recipe?.servings).toBe(4)
    expect(recipe?.nutrition).toEqual({
      calories: 520,
      protein: 18.5,
      carbs: 65,
      sugars: 4,
      fat: 20,
      saturatedFat: 8,
      fiber: 9,
      salt: 2, // 800 mg sodium → 0.8 g × 2.5
    })
  })

  test('converts kJ calories and numeric recipeYield', () => {
    const html = htmlWithJsonLd({
      '@type': 'Recipe',
      name: 'Soep',
      recipeIngredient: ['water'],
      recipeInstructions: 'Kook.',
      recipeYield: 6,
      nutrition: { '@type': 'NutritionInformation', calories: '1046 kJ' },
    })
    const recipe = extractJsonLdRecipe(html)
    expect(recipe?.servings).toBe(6)
    expect(recipe?.nutrition).toEqual({ calories: 250 })
  })

  test('skips unparseable nutrition values without failing the import', () => {
    const html = htmlWithJsonLd({
      '@type': 'Recipe',
      name: 'Cake',
      recipeIngredient: ['flour'],
      recipeInstructions: 'Bake.',
      recipeYield: 'een grote taart',
      nutrition: {
        '@type': 'NutritionInformation',
        calories: 'n/a',
        fatContent: '12 g',
      },
    })
    const recipe = extractJsonLdRecipe(html)
    expect(recipe?.title).toBe('Cake')
    expect(recipe?.servings).toBeUndefined()
    expect(recipe?.nutrition).toEqual({ fat: 12 })
  })

  test('omits nutrition entirely when absent or empty', () => {
    const html = htmlWithJsonLd({
      '@type': 'Recipe',
      name: 'Toast',
      recipeIngredient: ['bread'],
      recipeInstructions: 'Toast it.',
    })
    const recipe = extractJsonLdRecipe(html)
    expect(recipe?.nutrition).toBeUndefined()
    expect(recipe?.servings).toBeUndefined()
  })
})

describe('extractJsonLdRecipe — real-world site quirks', () => {
  test('flattens HowToSection-grouped instructions (WP Recipe Maker style — leukerecepten.nl, lekkerensimpel.com)', () => {
    const html = htmlWithJsonLd({
      '@type': 'Recipe',
      name: 'Sectioned Recipe',
      recipeIngredient: ['flour', 'sugar'],
      recipeInstructions: [
        {
          '@type': 'HowToSection',
          name: 'Make the batter',
          itemListElement: [
            { '@type': 'HowToStep', text: 'Mix flour and sugar.' },
            { '@type': 'HowToStep', text: 'Add water.' },
          ],
        },
        {
          '@type': 'HowToSection',
          name: 'Bake it',
          itemListElement: [
            { '@type': 'HowToStep', text: 'Bake for 30 minutes.' },
          ],
        },
      ],
    })

    expect(extractJsonLdRecipe(html)?.steps).toEqual([
      'Mix flour and sugar.',
      'Add water.',
      'Bake for 30 minutes.',
    ])
  })

  test('accepts recipeCategory/recipeCuisine as arrays, not just strings (lekkerensimpel.com, miljuschka.nl)', () => {
    const html = htmlWithJsonLd({
      '@type': 'Recipe',
      name: 'Array Tags Recipe',
      recipeIngredient: ['pasta'],
      recipeInstructions: ['Cook it.'],
      recipeCategory: ['Hoofdgerecht'],
      recipeCuisine: ['Italiaanse keuken'],
    })

    expect(extractJsonLdRecipe(html)?.tags).toEqual(
      expect.arrayContaining(['Hoofdgerecht', 'Italiaanse keuken']),
    )
  })

  test('skips a leading empty string in an image array and finds the real URL (ah.nl)', () => {
    const html = htmlWithJsonLd({
      '@type': 'Recipe',
      name: 'Empty Image Slot Recipe',
      recipeIngredient: ['egg'],
      recipeInstructions: ['Fry it.'],
      image: ['', 'https://example.com/real-photo.jpg'],
    })

    expect(extractJsonLdRecipe(html)?.imageUrl).toBe(
      'https://example.com/real-photo.jpg',
    )
  })

  test('falls back to ImageObject.contentUrl when .url is absent', () => {
    const html = htmlWithJsonLd({
      '@type': 'Recipe',
      name: 'ContentUrl Recipe',
      recipeIngredient: ['egg'],
      recipeInstructions: ['Fry it.'],
      image: {
        '@type': 'ImageObject',
        contentUrl: 'https://example.com/content.jpg',
      },
    })

    expect(extractJsonLdRecipe(html)?.imageUrl).toBe(
      'https://example.com/content.jpg',
    )
  })

  test('decodes HTML entities embedded in JSON-LD string values (miljuschka.nl)', () => {
    const html = htmlWithJsonLd({
      '@type': 'Recipe',
      name: 'Salt &amp; Pepper Chicken',
      recipeIngredient: ['chicken'],
      recipeInstructions: ['Season with salt &amp; pepper.'],
      recipeCategory: 'Koek &amp; Gebak',
    })

    const result = extractJsonLdRecipe(html)
    expect(result?.title).toBe('Salt & Pepper Chicken')
    expect(result?.steps).toEqual(['Season with salt & pepper.'])
    expect(result?.tags).toEqual(['Koek & Gebak'])
  })

  test('finds a Recipe nested under a WebPage mainEntity', () => {
    const html = htmlWithJsonLd({
      '@type': 'WebPage',
      name: 'Some Page',
      mainEntity: {
        '@type': 'Recipe',
        name: 'Nested Under mainEntity',
        recipeIngredient: ['flour'],
        recipeInstructions: ['Bake it.'],
      },
    })

    expect(extractJsonLdRecipe(html)?.title).toBe('Nested Under mainEntity')
  })

  test('ignores an @id-only mainEntity reference without crashing', () => {
    const html = htmlWithJsonLd({
      '@type': 'WebPage',
      name: 'Some Page',
      mainEntity: [{ '@id': 'https://example.com/#faq-1' }],
    })

    expect(extractJsonLdRecipe(html)).toBeNull()
  })

  test('falls back to cookTime for prepMinutes when prepTime/totalTime are absent (lekkerensimpel.com)', () => {
    const html = htmlWithJsonLd({
      '@type': 'Recipe',
      name: 'Cook Time Only Recipe',
      recipeIngredient: ['pasta'],
      recipeInstructions: ['Boil it.'],
      cookTime: 'PT20M',
    })

    expect(extractJsonLdRecipe(html)?.prepMinutes).toBe(20)
  })
})

describe('parseIsoDurationMinutes', () => {
  test('parses hours and minutes', () => {
    expect(parseIsoDurationMinutes('PT1H30M')).toBe(90)
  })

  test('parses minutes only', () => {
    expect(parseIsoDurationMinutes('PT45M')).toBe(45)
  })

  test('returns undefined for an invalid duration', () => {
    expect(parseIsoDurationMinutes('not a duration')).toBeUndefined()
  })

  test('parses the full ISO 8601 form with a (zero) day designator (24kitchen.nl: "P0DT0H4M")', () => {
    expect(parseIsoDurationMinutes('P0DT0H4M')).toBe(4)
  })

  test('adds a non-zero day designator as whole days', () => {
    expect(parseIsoDurationMinutes('P1DT2H')).toBe(1 * 24 * 60 + 2 * 60)
  })
})

describe('htmlToText', () => {
  test('strips tags, scripts, and styles, and decodes entities', () => {
    const html =
      '<html><head><style>body{color:red}</style></head><body><script>evil()</script><p>Salt &amp; pepper</p></body></html>'
    expect(htmlToText(html)).toBe('Salt & pepper')
  })
})
