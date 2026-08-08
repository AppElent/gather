import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { AddSheet } from './AddSheet'
import { groupNutritionNav } from './nutritionNav'

/**
 * The add sheet's one rule: every row is a card, every card expands in place,
 * and nothing reaches the diary until the confirm inside it.
 *
 * Dragging is deliberately absent. Detent snapping, flicks and the
 * tap-versus-drag threshold would mean synthesising pointer sequences and
 * asserting on transforms in a DOM that does not lay out — testing the
 * simulation rather than the sheet. The arithmetic behind them is pure and
 * tested in `sheetDetents.test.ts`; the feel is checked by hand on a phone,
 * which is how it was chosen in the first place.
 */

const foods = vi.hoisted(() => ({
  value: [
    {
      _id: 'food1',
      name: 'Halfvolle melk',
      brand: 'Campina',
      baseUnit: 'ml' as const,
      nutritionPer100: { calories: 46, protein: 3.5 },
    },
    {
      _id: 'food2',
      name: 'Volkorenbrood',
      brand: 'Bakkerij',
      baseUnit: 'g' as const,
      nutritionPer100: { calories: 250 },
      servings: [
        { label: '1 slice', amount: 35 },
        { label: '2 slices', amount: 70 },
      ],
    },
  ],
}))
/** The Combos this person has saved. */
const combos = vi.hoisted(() => ({ value: [] as unknown[] }))
/** What this person has logged for a food before — their own amounts. */
const loggedAmounts = vi.hoisted(() => ({
  value: [] as Array<{ label: string; amount: number }>,
}))
const recipes = vi.hoisted(() => ({
  value: [
    { _id: 'recipe1', title: 'Melkbroodjes', nutrition: { calories: 240 } },
    { _id: 'recipe2', title: 'Chili', nutrition: undefined },
  ],
}))
const offResults = vi.hoisted(() => ({
  value: [
    {
      barcode: '8712345678901',
      name: 'Volle melk',
      brand: 'Zaanse Hoeve',
      nutritionPer100: { calories: 64 },
    },
  ],
}))
/** What `foods.getByBarcode` finds, for the "this is already in your library" path. */
const existingFood = vi.hoisted(() => ({ value: null as unknown }))
const calls = vi.hoisted(() => ({ value: [] as Array<[string, unknown]> }))

vi.mock('convex/react', () => ({
  useQuery: (name: string, args: { term?: string } | 'skip') => {
    if (args !== 'skip' && name === 'foods:search') {
      const term = (args.term ?? '').trim().toLowerCase()
      if (!term) return []
      return foods.value.filter((f) =>
        `${f.name} ${f.brand}`.toLowerCase().includes(term),
      )
    }
    if (name === 'recipes:listAcrossMyGroups') return recipes.value
    if (name === 'combos:list') return combos.value
    if (name === 'consumption:loggedAmountsForFood') {
      return args === 'skip' ? undefined : loggedAmounts.value
    }
    return undefined
  },
  useMutation: (name: string) => async (args: unknown) => {
    calls.value.push([name, args])
    return 'entry1'
  },
  useAction: (name: string) => async (args: { term?: string }) => {
    if (name !== 'foodsLookup:searchByName') return null
    const term = (args.term ?? '').toLowerCase()
    return offResults.value.filter((r) => r.name.toLowerCase().includes(term))
  },
  useConvex: () => ({ query: async () => existingFood.value }),
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    foods: {
      search: 'foods:search',
      get: 'foods:get',
      getByBarcode: 'foods:getByBarcode',
      upsertFromOff: 'foods:upsertFromOff',
    },
    foodsLookup: {
      searchByName: 'foodsLookup:searchByName',
      lookupBarcode: 'foodsLookup:lookupBarcode',
    },
    recipes: { listAcrossMyGroups: 'recipes:listAcrossMyGroups' },
    combos: { list: 'combos:list', replaceItems: 'combos:replaceItems' },
    consumption: {
      create: 'consumption:create',
      createMany: 'consumption:createMany',
      remove: 'consumption:remove',
      loggedAmountsForFood: 'consumption:loggedAmountsForFood',
    },
  },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),
}))

const nav = groupNutritionNav('jansen-household')

function renderSheet(onClose = vi.fn()) {
  renderWithI18n(
    <AddSheet date="2026-07-18" meal="breakfast" nav={nav} onClose={onClose} />,
  )
  return onClose
}

async function search(term: string) {
  fireEvent.change(screen.getByLabelText('Search foods and recipes…'), {
    target: { value: term },
  })
}

beforeEach(() => {
  calls.value = []
  loggedAmounts.value = []
  combos.value = []
  existingFood.value = null
})

test('an Open Food Facts result already in your library logs that food’s own figures', async () => {
  // Somebody corrected this row by hand after importing it; the entry has to
  // snapshot the food it references, not the search result it was picked from.
  existingFood.value = {
    _id: 'food9',
    name: 'Volle melk',
    baseUnit: 'ml',
    nutritionPer100: { calories: 100 },
  }
  renderSheet()
  await search('volle melk')
  await waitFor(() => expect(screen.getByText('Volle melk')).toBeDefined())
  fireEvent.click(screen.getByText('Volle melk'))
  fireEvent.change(screen.getByLabelText('Amount'), {
    target: { value: '200' },
  })
  fireEvent.click(screen.getByText('Add to diary'))

  await waitFor(() => expect(calls.value).toHaveLength(1))
  expect(calls.value[0][1]).toMatchObject({
    foodId: 'food9',
    quantity: 200,
    quantityUnit: 'ml',
    // 200 ml of the *food's* 100 kcal/100 ml, not the result's 64.
    nutrition: { calories: 200 },
  })
})

test('the search field offers a clear only while there is something to clear', async () => {
  renderSheet()
  expect(screen.queryByLabelText('Clear search')).toBeNull()

  await search('melk')
  await waitFor(() => expect(screen.getByText('Halfvolle melk')).toBeDefined())

  fireEvent.click(screen.getByLabelText('Clear search'))

  const field = screen.getByLabelText('Search foods and recipes…')
  expect(field).toHaveValue('')
  // Back where you left it, ready for the next thing you type.
  expect(document.activeElement).toBe(field)
  expect(screen.queryByLabelText('Clear search')).toBeNull()
  // And the empty-search state is what is on screen again: the matches for the
  // term are gone, the always-there sections are back.
  await waitFor(() => expect(screen.queryByText('Halfvolle melk')).toBeNull())
  expect(screen.getByText('Melkbroodjes')).toBeDefined()
})

test('one search fills labelled sections with foods, recipes and Open Food Facts', async () => {
  renderSheet()
  await search('melk')

  await waitFor(() => expect(screen.getByText('Your foods')).toBeDefined())
  expect(screen.getByText('Halfvolle melk')).toBeDefined()
  expect(screen.getByText('Recipes')).toBeDefined()
  expect(screen.getByText('Melkbroodjes')).toBeDefined()
  await waitFor(() => expect(screen.getByText('Open Food Facts')).toBeDefined())
  expect(screen.getByText('Volle melk')).toBeDefined()
})

test('a recipe with no nutrition is not offered as something to log', async () => {
  renderSheet()
  await search('chili')
  await waitFor(() => expect(screen.queryByText('Chili')).toBeNull())
})

test('a card expands in place to show what would be logged', async () => {
  renderSheet()
  await search('melk')
  await waitFor(() => expect(screen.getByText('Halfvolle melk')).toBeDefined())

  expect(screen.queryByLabelText('Amount')).toBeNull()
  fireEvent.click(screen.getByText('Halfvolle melk'))

  expect(screen.getAllByLabelText('Amount')[0]).toHaveValue('100')
  // The breakdown is for the amount chosen, not per 100 by coincidence.
  expect(screen.getByText('46')).toBeDefined()
  expect(screen.getByText('Add to diary')).toBeDefined()
})

test('nothing is written until the confirm inside the card', async () => {
  const onClose = renderSheet()
  await search('melk')
  await waitFor(() => expect(screen.getByText('Halfvolle melk')).toBeDefined())
  fireEvent.click(screen.getByText('Halfvolle melk'))
  expect(calls.value).toEqual([])

  fireEvent.click(screen.getByText('Add to diary'))

  await waitFor(() => expect(calls.value).toHaveLength(1))
  expect(calls.value[0]).toEqual([
    'consumption:create',
    {
      date: '2026-07-18',
      meal: 'breakfast',
      foodId: 'food1',
      label: 'Halfvolle melk',
      quantity: 100,
      quantityUnit: 'ml',
      nutrition: { calories: 46, protein: 3.5 },
    },
  ])
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

test('an amount that is not a positive number cannot be confirmed, and says why', async () => {
  renderSheet()
  await search('melk')
  await waitFor(() => expect(screen.getByText('Halfvolle melk')).toBeDefined())
  fireEvent.click(screen.getByText('Halfvolle melk'))

  fireEvent.change(screen.getAllByLabelText('Amount')[0], {
    target: { value: '0' },
  })

  expect(screen.getByText('Add to diary')).toBeDisabled()
  expect(screen.getByText('Enter an amount above 0')).toBeDefined()
})

test('a search matching nothing offers the typed term as a one-off', async () => {
  renderSheet()
  await search('poffertjes at the fair')

  await waitFor(() =>
    expect(
      screen.getByText('Nothing found for “poffertjes at the fair”'),
    ).toBeDefined(),
  )
  fireEvent.click(screen.getByText('Log “poffertjes at the fair” as a one-off'))
  fireEvent.change(screen.getByLabelText('Calories (kcal)'), {
    target: { value: '400' },
  })
  fireEvent.click(screen.getByText('Add to diary'))

  await waitFor(() => expect(calls.value).toHaveLength(1))
  expect(calls.value[0][1]).toMatchObject({
    label: 'poffertjes at the fair',
    quantity: 1,
    quantityUnit: 'piece',
    nutrition: { calories: 400 },
  })
})

test('a food’s named servings are the way an amount is chosen', async () => {
  renderSheet()
  await search('volkoren')
  await waitFor(() => expect(screen.getByText('Volkorenbrood')).toBeDefined())
  fireEvent.click(screen.getByText('Volkorenbrood'))

  // The first serving is chosen for you, so an open card always shows what it
  // would log — 35 g of bread at 250 kcal/100 g.
  expect(screen.getByRole('button', { name: '1 slice' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(screen.getByText('87.5')).toBeDefined()

  fireEvent.click(screen.getByRole('button', { name: '2 slices' }))
  expect(screen.getByText('175')).toBeDefined()

  fireEvent.click(screen.getByText('Add to diary'))
  await waitFor(() => expect(calls.value).toHaveLength(1))
  expect(calls.value[0][1]).toMatchObject({
    foodId: 'food2',
    quantity: 70,
    quantityUnit: 'g',
    nutrition: { calories: 175 },
  })
})

test('Custom takes an amount in grams or in the food’s own serving', async () => {
  renderSheet()
  await search('volkoren')
  await waitFor(() => expect(screen.getByText('Volkorenbrood')).toBeDefined())
  fireEvent.click(screen.getByText('Volkorenbrood'))

  fireEvent.click(screen.getByRole('button', { name: 'Custom' }))
  fireEvent.change(screen.getByLabelText('Amount'), {
    target: { value: '1,5' },
  })
  fireEvent.change(screen.getByLabelText('Unit'), {
    target: { value: 'serving' },
  })

  // 1.5 slices of 35 g, without anybody having to know what a slice weighs.
  expect(screen.getByText('131.25')).toBeDefined()
})

test('an amount that is not a positive number keeps the confirm disabled', async () => {
  renderSheet()
  await search('volkoren')
  await waitFor(() => expect(screen.getByText('Volkorenbrood')).toBeDefined())
  fireEvent.click(screen.getByText('Volkorenbrood'))
  fireEvent.click(screen.getByRole('button', { name: 'Custom' }))

  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '0' } })

  expect(screen.getByText('Add to diary')).toBeDisabled()
  expect(screen.getByText('Enter an amount above 0')).toBeDefined()
})

test('amounts you have logged before are offered as your own', async () => {
  loggedAmounts.value = [{ label: '120 g', amount: 120 }]
  renderSheet()
  await search('volkoren')
  await waitFor(() => expect(screen.getByText('Volkorenbrood')).toBeDefined())
  fireEvent.click(screen.getByText('Volkorenbrood'))

  await waitFor(() =>
    expect(screen.getByRole('button', { name: '120 g (yours)' })).toBeDefined(),
  )
})
