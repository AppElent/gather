import { describe, expect, test } from 'vitest'
import {
  ALLERGENS,
  applyMealPreferencesPatch,
  applyMemberDefault,
  budgetText,
  clashReasons,
  DEFAULT_MEAL_PREFERENCES,
  describeClash,
  fitsPreferences,
  type MatchableRecipe,
  nextCookingMinutes,
  normalizeMealPreferencesPatch,
  parseBudgetCents,
  type RecipeClash,
  recipeClashes,
  resolveMealPreferences,
  toggleDay,
  toggleIn,
} from './mealPreferences'
import { en } from './messages/en'
import { nl } from './messages/nl'

const members = [{ userId: 'sanne' }, { userId: 'daan' }, { userId: 'noor' }]

describe('resolveMealPreferences', () => {
  test('no row: every default, everyone eats along', () => {
    const prefs = resolveMealPreferences(null, members)
    expect(prefs.memberDefaults).toEqual([
      { userId: 'sanne', eatsByDefault: true },
      { userId: 'daan', eatsByDefault: true },
      { userId: 'noor', eatsByDefault: true },
    ])
    expect(prefs.defaultEaterIds).toEqual(['sanne', 'daan', 'noor'])
    expect(prefs.servingsOverride).toBeNull()
    expect(prefs.servingsPerMeal).toBe(3)
    expect(prefs.slots).toEqual({
      breakfast: { enabled: false, days: [0, 1, 2, 3, 4, 5, 6] },
      lunch: { enabled: true, days: [5, 6] },
      dinner: { enabled: true, days: [0, 1, 2, 3, 4, 5, 6] },
    })
    expect(prefs.cookingMinutes).toEqual([30, 30, 30, 30, 30, 60, 60])
    expect(prefs.noRepeatDays).toBe(14)
    expect(prefs.meatFreeNights).toBe(0)
    expect(prefs.fishDays).toEqual([])
    expect(prefs.leftoverDays).toEqual([])
    expect(prefs.weeklyBudgetCents).toBeNull()
    expect(prefs.smart).toEqual({
      useStock: true,
      useCalendar: true,
      preferHighRated: true,
    })
    expect(prefs.diets).toEqual([])
    expect(prefs.allergens).toEqual([])
  })

  test('a stored default applies; an ex-Member is dropped; a new Member eats', () => {
    const prefs = resolveMealPreferences(
      {
        memberDefaults: [
          { userId: 'daan', eatsByDefault: false },
          { userId: 'gone', eatsByDefault: false },
        ],
      },
      members,
    )
    expect(prefs.memberDefaults.map((m) => m.userId)).toEqual([
      'sanne',
      'daan',
      'noor',
    ])
    expect(prefs.defaultEaterIds).toEqual(['sanne', 'noor'])
    expect(prefs.servingsPerMeal).toBe(2)
  })

  test('the servings override wins over who eats', () => {
    const prefs = resolveMealPreferences({ servingsPerMeal: 6 }, members)
    expect(prefs.servingsOverride).toBe(6)
    expect(prefs.servingsPerMeal).toBe(6)
  })

  test('nobody eating still plans one serving', () => {
    const prefs = resolveMealPreferences(
      { memberDefaults: [{ userId: 'sanne', eatsByDefault: false }] },
      [{ userId: 'sanne' }],
    )
    expect(prefs.servingsPerMeal).toBe(1)
  })

  test('the result does not share arrays with the defaults', () => {
    const prefs = resolveMealPreferences(null, members)
    prefs.slots.dinner.days.pop()
    prefs.cookingMinutes[0] = 90
    expect(DEFAULT_MEAL_PREFERENCES.slots.dinner.days).toHaveLength(7)
    expect(DEFAULT_MEAL_PREFERENCES.cookingMinutes[0]).toBe(30)
  })

  test('a partial smart row keeps the other switches on', () => {
    const prefs = resolveMealPreferences(
      { smart: { useStock: false, useCalendar: true, preferHighRated: true } },
      members,
    )
    expect(prefs.smart.useStock).toBe(false)
    expect(prefs.smart.preferHighRated).toBe(true)
  })
})

describe('nextCookingMinutes', () => {
  test('cycles 15, 20, 30, 45, 60, 90, none, 15', () => {
    const seen: (number | null)[] = []
    let value: Parameters<typeof nextCookingMinutes>[0] = 15
    for (let i = 0; i < 7; i++) {
      seen.push(value)
      value = nextCookingMinutes(value)
    }
    expect(seen).toEqual([15, 20, 30, 45, 60, 90, null])
    expect(value).toBe(15)
  })
})

describe('normalizeMealPreferencesPatch', () => {
  test('sorts days and trims and dedupes dislikes', () => {
    const result = normalizeMealPreferencesPatch({
      fishDays: [4, 0],
      dislikes: ['  Champignons ', 'champignons', 'koriander'],
    })
    expect(result).toEqual({
      ok: true,
      patch: { fishDays: [0, 4], dislikes: ['Champignons', 'koriander'] },
    })
  })

  test.each([
    [{ servingsPerMeal: 0 }, 'servingsPerMeal'],
    [{ servingsPerMeal: 2.5 }, 'servingsPerMeal'],
    [{ cookingMinutes: [30, 30] }, 'cookingMinutes'],
    [{ cookingMinutes: [25, 30, 30, 30, 30, 60, 60] }, 'cookingMinutes'],
    [{ fishDays: [7] }, 'fishDays'],
    [{ leftoverDays: [1, 1] }, 'leftoverDays'],
    [{ noRepeatDays: -1 }, 'noRepeatDays'],
    [{ meatFreeNights: 8 }, 'meatFreeNights'],
    [{ weeklyBudgetCents: -5 }, 'weeklyBudgetCents'],
    [{ weeklyBudgetCents: 1.5 }, 'weeklyBudgetCents'],
    [{ dislikes: ['   '] }, 'dislikes'],
    [{ dislikes: ['x'.repeat(41)] }, 'dislikes'],
    [{ diets: ['keto'] }, 'diets'],
    [{ allergens: ['milk', 'milk'] }, 'allergens'],
  ] as const)('refuses %j on %s', (patch, field) => {
    expect(
      normalizeMealPreferencesPatch(
        patch as Parameters<typeof normalizeMealPreferencesPatch>[0],
      ),
    ).toEqual({ ok: false, field })
  })

  test('null clears the servings override and the budget', () => {
    expect(
      normalizeMealPreferencesPatch({
        servingsPerMeal: null,
        weeklyBudgetCents: null,
      }),
    ).toEqual({
      ok: true,
      patch: { servingsPerMeal: null, weeklyBudgetCents: null },
    })
  })
})

describe('the optimistic answer', () => {
  const base = resolveMealPreferences(null, members)

  test('a patch reads back as the server will answer it', () => {
    const next = applyMealPreferencesPatch(base, {
      dislikes: [' Koriander ', 'koriander'],
      servingsPerMeal: 5,
    })
    expect(next.dislikes).toEqual(['Koriander'])
    expect(next.servingsPerMeal).toBe(5)
    expect(next.servingsOverride).toBe(5)
    expect(base.dislikes).toEqual([])
  })

  test('null puts servings back to who eats and clears the budget', () => {
    const set = applyMealPreferencesPatch(base, {
      servingsPerMeal: 6,
      weeklyBudgetCents: 8500,
    })
    const cleared = applyMealPreferencesPatch(set, {
      servingsPerMeal: null,
      weeklyBudgetCents: null,
    })
    expect(cleared.servingsPerMeal).toBe(3)
    expect(cleared.servingsOverride).toBeNull()
    expect(cleared.weeklyBudgetCents).toBeNull()
  })

  test('a refused patch changes nothing', () => {
    expect(applyMealPreferencesPatch(base, { meatFreeNights: 9 })).toBe(base)
  })

  test('one Member stops eating along; the servings follow', () => {
    const next = applyMemberDefault(base, 'daan', false)
    expect(next.defaultEaterIds).toEqual(['sanne', 'noor'])
    expect(next.servingsPerMeal).toBe(2)
  })
})

describe('toggles and the budget field', () => {
  test('days stay Monday first', () => {
    expect(toggleDay([4, 0], 2)).toEqual([0, 2, 4])
    expect(toggleDay([0, 2, 4], 2)).toEqual([0, 4])
  })

  test('a set keeps its order', () => {
    expect(toggleIn(['milk', 'eggs'], 'nuts')).toEqual(['milk', 'eggs', 'nuts'])
    expect(toggleIn(['milk', 'eggs'], 'milk')).toEqual(['eggs'])
  })

  test('a budget writes back the way it is typed', () => {
    expect(budgetText(null, ',')).toBe('')
    expect(budgetText(8500, ',')).toBe('85')
    expect(budgetText(8550, ',')).toBe('85,50')
    expect(budgetText(8505, '.')).toBe('85.05')
    for (const cents of [100, 8550, 123456])
      expect(parseBudgetCents(budgetText(cents, ','))).toEqual({
        ok: true,
        cents,
      })
  })
})

describe('parseBudgetCents', () => {
  test.each([
    ['', null],
    ['85', 8500],
    ['85,50', 8550],
    ['85.5', 8550],
    ['€ 1.250,00', 125000],
    ['1250', 125000],
  ])('%j is %s cents', (text, cents) => {
    expect(parseBudgetCents(text)).toEqual({ ok: true, cents })
  })

  test.each(['abc', '-4', '1,2,3', '100000,01'])(
    'refuses %j',
    (text) => {
      expect(parseBudgetCents(text)).toEqual({ ok: false })
    },
  )
})

const recipe = (
  title: string,
  ingredients: string[],
  extra: Partial<MatchableRecipe> = {},
): MatchableRecipe => ({ title, ingredients, tags: [], ...extra })

const prefsWith = (
  overrides: Partial<Parameters<typeof recipeClashes>[1]>,
): Parameters<typeof recipeClashes>[1] => ({
  allergens: [],
  diets: [],
  dislikes: [],
  cookingMinutes: [null, null, null, null, null, null, null],
  ...overrides,
})

const certain = (clashes: readonly RecipeClash[]) =>
  clashes.filter((clash) => !clash.uncertain)

describe('recipeClashes: allergens', () => {
  test('finds an allergen inside a Dutch compound', () => {
    const clashes = recipeClashes(
      recipe('Bami', ['2 el pindakaas', '1 ui']),
      prefsWith({ allergens: ['peanuts'] }),
      0,
    )
    expect(clashes).toEqual([
      { kind: 'allergen', id: 'peanuts', label: 'pindakaas' },
    ])
    expect(fitsPreferences(clashes)).toBe(false)
  })

  test('"ei" is an egg, "prei" is not', () => {
    const eggs = prefsWith({ allergens: ['eggs'] })
    expect(certain(recipeClashes(recipe('Soep', ['1 prei']), eggs, 0))).toEqual(
      [],
    )
    expect(
      certain(recipeClashes(recipe('Ontbijt', ['1 ei, losgeklopt']), eggs, 0)),
    ).toEqual([{ kind: 'allergen', id: 'eggs', label: 'ei' }])
  })

  test('coconut milk is not milk; nutmeg and coconut are not nuts', () => {
    const clashes = recipeClashes(
      recipe('Curry', ['400 ml kokosmelk', 'snufje nootmuskaat', 'Coconut']),
      prefsWith({ allergens: ['milk', 'nuts'] }),
      0,
    )
    expect(certain(clashes)).toEqual([])
  })

  test('pindakaas is a peanut, not cheese', () => {
    const clashes = recipeClashes(
      recipe('Brood', ['pindakaas']),
      prefsWith({ allergens: ['milk'] }),
      0,
    )
    expect(certain(clashes)).toEqual([])
  })

  test('bloemkool is not flour; "5 minuten" is not a nut', () => {
    const clashes = recipeClashes(
      recipe('Bloemkool in 5 minuten', ['1 bloemkool', 'tomatenpasta']),
      prefsWith({ allergens: ['gluten', 'nuts'] }),
      0,
    )
    expect(certain(clashes)).toEqual([])
  })

  test('English ingredients match too, with accents ignored', () => {
    const clashes = recipeClashes(
      recipe('Gratin', ['200 g Gruyère cheese', 'Crème fraîche']),
      prefsWith({ allergens: ['milk'] }),
      0,
    )
    expect(certain(clashes)).toEqual([
      { kind: 'allergen', id: 'milk', label: 'cheese' },
    ])
  })

  test('the title counts as well', () => {
    const clashes = recipeClashes(
      recipe('Zalm uit de oven', ['citroen']),
      prefsWith({ allergens: ['fish'] }),
      0,
    )
    expect(certain(clashes)).toEqual([
      { kind: 'allergen', id: 'fish', label: 'zalm' },
    ])
  })

  test('no ingredients: never claims free of, says check yourself', () => {
    const clashes = recipeClashes(
      recipe('Stamppot', []),
      prefsWith({ allergens: ['milk', 'celery'] }),
      0,
    )
    expect(clashes).toEqual([
      { kind: 'allergen', id: 'milk', label: 'milk', uncertain: true },
      { kind: 'allergen', id: 'celery', label: 'celery', uncertain: true },
    ])
    expect(fitsPreferences(clashes)).toBe(true)
  })

  test('a hidden source is check yourself, not a clash', () => {
    const clashes = recipeClashes(
      recipe('Soep', ['1 l groentebouillon', 'wortel']),
      prefsWith({ allergens: ['celery'] }),
      0,
    )
    expect(clashes).toEqual([
      {
        kind: 'allergen',
        id: 'celery',
        label: 'groentebouillon',
        uncertain: true,
      },
    ])
  })

  test('every allergen has a rule that finds its plainest word', () => {
    const words: Record<(typeof ALLERGENS)[number], string> = {
      gluten: 'tarwebloem',
      crustaceans: 'garnalen',
      eggs: 'eieren',
      fish: 'kabeljauw',
      peanuts: 'pinda',
      soy: 'tofu',
      milk: 'melk',
      nuts: 'walnoten',
      celery: 'bleekselderij',
      mustard: 'mosterd',
      sesame: 'sesamzaad',
      sulphites: 'witte wijn',
      lupin: 'lupinemeel',
      molluscs: 'mosselen',
    }
    for (const allergen of ALLERGENS) {
      const clashes = recipeClashes(
        recipe('Gerecht', [words[allergen]]),
        prefsWith({ allergens: [allergen] }),
        0,
      )
      expect(certain(clashes), allergen).toHaveLength(1)
    }
  })
})

describe('recipeClashes: diets', () => {
  test('vegetarian: meat and fish clash, vegetarian mince does not', () => {
    const veg = prefsWith({ diets: ['vegetarian'] })
    expect(
      certain(recipeClashes(recipe('Lasagne', ['500 g rundergehakt']), veg, 0)),
    ).toEqual([{ kind: 'diet', id: 'vegetarian', label: 'rundergehakt' }])
    expect(
      certain(recipeClashes(recipe('Pasta', ['ansjovis']), veg, 0)),
    ).toHaveLength(1)
    expect(
      recipeClashes(recipe('Lasagne', ['500 g vegetarisch gehakt']), veg, 0),
    ).toEqual([])
  })

  test('"fijngehakte ui" is chopped onion, not mince', () => {
    expect(
      recipeClashes(
        recipe('Soep', ['1 ui, fijn gehakt', '2 tenen knoflook, gehakt']),
        prefsWith({ diets: ['vegetarian'] }),
        0,
      ),
    ).toEqual([])
  })

  test('pescatarian allows fish but not chicken', () => {
    const pesc = prefsWith({ diets: ['pescatarian'] })
    expect(recipeClashes(recipe('Vis', ['zalmfilet']), pesc, 0)).toEqual([])
    expect(
      certain(recipeClashes(recipe('Wok', ['kipdijfilet']), pesc, 0)),
    ).toEqual([{ kind: 'diet', id: 'pescatarian', label: 'kipdijfilet' }])
  })

  test('vegan: dairy, eggs and honey clash; oat milk does not', () => {
    const vegan = prefsWith({ diets: ['vegan'] })
    expect(
      certain(recipeClashes(recipe('Pap', ['havermelk', 'banaan']), vegan, 0)),
    ).toEqual([])
    expect(
      certain(recipeClashes(recipe('Toetje', ['honing']), vegan, 0)),
    ).toEqual([{ kind: 'diet', id: 'vegan', label: 'honing' }])
  })

  test('lactose-free milk fits lactose-free, but not a milk allergy', () => {
    const line = ['lactosevrije melk']
    expect(
      certain(
        recipeClashes(
          recipe('Pap', line),
          prefsWith({ diets: ['lactose-free'] }),
          0,
        ),
      ),
    ).toEqual([])
    expect(
      certain(
        recipeClashes(
          recipe('Pap', line),
          prefsWith({ allergens: ['milk'] }),
          0,
        ),
      ),
    ).toHaveLength(1)
  })

  test('halal: pork and wine clash; chicken is check yourself', () => {
    const halal = prefsWith({ diets: ['halal'] })
    expect(
      certain(recipeClashes(recipe('Pasta', ['spekjes']), halal, 0)),
    ).toEqual([{ kind: 'diet', id: 'halal', label: 'spekjes' }])
    expect(
      certain(recipeClashes(recipe('Risotto', ['witte wijn']), halal, 0)),
    ).toHaveLength(1)
    expect(recipeClashes(recipe('Wok', ['kipfilet']), halal, 0)).toEqual([
      { kind: 'diet', id: 'halal', label: 'kipfilet', uncertain: true },
    ])
    expect(
      recipeClashes(recipe('Wok', ['halal kipfilet']), halal, 0),
    ).toEqual([])
  })

  test('a diet tag answers for a recipe without ingredients, never over a keyword', () => {
    const veg = prefsWith({ diets: ['vegetarian'] })
    expect(
      recipeClashes(recipe('Curry', [], { tags: ['Vegetarisch'] }), veg, 0),
    ).toEqual([])
    expect(recipeClashes(recipe('Curry', []), veg, 0)).toEqual([
      { kind: 'diet', id: 'vegetarian', label: 'vegetarian', uncertain: true },
    ])
    expect(
      certain(
        recipeClashes(
          recipe('Curry', ['kipfilet'], { tags: ['vegetarisch'] }),
          veg,
          0,
        ),
      ),
    ).toHaveLength(1)
  })
})

describe('recipeClashes: dislikes and time', () => {
  test('a dislike matches singular, plural, any case', () => {
    const prefs = prefsWith({ dislikes: ['Champignons', 'koriander'] })
    expect(
      recipeClashes(recipe('Risotto', ['1 champignon', 'verse Koriander']), prefs, 0),
    ).toEqual([
      { kind: 'dislike', label: 'Champignons' },
      { kind: 'dislike', label: 'koriander' },
    ])
  })

  test('over the weekday maximum clashes; no maximum or no time does not', () => {
    const prefs = prefsWith({
      cookingMinutes: [20, null, 30, 30, 30, 60, 60],
    })
    const slow = recipe('Stoof', ['ui'], { prepMinutes: 45 })
    expect(recipeClashes(slow, prefs, 0)).toEqual([
      { kind: 'time', label: '45 min', minutes: 45, limit: 20 },
    ])
    expect(recipeClashes(slow, prefs, 1)).toEqual([])
    expect(recipeClashes(slow, prefs, 5)).toEqual([])
    expect(recipeClashes(recipe('Stoof', ['ui']), prefs, 0)).toEqual([])
  })

  test('no preferences: nothing clashes', () => {
    expect(
      recipeClashes(
        recipe('Alles', ['kip', 'pinda', 'melk'], { prepMinutes: 120 }),
        prefsWith({}),
        3,
      ),
    ).toEqual([])
  })
})

describe('describeClash', () => {
  const m = nl.mealPreferences
  test('reads in Dutch as the design writes it', () => {
    expect(
      describeClash({ kind: 'allergen', id: 'peanuts', label: 'pinda' }, m),
    ).toBe('Bevat pinda')
    expect(describeClash({ kind: 'dislike', label: 'champignons' }, m)).toBe(
      'Bevat champignons, staat bij liever niet',
    )
    expect(
      describeClash(
        { kind: 'allergen', id: 'milk', label: 'milk', uncertain: true },
        m,
      ),
    ).toBe('Controleer zelf: Melk')
    expect(
      describeClash(
        { kind: 'diet', id: 'vegetarian', label: 'spek' },
        en.mealPreferences,
      ),
    ).toBe('Not vegetarian: spek')
  })

  test('status reasons name each certain word once', () => {
    expect(
      clashReasons(
        [
          { kind: 'allergen', id: 'peanuts', label: 'pinda' },
          { kind: 'allergen', id: 'peanuts', label: 'pinda' },
          { kind: 'allergen', id: 'milk', label: 'milk', uncertain: true },
          { kind: 'dislike', label: 'champignons' },
        ],
        m,
      ),
    ).toEqual(['pinda', 'champignons'])
  })
})
