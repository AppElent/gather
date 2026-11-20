import { describe, expect, test } from 'vitest'
import {
  AI_RECIPE_TAG,
  acceptAiIdea,
  acceptAiSwaps,
  claimsNutrition,
  completeSwaps,
  isAiRecipe,
  rulesSwaps,
  type SwapInput,
  swapPool,
} from './mealIdeas'
import { resolveMealPreferences } from './mealPreferences'
import type { WeekPlanRecipe } from './weekPlan'

const prefs = resolveMealPreferences(null, [{ userId: 'a' }])

const recipe = (
  id: string,
  title: string,
  prepMinutes: number,
  rating: number,
  ingredients: string[],
): WeekPlanRecipe => ({ id, title, prepMinutes, rating, ingredients, tags: [] })

const RECIPES = [
  recipe('tacos', 'Tacos met kip', 30, 5, ['kipfilet', 'tortilla']),
  recipe('teriyaki', 'Kip teriyaki', 25, 4, ['kipdij', 'rijst']),
  recipe('gnocchi', 'Gnocchi met spinazie', 20, 4, ['gnocchi', 'spinazie']),
  recipe('risotto', 'Pompoenrisotto', 45, 4, ['rijst', 'pompoen']),
  recipe('wraps', 'Wraps met hummus', 15, 4, ['wraps', 'hummus']),
]

function input(overrides: Partial<SwapInput> = {}): SwapInput {
  return {
    targets: [{ date: '2026-11-26', slot: 'dinner', maxMinutes: 30, eaters: 3 }],
    recipes: RECIPES,
    quickMeals: [{ id: 'tosti', title: 'Tosti', prepMinutes: 10 }],
    plannedRecipeIds: ['tacos'],
    plannedDinnerDates: [],
    stock: { inStock: [], low: [] },
    prefs,
    wishes: [],
    skipQuickMeals: [],
    leftoversName: 'Restjes',
    current: { recipeId: 'tacos', prepMinutes: 30 },
    ...overrides,
  }
}

describe('Iets anders', () => {
  test('three alternatives, never what is planned, time-fitting first', () => {
    const picks = rulesSwaps(input())
    expect(picks).toHaveLength(3)
    expect(picks.map((p) => p.recipeId)).not.toContain('tacos')
    expect(picks.map((p) => p.recipeId)).not.toContain('risotto')
  })

  test('the chips narrow the pool', () => {
    const ids = (chip: SwapInput['chip']) => swapPool(input({ chip })).map((r) => r.id)
    expect(ids('chickenQuick')).toEqual(['teriyaki'])
    expect(ids('meatFree')).toEqual(['gnocchi', 'risotto', 'wraps'])
    expect(ids('faster')).toEqual(['teriyaki', 'gnocchi', 'wraps'])
  })

  test('the quick meals fill in when the recipes run out', () => {
    const picks = rulesSwaps(input({ chip: 'faster', recipes: RECIPES.slice(0, 2) }))
    expect(picks.map((p) => p.title)).toEqual(['Kip teriyaki', 'Tosti'])
  })

  test('the model may only pick from the pool, each once; the rules fill the rest', () => {
    const pool = swapPool(input())
    const ai = acceptAiSwaps(
      [
        { recipeId: 'gnocchi', reason: 'Spinazie in huis' },
        { recipeId: 'gnocchi', reason: 'twice' },
        { recipeId: 'tacos', reason: 'planned now' },
        { recipeId: 'invented', reason: 'x' },
      ],
      pool,
    )
    expect(ai.map((p) => p.recipeId)).toEqual(['gnocchi'])
    const all = completeSwaps(ai, input())
    expect(all.map((p) => p.source)).toEqual(['ai', 'rules', 'rules'])
    expect(new Set(all.map((p) => p.title)).size).toBe(3)
  })
})

describe('Nieuw idee', () => {
  const idea = {
    title: 'Linzencurry',
    minutes: 30,
    why: 'Gebruikt de spinazie die in huis is.',
    ingredients: [
      { name: 'rode linzen', quantity: 200, unit: 'g' },
      { name: 'kokosmelk', quantity: 400, unit: 'ml' },
      'ui',
      { name: 'Per portie 420 kcal' },
    ],
    steps: ['Fruit de ui.', 'Kook de linzen in de kokosmelk.', 'Bevat 18 g eiwitten per portie.'],
  }

  test('keeps title, ingredients, steps and minutes; drops nutrition lines', () => {
    expect(acceptAiIdea(idea, prefs, 3)).toEqual({
      title: 'Linzencurry',
      ingredients: [
        { name: 'rode linzen', quantity: 200, unit: 'g' },
        { name: 'kokosmelk', quantity: 400, unit: 'ml' },
        { name: 'ui' },
      ],
      steps: ['Fruit de ui.', 'Kook de linzen in de kokosmelk.'],
      prepMinutes: 30,
      servings: 3,
      why: 'Gebruikt de spinazie die in huis is.',
    })
  })

  test('a certain allergen, diet or dislike clash refuses the idea', () => {
    const strict = { ...prefs, allergens: ['peanuts' as const], diets: [], dislikes: [] }
    expect(
      acceptAiIdea({ ...idea, ingredients: [...idea.ingredients, 'pindakaas'] }, strict, 3),
    ).toBeNull()
    expect(acceptAiIdea({ ...idea, ingredients: ['ui', 'gehakt'] }, { ...prefs, diets: ['vegetarian'] }, 3)).toBeNull()
    expect(acceptAiIdea(idea, { ...prefs, dislikes: ['linzen'] }, 3)).toBeNull()
  })

  test('an answer without a title, ingredients or steps is no idea', () => {
    expect(acceptAiIdea({ ...idea, title: '' }, prefs, 3)).toBeNull()
    expect(acceptAiIdea({ ...idea, ingredients: [] }, prefs, 3)).toBeNull()
    expect(acceptAiIdea({ ...idea, steps: ['500 kcal'] }, prefs, 3)).toBeNull()
    expect(acceptAiIdea('a recipe', prefs, 3)).toBeNull()
  })

  test('nutrition words, in Dutch and English', () => {
    expect(claimsNutrition('Ongeveer 520 kcal per portie')).toBe(true)
    expect(claimsNutrition('Rich in protein')).toBe(true)
    expect(claimsNutrition('Weinig koolhydraten')).toBe(true)
    expect(claimsNutrition('Snijd de kip in blokjes')).toBe(false)
    expect(claimsNutrition('Bak de ui glazig')).toBe(false)
  })

  test('the AI tag marks a saved idea', () => {
    expect(isAiRecipe({ tags: [AI_RECIPE_TAG] })).toBe(true)
    expect(isAiRecipe({ tags: ['Snel'] })).toBe(false)
  })
})
