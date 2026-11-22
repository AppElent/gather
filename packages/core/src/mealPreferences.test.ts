import { describe, expect, test } from 'vitest'
import {
  ALLERGENS,
  applyMealPreferencesPatch,
  applyMemberDefault,
  budgetText,
  clashReasons,
  DEFAULT_MEAL_PREFERENCES,
  describeClash,
  describeClashes,
  fitsPreferences,
  listChangePatch,
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

describe('listChangePatch', () => {
  const current = {
    allergens: ['milk' as const],
    diets: [],
    dislikes: ['Koriander'],
    cuisines: ['dutch' as const],
    fishDays: [4 as const],
    leftoverDays: [],
    slots: DEFAULT_MEAL_PREFERENCES.slots as ReturnType<
      typeof resolveMealPreferences
    >['slots'],
  }

  test('adds and removes one item, keeping the rest', () => {
    expect(
      listChangePatch(current, { list: 'allergens', value: 'eggs', on: true }),
    ).toEqual({ ok: true, patch: { allergens: ['milk', 'eggs'] } })
    expect(
      listChangePatch(current, { list: 'allergens', value: 'milk', on: false }),
    ).toEqual({ ok: true, patch: { allergens: [] } })
    expect(
      listChangePatch(current, { list: 'diets', value: 'vegan', on: true }),
    ).toEqual({ ok: true, patch: { diets: ['vegan'] } })
  })

  test('on twice and off twice are no-ops', () => {
    expect(
      listChangePatch(current, { list: 'allergens', value: 'milk', on: true }),
    ).toEqual({ ok: true, patch: { allergens: ['milk'] } })
    expect(
      listChangePatch(current, { list: 'diets', value: 'halal', on: false }),
    ).toEqual({ ok: true, patch: { diets: [] } })
  })

  test('dislikes match ignoring case and are refused when empty or too long', () => {
    expect(
      listChangePatch(current, { list: 'dislikes', value: ' koriander ', on: true }),
    ).toEqual({ ok: true, patch: { dislikes: ['Koriander'] } })
    expect(
      listChangePatch(current, { list: 'dislikes', value: 'KORIANDER', on: false }),
    ).toEqual({ ok: true, patch: { dislikes: [] } })
    expect(
      listChangePatch(current, { list: 'dislikes', value: '  ', on: true }),
    ).toEqual({ ok: false, field: 'dislikes' })
    expect(
      listChangePatch(current, {
        list: 'dislikes',
        value: 'x'.repeat(41),
        on: true,
      }),
    ).toEqual({ ok: false, field: 'dislikes' })
  })
})

describe('listChangePatch: cuisines, days and slots (APP-446)', () => {
  const current = resolveMealPreferences(
    { cuisines: ['dutch'], fishDays: [4], leftoverDays: [2] },
    members,
  )

  test('a cuisine and a fish or leftover day, one item, order kept or Monday first', () => {
    expect(
      listChangePatch(current, { list: 'cuisines', value: 'indian', on: true }),
    ).toEqual({ ok: true, patch: { cuisines: ['dutch', 'indian'] } })
    expect(
      listChangePatch(current, { list: 'cuisines', value: 'dutch', on: false }),
    ).toEqual({ ok: true, patch: { cuisines: [] } })
    expect(
      listChangePatch(current, { list: 'fishDays', value: 1, on: true }),
    ).toEqual({ ok: true, patch: { fishDays: [1, 4] } })
    expect(
      listChangePatch(current, { list: 'leftoverDays', value: 2, on: false }),
    ).toEqual({ ok: true, patch: { leftoverDays: [] } })
  })

  test('on twice and off twice are no-ops', () => {
    expect(
      listChangePatch(current, { list: 'cuisines', value: 'dutch', on: true }),
    ).toEqual({ ok: true, patch: { cuisines: ['dutch'] } })
    expect(
      listChangePatch(current, { list: 'fishDays', value: 0, on: false }),
    ).toEqual({ ok: true, patch: { fishDays: [4] } })
  })

  test('a slot changes its own day or switch and leaves the others alone', () => {
    const day = listChangePatch(current, {
      list: 'slotDays',
      slot: 'lunch',
      value: 0,
      on: true,
    })
    expect(day.ok && day.patch.slots).toEqual({
      ...DEFAULT_MEAL_PREFERENCES.slots,
      lunch: { enabled: true, days: [0, 5, 6] },
    })
    const off = listChangePatch(current, {
      list: 'slotEnabled',
      slot: 'breakfast',
      on: true,
    })
    expect(off.ok && off.patch.slots?.breakfast.enabled).toBe(true)
    expect(off.ok && off.patch.slots?.dinner).toEqual(
      DEFAULT_MEAL_PREFERENCES.slots.dinner,
    )
    // The Group's resolved slots are never changed in place.
    expect(current.slots.lunch.days).toEqual([5, 6])
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

  test.each([
    ['1.250', ',', 125000],
    ['85,50', ',', 8550],
    ['85.50', ',', 8550],
    ['1,250', '.', 125000],
    ['1,250.50', '.', 125050],
    ['85.5', '.', 8550],
    ['85,50', '.', 8550],
  ] as const)('%j in a %j locale is %s cents', (text, decimal, cents) => {
    expect(parseBudgetCents(text, decimal)).toEqual({ ok: true, cents })
  })

  test('English 1.250 is refused, not read as €1,250', () => {
    expect(parseBudgetCents('1.250', '.')).toEqual({ ok: false })
    expect(parseBudgetCents('1.250,00', '.')).toEqual({ ok: false })
  })
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

describe('recipeClashes: the round-1 review cases', () => {
  const hides = (
    line: string,
    overrides: Partial<Parameters<typeof recipeClashes>[1]>,
  ) => certain(recipeClashes(recipe('Recept', [line]), prefsWith(overrides), 0))

  test.each([
    ["400 g gamba's", 'crustaceans'],
    ['500 g vongole', 'molluscs'],
    ['2 snoekbaarsfilets', 'fish'],
    ['4 scholfilets', 'fish'],
    ['300 g paling', 'fish'],
    ['1 zeeduivel', 'fish'],
    ['2 tongfilets', 'fish'],
    ['150 g havervlokken', 'gluten'],
    ['200 g zelfrijzend bakmeel', 'gluten'],
    ['1 ciabatta', 'gluten'],
    ['1 baguette', 'gluten'],
    ['200 g udon', 'gluten'],
    ['12 lange vingers', 'gluten'],
    ['4 speculaasjes', 'gluten'],
    ['4 eitjes', 'eggs'],
    ['1 kippenei', 'eggs'],
    ['2 scharreleieren', 'eggs'],
  ] as const)('%s is a certain %s clash', (line, allergen) => {
    expect(hides(line, { allergens: [allergen] })).toEqual([
      expect.objectContaining({ kind: 'allergen', id: allergen }),
    ])
  })

  test.each([
    '4 schnitzels',
    '2 karbonades',
    '2 entrecotes',
    '1 kg spareribs',
    '500 g half-om-half gehakt',
    '6 merguez worstjes',
  ])('%s is not vegetarian', (line) => {
    expect(hides(line, { diets: ['vegetarian'] })).toEqual([
      expect.objectContaining({ kind: 'diet', id: 'vegetarian' }),
    ])
  })

  test('half-om-half gehakt is not halal, rundergehakt is "controleer zelf"', () => {
    expect(hides('500 g half-om-half gehakt', { diets: ['halal'] })).toHaveLength(1)
    const beef = recipeClashes(
      recipe('Gehaktballen', ['500 g gehakt']),
      prefsWith({ diets: ['halal'] }),
      0,
    )
    expect(beef).toEqual([
      expect.objectContaining({ kind: 'diet', id: 'halal', uncertain: true }),
    ])
  })

  test('a guarded line is "controleer zelf", never silence', () => {
    const flour = recipeClashes(
      recipe('Toetje', ['200 g bloem (of glutenvrij meel)']),
      prefsWith({ allergens: ['gluten'] }),
      0,
    )
    expect(flour).toEqual([
      expect.objectContaining({ id: 'gluten', uncertain: true }),
    ])
    expect(fitsPreferences(flour)).toBe(true)
    const chicken = recipeClashes(
      recipe('Wraps', ['300 g kip (of vegetarische kip)']),
      prefsWith({ diets: ['vegetarian'] }),
      0,
    )
    expect(chicken).toEqual([
      expect.objectContaining({ id: 'vegetarian', uncertain: true }),
    ])
  })

  test('look-alikes stay quiet', () => {
    expect(hides('1 gele paprika', { allergens: ['fish'] })).toEqual([])
    expect(hides('100 g wilde rijst', { diets: ['vegetarian'] })).toEqual([])
    expect(hides('1 tl speculaaskruiden', { allergens: ['gluten'] })).toEqual([])
    expect(hides('1 aubergine (eggplant)', { allergens: ['eggs'] })).toEqual([])
  })
})

describe('recipeClashes: the round-1 Sonnet review cases', () => {
  const hides = (
    line: string,
    overrides: Partial<Parameters<typeof recipeClashes>[1]>,
  ) => certain(recipeClashes(recipe('Recept', [line]), prefsWith(overrides), 0))

  test.each([
    ['1 bol vanille-ijs', 'milk'],
    ['4 boterhammen', 'gluten'],
    ['2 sneetjes toast', 'gluten'],
    ['1 taartbodem', 'gluten'],
    ['6 amaretti', 'nuts'],
    ['2 kwarteleitjes', 'eggs'],
  ] as const)('%s is a certain %s clash', (line, allergen) => {
    expect(hides(line, { allergens: [allergen] })).toEqual([
      expect.objectContaining({ kind: 'allergen', id: allergen }),
    ])
  })

  test('ijsbergsla is not ice cream', () => {
    expect(hides('1 krop ijsbergsla', { allergens: ['milk'] })).toEqual([])
  })

  test('ossenhaas is not vegetarian', () => {
    expect(hides('400 g ossenhaas', { diets: ['vegetarian'] })).toHaveLength(1)
  })

  test('a serrano pepper is not ham; serranoham is', () => {
    expect(hides('1 serrano peper', { diets: ['halal'] })).toEqual([])
    expect(hides('4 plakjes serranoham', { diets: ['halal'] })).toHaveLength(1)
  })

  test('one item’s free-from word does not clear the next item', () => {
    expect(
      recipeClashes(
        recipe('Toetje', ['glutenvrije pasta en tarwebloem']),
        prefsWith({ allergens: ['gluten'] }),
        0,
      ),
    ).toEqual([expect.objectContaining({ id: 'gluten', uncertain: true })])
    expect(
      hides('200 g glutenvrije pasta', { allergens: ['gluten'] }),
    ).toEqual([])
  })

  test('a short dislike must start a word', () => {
    const dislikes = (line: string, dislike: string) =>
      recipeClashes(recipe('Recept', [line]), prefsWith({ dislikes: [dislike] }), 0)
    expect(dislikes('1 el suiker', 'ui')).toEqual([])
    expect(dislikes('verse kruiden', 'ui')).toEqual([])
    expect(dislikes('1 prei', 'ei')).toEqual([])
    expect(dislikes('250 g champignons', 'ham')).toEqual([])
    expect(dislikes('1 rode ui', 'ui')).toHaveLength(1)
    expect(dislikes('200 g uienringen', 'ui')).toHaveLength(1)
    expect(dislikes('250 g kastanjechampignons', 'champignons')).toHaveLength(1)
  })
})

describe('recipeClashes: the round-2 Opus review cases', () => {
  type Prefs = Parameters<typeof recipeClashes>[1]
  const clashes = (
    line: string,
    chosen: {
      allergens?: readonly Prefs['allergens'][number][]
      diets?: readonly Prefs['diets'][number][]
    },
  ) =>
    recipeClashes(
      recipe('Toetje', [line]),
      prefsWith({
        allergens: [...(chosen.allergens ?? [])],
        diets: [...(chosen.diets ?? [])],
      }),
      0,
    )

  test.each([
    ['spaghetti (eventueel glutenvrij)', { allergens: ['gluten'] }],
    ['200 g bloem, glutenvrij indien nodig', { allergens: ['gluten'] }],
    ['2 kipfilets (vegetariërs: gebruik tofu)', { diets: ['vegetarian'] }],
    [
      '500 g beef mince (see tip for a vegetarian version)',
      { diets: ['vegetarian'] },
    ],
  ] as const)('a tip after the term is "controleer zelf": %s', (line, prefs) => {
    const found = clashes(line, prefs)
    expect(found).toHaveLength(1)
    expect(found[0].uncertain).toBe(true)
  })

  test.each([
    ['200 g bramen', { allergens: ['gluten'] }],
    ['1 pot bramenjam', { diets: ['gluten-free'] }],
    ['250 g wild mushrooms', { diets: ['vegetarian'] }],
    ['1 bosje wild garlic', { diets: ['halal'] }],
    ['1 bosje wild garlic', { diets: ['vegetarian'] }],
    ['50 g wild rocket', { diets: ['vegetarian'] }],
    ['125 g wild blueberries', { diets: ['vegetarian'] }],
    ['200 g bramen', { diets: ['gluten-free'] }],
    ['2 bloemkoolschnitzels', { diets: ['vegetarian'] }],
    ['1 tofuschnitzel', { diets: ['vegetarian'] }],
    ['100 g rijst vermicelli', { allergens: ['gluten'] }],
    ['2 el sukade', { diets: ['halal'] }],
    ['carpaccio van rode biet', { diets: ['vegetarian'] }],
    ['1 tomatencarpaccio', { diets: ['vegetarian'] }],
    ['50 g sukade', { diets: ['vegetarian'] }],
    ['4 selderijschnitzels', { diets: ['vegetarian'] }],
    ['100 g rice vermicelli', { allergens: ['gluten'] }],
    ['4 maiswafels', { allergens: ['gluten'] }],
    ['6 rijstkoekjes', { allergens: ['gluten'] }],
    ['1 l half om half melk en room', { diets: ['halal'] }],
    ['4 plakjes spekkoek', { diets: ['halal'] }],
    ['300 g runder tong', { allergens: ['fish'] }],
  ] as const)('%s is not hidden', (line, prefs) => {
    expect(certain(clashes(line, prefs))).toEqual([])
  })

  test('still caught: ramen noodles, game stew, beef carpaccio, sukadelappen', () => {
    expect(certain(clashes('2 pakjes ramen', { allergens: ['gluten'] }))).toHaveLength(1)
    expect(certain(clashes('500 g wildstoof', { diets: ['vegetarian'] }))).toHaveLength(1)
    expect(
      certain(clashes('100 g rundercarpaccio', { diets: ['vegetarian'] })),
    ).toHaveLength(1)
    expect(certain(clashes('2 sukadelappen', { diets: ['vegetarian'] }))).toHaveLength(1)
    expect(certain(clashes('4 tongfilets', { allergens: ['fish'] }))).toHaveLength(1)
  })
})

describe('recipeClashes: the round-2 Sonnet review cases', () => {
  type Prefs = Parameters<typeof recipeClashes>[1]
  const clashes = (
    line: string,
    chosen: {
      allergens?: readonly Prefs['allergens'][number][]
      diets?: readonly Prefs['diets'][number][]
      dislikes?: readonly string[]
    },
  ) =>
    recipeClashes(
      recipe('Toetje', [line]),
      prefsWith({
        allergens: [...(chosen.allergens ?? [])],
        diets: [...(chosen.diets ?? [])],
        dislikes: [...(chosen.dislikes ?? [])],
      }),
      0,
    )

  test.each([
    ['pasta, glutenvrij', { diets: ['gluten-free'] }],
    ['wraps, glutenvrij', { allergens: ['gluten'] }],
    ['worst, vegetarisch', { diets: ['vegetarian'] }],
    ['gehakt, vegetarisch', { diets: ['vegetarian'] }],
    ['melk, lactosevrij', { diets: ['lactose-free'] }],
    ['kipfilet, halal', { diets: ['halal'] }],
  ] as const)('a trailing free-from word is "controleer zelf": %s', (line, prefs) => {
    const found = clashes(line, prefs)
    expect(found).toHaveLength(1)
    expect(found[0].uncertain).toBe(true)
  })

  test.each([
    ['pasta (use gluten free pasta if needed)', { allergens: ['gluten'] }],
    ['soy sauce (use tamari if gluten free)', { allergens: ['gluten'] }],
    ['pasta (glutenvrij of gewoon)', { allergens: ['gluten'] }],
  ] as const)('a tip is "controleer zelf": %s', (line, prefs) => {
    const found = clashes(line, prefs)
    expect(found).toHaveLength(1)
    expect(found[0].uncertain).toBe(true)
  })

  test.each([
    ['1 el toasted sesame seeds', { allergens: ['gluten'] }],
    ['1 koekenpan', { allergens: ['gluten'] }],
    ['1 cakevorm van 24 cm', { allergens: ['gluten'] }],
    ['a cookie cutter', { allergens: ['gluten'] }],
    ['Oma Margriet’s soep', { allergens: ['fish'] }],
    ['200 ml half-om-half yoghurt', { diets: ['halal'] }],
    ['4 boterhammen', { allergens: ['milk'] }],
    ['200 g gemalen ijs', { allergens: ['milk'] }],
  ] as const)('%s is not hidden', (line, prefs) => {
    expect(certain(clashes(line, prefs))).toEqual([])
  })

  test.each([
    ['2 sneetjes toast', { allergens: ['gluten'] }],
    ['4 speculoos', { allergens: ['gluten'] }],
    ['500 g vanilleijs', { allergens: ['milk'] }],
    ['1 kg spare ribs', { diets: ['vegetarian'] }],
  ] as const)('%s is caught', (line, prefs) => {
    expect(certain(clashes(line, prefs))).toHaveLength(1)
  })

  test.each([
    ['1 blik kikkererwten, uitgelekt', 'ui'],
    ['tonijn uit blik', 'ui'],
    ['sap van 1 uitgeperste citroen', 'ui'],
    ['eigengemaakte pesto', 'ei'],
    ['1 eigeel', 'ei'],
    ['4 hamburgerbroodjes', 'ham'],
  ])('dislike %s does not hide on %s', (line, dislike) => {
    expect(clashes(line, { dislikes: [dislike] })).toEqual([])
  })

  test.each([
    ['2 uien', 'ui'],
    ['een handje uitjes', 'ui'],
    ['200 g uienringen', 'ui'],
    ['4 eieren', 'ei'],
    ['100 g ham', 'ham'],
  ])('%s is a %s dislike', (line, dislike) => {
    expect(clashes(line, { dislikes: [dislike] })).toHaveLength(1)
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

describe('recipeClashes: the final-check blockers', () => {
  type Prefs = Parameters<typeof recipeClashes>[1]
  const clashes = (
    line: string,
    chosen: {
      allergens?: readonly Prefs['allergens'][number][]
      diets?: readonly Prefs['diets'][number][]
    },
  ) =>
    recipeClashes(
      recipe('Toetje', [line]),
      prefsWith({
        allergens: [...(chosen.allergens ?? [])],
        diets: [...(chosen.diets ?? [])],
        dislikes: [],
      }),
      0,
    )

  // Blocker 1: a free-from word never removes a hit.
  test.each([
    ['200 g pasta (gewoon of glutenvrij)', { allergens: ['gluten'] }],
    ['spaghetti of glutenvrij', { allergens: ['gluten'] }],
    ['300 g tarwebloem of glutenvrije', { allergens: ['gluten'] }],
    ['tarwebloem en glutenvrij', { allergens: ['gluten'] }],
    ['200 g pasta, zout, glutenvrij', { allergens: ['gluten'] }],
    ['glutenvrije pasta en tarwebloem', { allergens: ['gluten'] }],
    ['glutenvrije pasta met paneermeel', { allergens: ['gluten'] }],
    ['250 ml melk (volle of lactosevrije)', { diets: ['lactose-free'] }],
    ['500 g gehakt of vegetarisch', { diets: ['vegetarian'] }],
    ['2 kipfilets (of vegetarisch)', { diets: ['vegetarian'] }],
    ['vegetarische worst met spekjes', { diets: ['vegetarian'] }],
    ['kip (of vegetarische kip)', { diets: ['vegetarian'] }],
    ['kipfilet of halal', { diets: ['halal'] }],
  ] as const)('a line with a free-from word and another term is "controleer zelf": %s', (line, prefs) => {
    const found = clashes(line, prefs)
    expect(found.length).toBeGreaterThan(0)
    expect(certain(found)).toEqual([])
  })

  test.each([
    ['200 g glutenvrije pasta', { allergens: ['gluten'] }],
    ['500 g vegetarisch gehakt', { diets: ['vegetarian'] }],
    ['2 vegaschnitzels', { diets: ['vegetarian'] }],
    ['1 l lactosevrije melk', { diets: ['lactose-free'] }],
    ['2 halal kipfilets', { diets: ['halal'] }],
  ] as const)('a line whose only term is free-from is fine: %s', (line, prefs) => {
    expect(clashes(line, prefs)).toEqual([])
  })

  // Blocker 2: the ambiguous words are "controleer zelf", never silent.
  test.each([
    ['500 g half om half gehakt', { diets: ['vegetarian'] }],
    ['500 g sukadelap', { diets: ['vegetarian'] }],
    ['500 g wildstoof', { diets: ['vegetarian'] }],
    ['2 grietfilets', { allergens: ['fish'] }],
    ['2 grietfilets', { diets: ['vegetarian'] }],
    ['1 kom ramensoep', { allergens: ['gluten'] }],
  ] as const)('the certain form hides: %s', (line, prefs) => {
    expect(certain(clashes(line, prefs))).toHaveLength(1)
  })

  test.each([
    ['500 g half om half', { diets: ['vegetarian'] }],
    ['500 g half-om-half', { diets: ['vegetarian'] }],
    ['200 ml half om half melk', { diets: ['vegetarian'] }],
    ['500 g wild', { diets: ['vegetarian'] }],
    ['1 griet', { allergens: ['fish'] }],
    ['1 griet', { diets: ['vegetarian'] }],
    ['Oma Margriet’s soep', { allergens: ['fish'] }],
  ] as const)('the ambiguous word is "controleer zelf": %s', (line, prefs) => {
    const found = clashes(line, prefs)
    expect(found.length).toBeGreaterThan(0)
    expect(certain(found)).toEqual([])
  })
})

describe('recipeClashes: the APP-446 follow-ups', () => {
  type Prefs = Parameters<typeof recipeClashes>[1]
  const clashes = (
    line: string,
    chosen: {
      allergens?: readonly Prefs['allergens'][number][]
      diets?: readonly Prefs['diets'][number][]
      dislikes?: readonly string[]
    },
    title = 'Toetje',
  ) =>
    recipeClashes(
      recipe(title, line ? [line] : []),
      prefsWith({
        allergens: [...(chosen.allergens ?? [])],
        diets: [...(chosen.diets ?? [])],
        dislikes: [...(chosen.dislikes ?? [])],
      }),
      0,
    )
  const m = nl.mealPreferences

  describe('title-only recipes say it once', () => {
    test('one combined line, never one per allergen', () => {
      const found = clashes('', { allergens: ['gluten', 'milk', 'eggs'] })
      expect(found).toHaveLength(3)
      expect(found.every((clash) => clash.uncertain)).toBe(true)
      expect(describeClashes(found, m)).toBe(
        `Controleer zelf: ${m.allergies.names.gluten}, ${m.allergies.names.milk}, ${m.allergies.names.eggs}`,
      )
    })

    test('allergens and diets share the line, a term from the recipe is named', () => {
      const found = clashes('1 blokje bouillon', {
        allergens: ['celery'],
        diets: ['vegetarian'],
      })
      expect(describeClashes(found, m)).toBe(
        `Controleer zelf: bouillon (${m.allergies.names.celery}), bouillon (${m.diet.names.vegetarian})`,
      )
    })

    test('a certain clash is described on its own, over any "controleer zelf"', () => {
      const found = clashes('200 g pindakaas', { allergens: ['peanuts', 'milk', 'gluten'] })
      expect(describeClashes(found, m)).toBe('Bevat pindakaas')
    })

    test('nothing clashing is no line; the same allergen twice is named once', () => {
      expect(describeClashes([], m)).toBeUndefined()
      const twice: RecipeClash[] = [
        { kind: 'allergen', id: 'milk', label: 'milk', uncertain: true },
        { kind: 'allergen', id: 'milk', label: 'milk', uncertain: true },
      ]
      expect(describeClashes(twice, m)).toBe('Controleer zelf: Melk')
    })

    test('it is still never a hide', () => {
      expect(
        fitsPreferences(clashes('', { allergens: ['gluten', 'milk'], diets: ['vegan'] })),
      ).toBe(true)
    })
  })

  describe('the reason keeps the recipe’s own spelling', () => {
    test('"Saté" with its accent, matched on "sate"', () => {
      const found = clashes('', { allergens: ['peanuts'] }, 'Saté van kip')
      expect(found).toEqual([{ kind: 'allergen', id: 'peanuts', label: 'saté' }])
      expect(clashReasons(found, m)).toEqual(['saté'])
    })

    test('an ingredient line, a diet and a run of words', () => {
      expect(clashes('2 kipfilets sauté', { diets: ['vegetarian'] })[0]?.label).toBe('kipfilets')
      expect(clashes('1 bakje crème fraîche', { allergens: ['milk'] })[0]?.label).toBe(
        'crème fraîche',
      )
    })

    test('a plain word is unchanged; no match falls back to the normalised word', () => {
      expect(clashes('200 g pindakaas', { allergens: ['peanuts'] })[0]?.label).toBe('pindakaas')
    })
  })

  describe('a short dislike finds its compounds', () => {
    test.each([
      ['400 g kipfilet', 'kip'],
      ['2 kippendijen', 'kip'],
      ['1 l kippensoep', 'kip'],
      ['kipsaus', 'kip'],
      ['2 kippen', 'kip'],
      ['300 g visfilet', 'vis'],
      ['1 kom vissoep', 'vis'],
      ['2 vissen', 'vis'],
      ['1 eiersalade', 'ei'],
    ])('%s is a %s dislike', (line, dislike) => {
      expect(clashes(line, { dislikes: [dislike] })).toHaveLength(1)
    })

    test.each([
      ['een visite', 'vis'],
      ['1 visum', 'vis'],
      ['4 hamburgerbroodjes', 'ham'],
      ['1 blik kikkererwten, uitgelekt', 'ui'],
      ['1 kipper', 'kip'],
      ['500 g televisie-kaas', 'vis'],
      ['eigengemaakte pesto', 'ei'],
    ])('%s is not a %s dislike', (line, dislike) => {
      expect(clashes(line, { dislikes: [dislike] })).toEqual([])
    })

    test('the other way round: a long dislike does not match its short stem', () => {
      expect(clashes('400 g kip', { dislikes: ['kipfilet'] })).toEqual([])
      expect(clashes('300 g vis', { dislikes: ['visfilet'] })).toEqual([])
      expect(clashes('400 g kipfilet', { dislikes: ['kipfilet'] })).toHaveLength(1)
    })
  })

  describe('rice and glass noodles are "controleer zelf", never a hide', () => {
    test.each([
      '200 g rice vermicelli noodles',
      '200 g rice noodles',
      '200 g glass noodles',
      '200 g cellophane noodles',
      '200 g rijstnoedels',
      '200 g glasnoedels',
      '200 g rijstvermicelli',
      '200 g rijst vermicelli',
    ])('%s', (line) => {
      const found = clashes(line, { allergens: ['gluten'] })
      expect(certain(found)).toEqual([])
      expect(found).toHaveLength(1)
      expect(found[0]?.uncertain).toBe(true)
      expect(fitsPreferences(found)).toBe(true)
    })

    test.each(['200 g egg noodles', '200 g wheat noodles', '200 g noedels', '200 g noodles'])(
      'still hidden: %s',
      (line) => {
        expect(certain(clashes(line, { allergens: ['gluten'] }))).toHaveLength(1)
      },
    )

    test('the gluten-free diet reads the same way', () => {
      const found = clashes('200 g rice vermicelli noodles', { diets: ['gluten-free'] })
      expect(certain(found)).toEqual([])
      expect(found).toHaveLength(1)
    })
  })

  describe('the label is the whole word', () => {
    test('koekenpannenkoek, not "nenkoek"', () => {
      const found = clashes('', { allergens: ['gluten'] }, 'Koekenpannenkoek met spek')
      expect(found).toEqual([
        { kind: 'allergen', id: 'gluten', label: 'koekenpannenkoek' },
      ])
    })

    test('a line with the pan itself is still quiet', () => {
      expect(clashes('1 koekenpan', { allergens: ['gluten'] })).toEqual([])
    })
  })

  describe('wild and sukade are no longer noise for vegetarians', () => {
    test.each([
      '1 bosje wild garlic',
      '50 g wild rocket',
      '250 g wild mushrooms',
      '125 g wild blueberries',
      '300 g wild rice',
      '2 el candied peel',
      '50 g sukadesnippers',
      '50 g sukadeblokjes',
      '2 el gekonfijte sukade',
      '2 el sukade snippers',
    ])('%s', (line) => {
      expect(clashes(line, { diets: ['vegetarian'] })).toEqual([])
      expect(clashes(line, { diets: ['vegan'] })).toEqual([])
    })

    test.each(['500 g sukade', '2 el sukade', 'sukade in blokjes'])(
      'a bare sukade may be the beef cut: "controleer zelf", never silent, never a hide: %s',
      (line) => {
        for (const diet of ['vegetarian', 'vegan'] as const) {
          const found = clashes(line, { diets: [diet] })
          expect(found).toHaveLength(1)
          expect(found[0]?.uncertain).toBe(true)
          expect(fitsPreferences(found)).toBe(true)
        }
      },
    )

    test.each(['400 g venison', '2 hertenbiefstuk', '300 g reerug', '1 reebout', '2 reefilets'])(
      'game meat hides for vegetarians: %s',
      (line) => {
        expect(certain(clashes(line, { diets: ['vegetarian'] }))).toHaveLength(1)
        expect(certain(clashes(line, { diets: ['vegan'] }))).toHaveLength(1)
      },
    )

    test('"wild rice and venison" hides; "wild garlic" stays quiet; "kreeft" is not game', () => {
      expect(
        certain(clashes('300 g wild rice and venison', { diets: ['vegetarian'] })),
      ).toHaveLength(1)
      expect(clashes('1 bosje wild garlic', { diets: ['vegetarian'] })).toEqual([])
      // A lobster hides for its own reason (seafood); "ree" in it is not game.
      expect(clashes('1 kreeft', { diets: ['vegetarian'] })).toEqual([
        { kind: 'diet', id: 'vegetarian', label: 'kreeft' },
      ])
      expect(clashes('1 ree', { diets: ['vegetarian'] })[0]?.uncertain).toBeUndefined()
    })

    test('bare "wild" is still "controleer zelf"; game and the beef cut still hide', () => {
      const bare = clashes('600 g wild', { diets: ['vegetarian'] })
      expect(bare).toHaveLength(1)
      expect(bare[0]?.uncertain).toBe(true)
      expect(certain(clashes('500 g wildstoof', { diets: ['vegetarian'] }))).toHaveLength(1)
      expect(certain(clashes('2 sukadelappen', { diets: ['vegetarian'] }))).toHaveLength(1)
    })
  })
})
