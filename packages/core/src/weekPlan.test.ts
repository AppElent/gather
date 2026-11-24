import { describe, expect, test } from 'vitest'
import { resolveMealPreferences } from './mealPreferences'
import {
  acceptAiPicks,
  BUSY_EVENING_MINUTES,
  completePlan,
  draftCheck,
  fitsSlot,
  inventedQuickMealFits,
  plannableQuickMeals,
  plannableRecipes,
  REASON_MAX,
  rulesPlan,
  targetLimit,
  type WeekPlanInput,
  type WeekPlanRecipe,
} from './weekPlan'

const prefs = resolveMealPreferences(null, [{ userId: 'a' }])

const recipe = (
  id: string,
  title: string,
  prepMinutes: number,
  rating: number,
  ingredients: string[] = ['ui'],
  extra: Partial<WeekPlanRecipe> = {},
): WeekPlanRecipe => ({ id, title, prepMinutes, rating, ingredients, tags: [], ...extra })

const RECIPES = [
  recipe('r1', 'Tacos', 30, 5, ['kipfilet', 'tortilla']),
  recipe('r2', 'Gnocchi', 20, 3, ['gnocchi', 'spinazie']),
  recipe('r3', 'Lasagne', 60, 5, ['gehakt', 'pasta']),
  recipe('r4', 'Zalm uit de oven', 25, 4, ['zalm', 'citroen']),
  recipe('r5', 'Omelet', 10, 2, ['eieren', 'kaas']),
]

function input(overrides: Partial<WeekPlanInput> = {}): WeekPlanInput {
  return {
    targets: [
      { date: '2026-11-24', slot: 'dinner', maxMinutes: 30, eaters: 3 },
      { date: '2026-11-25', slot: 'dinner', maxMinutes: 30, busyAt: 18 * 60, eaters: 2 },
      { date: '2026-11-26', slot: 'dinner', maxMinutes: 30, eaters: 3 },
    ],
    recipes: RECIPES,
    quickMeals: [{ id: 'q1', title: 'Tosti', prepMinutes: 10 }],
    plannedRecipeIds: [],
    plannedDinnerDates: ['2026-11-23'],
    stock: { inStock: [], low: [] },
    prefs: { ...prefs, fishDays: [], leftoverDays: [] },
    wishes: [],
    skipQuickMeals: [],
    leftoversName: 'Restjes',
    ...overrides,
  }
}

describe('targetLimit', () => {
  test('a busy evening is quick, whatever the weekday allows', () => {
    expect(targetLimit({ date: 'x', slot: 'dinner', maxMinutes: 60, eaters: 1 })).toBe(60)
    expect(targetLimit({ date: 'x', slot: 'dinner', maxMinutes: 60, busyAt: 1080, eaters: 1 })).toBe(BUSY_EVENING_MINUTES)
    expect(targetLimit({ date: 'x', slot: 'dinner', maxMinutes: null, busyAt: 1080, eaters: 1 })).toBe(BUSY_EVENING_MINUTES)
    expect(targetLimit({ date: 'x', slot: 'dinner', maxMinutes: 15, busyAt: 1080, eaters: 1 })).toBe(15)
  })
})

describe('plannableRecipes', () => {
  test('a certain allergen clash is never planned', () => {
    const ids = plannableRecipes(RECIPES, { allergens: ['fish'], diets: [], dislikes: [] }).map((r) => r.id)
    expect(ids).not.toContain('r4')
    expect(ids).toContain('r1')
  })
})

describe('rulesPlan', () => {
  test('fills each slot within its time, once per recipe, best first', () => {
    const picks = rulesPlan(input())
    expect(picks.map((p) => [p.date, p.recipeId])).toEqual([
      ['2026-11-24', 'r1'],
      ['2026-11-25', 'r2'],
      ['2026-11-26', 'r4'],
    ])
    // Lasagne (60 min) never fits a 30-minute evening.
    expect(picks.some((p) => p.recipeId === 'r3')).toBe(false)
  })

  test('the same input always gives the same plan', () => {
    expect(rulesPlan(input())).toEqual(rulesPlan(input()))
  })

  test('skips what is planned or was cooked within the variety window', () => {
    const picks = rulesPlan(
      input({
        plannedRecipeIds: ['r1'],
        recipes: RECIPES.map((r) => (r.id === 'r4' ? { ...r, lastCooked: '2026-11-20' } : r)),
      }),
    )
    const ids = picks.map((p) => p.recipeId ?? p.quickMeal)
    expect(ids).not.toContain('r1')
    expect(ids).not.toContain('r4')
  })

  test('a quick meal when no recipe fits, nothing when nothing does', () => {
    const picks = rulesPlan(
      input({
        recipes: [RECIPES[2]],
        targets: [
          { date: '2026-11-24', slot: 'dinner', maxMinutes: 30, eaters: 3 },
          { date: '2026-11-25', slot: 'dinner', maxMinutes: 30, eaters: 3 },
        ],
      }),
    )
    expect(picks).toEqual([
      { date: '2026-11-24', slot: 'dinner', quickMeal: 'Tosti', quickMealId: 'q1', prepMinutes: 10 },
    ])
  })

  test('the evening after a cook-double day eats the leftovers', () => {
    const picks = rulesPlan(input({ prefs: { ...prefs, fishDays: [], leftoverDays: [1] } }))
    expect(picks[1]).toEqual({ date: '2026-11-25', slot: 'dinner', quickMeal: 'Restjes' })
  })

  test('a fish day prefers fish, and low stock counts', () => {
    const fish = rulesPlan(input({ prefs: { ...prefs, fishDays: [1], leftoverDays: [] } }))
    expect(fish[0].recipeId).toBe('r4')
    const low = rulesPlan(input({ stock: { inStock: [], low: ['Spinazie'] }, wishes: ['useLow'] }))
    expect(low[0].recipeId).toBe('r2')
  })
})

describe('fitsSlot', () => {
  const tagged = (...tags: string[]) => ({ tags })

  test('a meal tag limits the slots, a dessert or bake fits none, else all', () => {
    expect(fitsSlot(tagged('Breakfast', 'quick'), 'dinner')).toBe(false)
    expect(fitsSlot(tagged('ontbijt'), 'breakfast')).toBe(true)
    expect(fitsSlot(tagged('brunch'), 'lunch')).toBe(true)
    expect(fitsSlot(tagged('weeknight'), 'breakfast')).toBe(false)
    expect(fitsSlot(tagged('baking', 'vegetarian'), 'dinner')).toBe(false)
    expect(fitsSlot(tagged('dessert', 'avondeten'), 'dinner')).toBe(true)
    expect(fitsSlot(tagged('pasta'), 'lunch')).toBe(true)
  })

  test('neither planner puts a breakfast on a dinner', () => {
    const oats = recipe('r9', 'Overnight oats', 5, 5, ['havermout'], {
      tags: ['breakfast'],
    })
    const plan = rulesPlan(input({ recipes: [oats, ...RECIPES] }))
    expect(plan.map((pick) => pick.recipeId)).not.toContain('r9')
    expect(
      acceptAiPicks(
        [{ date: '2026-11-24', slot: 'dinner', recipeId: 'r9', reason: 'Snel' }],
        input({ recipes: [oats, ...RECIPES] }),
      ),
    ).toEqual([])
  })
})

describe('quick meals and preferences', () => {
  const none = { allergens: [], diets: [], dislikes: [] }
  test('a made-up name is dropped on any allergy it cannot rule out', () => {
    expect(inventedQuickMealFits('Pasta met garnalen', { ...none, allergens: ['crustaceans'] })).toBe(false)
    expect(inventedQuickMealFits('Shrimp tacos', { ...none, allergens: ['crustaceans'] })).toBe(false)
    // Nothing in the name, but a name can't say "free of": dropped too.
    expect(inventedQuickMealFits('Wraps met hummus', { ...none, allergens: ['crustaceans'] })).toBe(false)
    expect(inventedQuickMealFits('Wraps met hummus', none)).toBe(true)
  })

  test('a certain diet or dislike clash drops it; an unsure diet does not', () => {
    expect(inventedQuickMealFits('Pasta met garnalen', { ...none, diets: ['vegetarian'] })).toBe(false)
    expect(inventedQuickMealFits('Tosti met champignons', { ...none, dislikes: ['champignons'] })).toBe(false)
    expect(inventedQuickMealFits('Wraps met hummus', { ...none, diets: ['vegetarian'] })).toBe(true)
  })

  test('the Group\'s own quick meals go only on a certain clash', () => {
    const own = [
      { id: 'q1', title: 'Tosti' },
      { id: 'q2', title: 'Garnalen uit de pan' },
    ]
    expect(plannableQuickMeals(own, { ...none, allergens: ['crustaceans'] }).map((q) => q.id)).toEqual(['q1'])
  })

  test('the model\'s quick meals: allergens, skipped names and repeats dropped', () => {
    const shellfish = { ...input().prefs, allergens: ['crustaceans' as const] }
    const picks = acceptAiPicks(
      [
        { date: '2026-11-24', slot: 'dinner', quickMeal: 'Pasta met garnalen', reason: 'x' },
        { date: '2026-11-25', slot: 'dinner', quickMeal: 'TOSTI', reason: 'x' },
        { date: '2026-11-26', slot: 'dinner', quickMeal: 'tosti', reason: 'twice' },
      ],
      input({ prefs: shellfish }),
    )
    expect(picks.map((p) => [p.date, p.quickMeal])).toEqual([['2026-11-25', 'Tosti']])

    const clean = acceptAiPicks(
      [
        { date: '2026-11-24', slot: 'dinner', quickMeal: 'Wraps met hummus', reason: 'x' },
        { date: '2026-11-25', slot: 'dinner', quickMeal: 'Pannenkoeken!', reason: 'turned down' },
      ],
      input({ skipQuickMeals: ['pannenkoeken'] }),
    )
    expect(clean.map((p) => p.quickMeal)).toEqual(['Wraps met hummus'])
  })

  test('the rules skip a quick meal whose name is turned down', () => {
    const picks = rulesPlan(input({ recipes: [], skipQuickMeals: ['Tosti'] }))
    expect(picks).toEqual([])
  })
})

describe('acceptAiPicks', () => {
  test('keeps only ids it was given, once per asked slot, within time', () => {
    const picks = acceptAiPicks(
      [
        { date: '2026-11-24', slot: 'dinner', recipeId: 'invented', reason: 'x' },
        { date: '2026-11-24', slot: 'dinner', recipeId: 'r3', reason: 'too long' },
        { date: '2026-11-24', slot: 'dinner', recipeId: 'r1', reason: '  Hoog   beoordeeld ' },
        { date: '2026-11-24', slot: 'dinner', recipeId: 'r2', reason: 'twice' },
        { date: '2026-11-23', slot: 'dinner', recipeId: 'r2', reason: 'not asked' },
        { date: '2026-11-25', slot: 'lunch', recipeId: 'r2', reason: 'not asked' },
        { date: '2026-11-25', slot: 'dinner', recipeId: 'r1', reason: 'used again' },
        { date: '2026-11-25', slot: 'dinner', quickMeal: 'tosti', minutes: 5, reason: 'Snel' },
        { date: '2026-11-26', slot: 'dinner', quickMeal: 'Wraps', minutes: 9999, reason: 'x'.repeat(200) },
        'garbage',
        null,
      ],
      input(),
    )
    expect(picks).toEqual([
      { date: '2026-11-24', slot: 'dinner', recipeId: 'r1', prepMinutes: 30, reason: 'Hoog beoordeeld' },
      { date: '2026-11-25', slot: 'dinner', quickMeal: 'Tosti', quickMealId: 'q1', prepMinutes: 10, reason: 'Snel' },
      { date: '2026-11-26', slot: 'dinner', quickMeal: 'Wraps', quickMealId: undefined, prepMinutes: undefined, reason: expect.any(String) },
    ])
    expect(picks[2].reason?.length).toBe(REASON_MAX)
  })

  test('anything but a list is nothing', () => {
    expect(acceptAiPicks({ meals: [] }, input())).toEqual([])
  })
})

describe('completePlan', () => {
  test('a quick meal the model chose is not chosen again by the rules', () => {
    const plan = completePlan(
      [{ date: '2026-11-24', slot: 'dinner', quickMeal: 'Tosti', quickMealId: 'q1' }],
      input({ recipes: [] }),
    )
    expect(plan.filter((pick) => pick.quickMealId === 'q1')).toHaveLength(1)
  })

  test('the rules fill what the model left, without repeating its recipes', () => {
    const plan = completePlan(
      [{ date: '2026-11-25', slot: 'dinner', recipeId: 'r1', prepMinutes: 30, reason: 'x' }],
      input(),
    )
    expect(plan.map((p) => [p.date, p.recipeId, p.source])).toEqual([
      ['2026-11-24', 'r4', 'rules'],
      ['2026-11-25', 'r1', 'ai'],
      ['2026-11-26', 'r2', 'rules'],
    ])
  })
})

describe('APP-460', () => {
  const none = { allergens: [], diets: [], dislikes: [] }

  test('a long made-up name is checked whole, not cut to 60 characters first', () => {
    const vegetarian = { ...input().prefs, diets: ['vegetarian' as const] }
    const name = `Wraps met hummus, komkommer, tomaat, rode ui en verse munt, met kip`
    expect(name.length).toBeGreaterThan(60)
    expect(name.slice(0, 60)).not.toContain('kip')
    const picks = acceptAiPicks(
      [{ date: '2026-11-24', slot: 'dinner', quickMeal: name, reason: 'x' }],
      input({ prefs: vegetarian }),
    )
    expect(picks).toEqual([])
    // The same name without the meat is kept, cut to fit.
    const kept = acceptAiPicks(
      [{ date: '2026-11-24', slot: 'dinner', quickMeal: name.replace(', met kip', ', met feta en olijven'), reason: 'x' }],
      input({ prefs: vegetarian }),
    )
    expect(kept).toHaveLength(1)
    expect(kept[0].quickMeal?.length).toBeLessThanOrEqual(60)
  })

  test('draftCheck: "controleer zelf" for an allergy a draft cannot rule out', () => {
    const shellfish = { ...none, allergens: ['crustaceans' as const] }
    expect(draftCheck({ quickMeal: 'Tosti', own: false }, shellfish)).toMatchObject({
      kind: 'allergen',
      id: 'crustaceans',
      uncertain: true,
    })
    expect(draftCheck({ quickMeal: 'Tosti', own: false }, none)).toBeUndefined()
    // The Group's own quick meal is a dish it knows: no hint (APP-477).
    expect(draftCheck({ quickMeal: 'Tosti', own: true }, shellfish)).toBeUndefined()
    // A quick meal's name never flags a diet: it would flag every name.
    expect(draftCheck({ quickMeal: 'Tosti', own: false }, { ...none, diets: ['vegetarian'] })).toBeUndefined()
    const pasta = { title: 'Pasta pesto', ingredients: ['pasta', 'pesto'], tags: [] }
    // Pesto often holds nuts.
    expect(draftCheck({ recipe: pasta }, { ...none, allergens: ['nuts'] })).toMatchObject({
      kind: 'allergen',
      id: 'nuts',
      uncertain: true,
    })
    expect(draftCheck({ recipe: { ...pasta, ingredients: ['pasta', 'tomaat'] } }, shellfish)).toBeUndefined()
    expect(draftCheck({ recipe: { ...pasta, ingredients: [] } }, { ...none, diets: ['vegan'] })).toMatchObject({
      kind: 'diet',
      uncertain: true,
    })
  })
})
