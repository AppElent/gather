import { describe, expect, test } from 'vitest'

import {
  blankRecipeForm,
  recipeFieldsFrom,
  recipeFormFromImport,
  recipeFormFromRecipe,
  recipeFormProblem,
} from './recipeForm'

describe('an import becomes something to correct', () => {
  test('lists arrive as lines a keyboard can edit', () => {
    const values = recipeFormFromImport({
      title: 'Sunday roast',
      ingredients: ['500 g beef', 'a potato'],
      steps: ['Season it.', 'Roast it.'],
      tags: ['sunday', 'beef'],
    })

    expect(values.ingredients).toBe('500 g beef\na potato')
    expect(values.steps).toBe('Season it.\nRoast it.')
    expect(values.tags).toBe('sunday, beef')
  })

  test('an import is never rated — nobody has cooked it yet', () => {
    const values = recipeFormFromImport({
      title: 'Sunday roast',
      ingredients: [],
      steps: [],
      tags: [],
    })

    expect(values.rating).toBeUndefined()
  })

  test('nutrition the importer found is carried, with where it came from', () => {
    const values = recipeFormFromImport({
      title: 'Sunday roast',
      ingredients: [],
      steps: [],
      tags: [],
      servings: 4,
      nutrition: { calories: 700 },
      nutritionSource: 'imported',
    })

    expect(values.servings).toBe('4')
    expect(values.nutrition).toEqual({ calories: 700 })
    expect(values.nutritionSource).toBe('imported')
  })

  test('what the importer did not find is empty, not missing', () => {
    const values = recipeFormFromImport({
      title: 'Sunday roast',
      ingredients: [],
      steps: [],
      tags: [],
    })

    expect(values.description).toBe('')
    expect(values.servings).toBe('')
  })
})

describe('a saved recipe opens for editing as it was saved', () => {
  test('round-trips through the form unchanged', () => {
    const saved = {
      title: 'Sunday roast',
      description: 'The good one.',
      ingredients: ['500 g beef', 'a potato'],
      steps: ['Roast it.'],
      tags: ['sunday'],
      rating: 4,
      servings: 6,
      nutrition: { calories: 700 },
      nutritionSource: 'manual' as const,
    }

    expect(recipeFieldsFrom(recipeFormFromRecipe(saved))).toEqual({
      title: 'Sunday roast',
      description: 'The good one.',
      ingredients: ['500 g beef', 'a potato'],
      steps: ['Roast it.'],
      tags: ['sunday'],
      rating: 4,
      servings: 6,
      nutrition: { calories: 700 },
      nutritionSource: 'manual',
    })
  })

  test('a rating already given is kept', () => {
    const values = recipeFormFromRecipe({
      title: 'Sunday roast',
      ingredients: [],
      steps: [],
      tags: [],
      rating: 3,
    })

    expect(values.rating).toBe(3)
  })
})

describe('what a save actually sends', () => {
  const typed = (over: Partial<ReturnType<typeof blankRecipeForm>>) =>
    recipeFieldsFrom({ ...blankRecipeForm(), title: 'Sunday roast', ...over })

  test('lines become ingredients and steps', () => {
    expect(typed({ ingredients: '500 g beef\na potato' }).ingredients).toEqual([
      '500 g beef',
      'a potato',
    ])
    expect(typed({ steps: 'Season it.\nRoast it.' }).steps).toEqual([
      'Season it.',
      'Roast it.',
    ])
  })

  test('blank lines are dropped, so pressing return twice costs nothing', () => {
    expect(
      typed({ ingredients: '500 g beef\n\n\n  \na potato\n' }).ingredients,
    ).toEqual(['500 g beef', 'a potato'])
  })

  test('each line is trimmed', () => {
    expect(typed({ steps: '  Roast it.  ' }).steps).toEqual(['Roast it.'])
  })

  test('tags are split on commas, not on lines', () => {
    expect(typed({ tags: 'sunday, beef ,, roast' }).tags).toEqual([
      'sunday',
      'beef',
      'roast',
    ])
  })

  test('an untouched field is undefined rather than empty', () => {
    const fields = typed({})
    expect(fields.description).toBeUndefined()
    expect(fields.servings).toBeUndefined()
    expect(fields.nutrition).toBeUndefined()
    expect(fields.nutritionSource).toBeUndefined()
  })

  test('the title is trimmed', () => {
    expect(typed({ title: '  Sunday roast ' }).title).toBe('Sunday roast')
  })

  test('servings become a whole number, and nonsense becomes nothing', () => {
    expect(typed({ servings: '4' }).servings).toBe(4)
    expect(typed({ servings: '4.6' }).servings).toBe(5)
    expect(typed({ servings: '0' }).servings).toBeUndefined()
    expect(typed({ servings: 'four' }).servings).toBeUndefined()
    expect(typed({ servings: '-2' }).servings).toBeUndefined()
  })

  test('figures with no source recorded are the person’s own', () => {
    const fields = typed({ nutrition: { calories: 700 } })
    expect(fields.nutritionSource).toBe('manual')
  })

  test('a source with no figures under it is dropped', () => {
    const fields = typed({ nutrition: {}, nutritionSource: 'ai' })
    expect(fields.nutrition).toBeUndefined()
    expect(fields.nutritionSource).toBeUndefined()
  })
})

describe('what stops a recipe being saved', () => {
  test('a missing title, and it answers with a key rather than a sentence', () => {
    expect(recipeFormProblem(blankRecipeForm())).toBe('titleRequired')
  })

  test('a title of spaces is a missing title', () => {
    expect(recipeFormProblem({ ...blankRecipeForm(), title: '   ' })).toBe(
      'titleRequired',
    )
  })

  test('a title and nothing else is savable — the rest can be filled in later', () => {
    expect(
      recipeFormProblem({ ...blankRecipeForm(), title: 'Sunday roast' }),
    ).toBeNull()
  })
})
