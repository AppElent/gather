import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { groupFoodNav } from './foodNav'
import { NewFoodPage } from './NewFoodPage'

/**
 * The one food editor, reached from three directions.
 *
 * Adding a food from the Foods module lands here, and so now do both of the
 * routes the add sheet grew: reviewing an Open Food Facts result before it is
 * imported (#93) and adding a food a search matched nothing for (#79). No
 * second editor was built for either — what they supply is a prefill and a way
 * back, and this is where both are answered.
 */

/** What `foodsLookup.lookupBarcode` finds on Open Food Facts. */
const offProduct = vi.hoisted(() => ({ value: null as unknown }))
/** What `foods.getByBarcode` finds locally. */
const existingFood = vi.hoisted(() => ({ value: null as unknown }))
const calls = vi.hoisted(() => ({ value: [] as Array<[string, unknown]> }))
const navigated = vi.hoisted(() => ({ value: [] as unknown[] }))

vi.mock('convex/react', () => ({
  useMutation: (name: string) => async (args: unknown) => {
    calls.value.push([name, args])
    return 'food-new'
  },
  useAction: (name: string) => async (args: unknown) => {
    if (name === 'foodsLookup:lookupBarcode') return offProduct.value
    calls.value.push([name, args])
    return 'food-new'
  },
  useConvex: () => ({ query: async () => existingFood.value }),
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    foods: {
      get: 'foods:get',
      getByBarcode: 'foods:getByBarcode',
      create: 'foods:create',
      upsertFromOff: 'foods:upsertFromOff',
    },
    foodsLookup: {
      lookupBarcode: 'foodsLookup:lookupBarcode',
      importFromOff: 'foodsLookup:importFromOff',
    },
  },
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => (link: unknown) => {
    navigated.value.push(link)
  },
  // The contextual trail above the form links out of it (#101), so this file's
  // router stub has to answer for `Link` as well as `useNavigate`.
  Link: ({
    children,
    to,
    params,
    ...rest
  }: {
    children: React.ReactNode
    to: string
    params?: Record<string, string>
  }) => (
    <a
      href={Object.entries(params ?? {}).reduce(
        (path, [key, value]) => path.replace(`$${key}`, value),
        to,
      )}
      {...rest}
    >
      {children}
    </a>
  ),
}))

const nav = groupFoodNav('jansen-household')

/** Where the add sheet for breakfast on the 18th sends somebody, and expects them back. */
const returnsToBreakfast = (foodId: string) => ({
  to: '/nutrition/add' as const,
  search: { date: '2026-07-18', meal: 'breakfast' as const, food: foodId },
})

beforeEach(() => {
  calls.value = []
  navigated.value = []
  offProduct.value = null
  existingFood.value = null
})

test('says where the form sits, and offers the way back out of it', () => {
  renderWithI18n(<NewFoodPage nav={nav} />)

  const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
  expect(trail).toBeDefined()
  // Back to the Catalog in the Group somebody is browsing, not to a `/foods`
  // that would drop them out of it (ADR-0002).
  expect(
    screen.getByRole('link', { name: 'Back to Foods' }).getAttribute('href'),
  ).toBe('/foods')
})

test('the words a search found nothing for arrive as the name', async () => {
  renderWithI18n(
    <NewFoodPage name="hagelslag" after={returnsToBreakfast} nav={nav} />,
  )

  // Prefilled, not decided: it is a starting point somebody can type over.
  expect(screen.getByLabelText('Name')).toHaveValue('hagelslag')
  // Nothing has been written by arriving here.
  expect(calls.value).toEqual([])
})

test('saving hands the person back to the meal they were adding to', async () => {
  renderWithI18n(
    <NewFoodPage name="hagelslag" after={returnsToBreakfast} nav={nav} />,
  )
  fireEvent.change(screen.getByLabelText('Calories (kcal)'), {
    target: { value: '500' },
  })
  fireEvent.click(screen.getByRole('button', { name: /save food/i }))

  await waitFor(() => expect(calls.value).toHaveLength(1))
  expect(calls.value[0][0]).toBe('foods:create')
  // Back to breakfast on the same day, carrying the food that now exists —
  // not to the Catalog, and not to the diary in general.
  await waitFor(() => expect(navigated.value).toHaveLength(1))
  expect(navigated.value[0]).toEqual(returnsToBreakfast('food-new'))
})

test('with nowhere to go back to, a new food still lands on its own page', async () => {
  // The Foods module's own "add manually", unchanged by any of this.
  renderWithI18n(<NewFoodPage nav={nav} />)
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Hagelslag' },
  })
  fireEvent.click(screen.getByRole('button', { name: /save food/i }))

  await waitFor(() => expect(navigated.value).toHaveLength(1))
  expect(navigated.value[0]).toEqual(nav.detail('food-new'))
})

test('an Open Food Facts import is written only by the save, picture and all', async () => {
  offProduct.value = {
    name: 'Nutella',
    brand: 'Ferrero',
    nutritionPer100: { calories: 539 },
    servings: [],
    imageUrl: 'https://images.openfoodfacts.org/images/products/front.jpg',
  }
  renderWithI18n(
    <NewFoodPage
      barcode="3017620422003"
      after={returnsToBreakfast}
      nav={nav}
    />,
  )

  await waitFor(() => expect(screen.getByDisplayValue('Nutella')).toBeDefined())
  expect(screen.getByText(/From Open Food Facts/)).toBeDefined()
  expect(screen.getByText('Barcode: 3017620422003')).toBeDefined()
  // Looking at it is not importing it: leaving now leaves nothing behind, and
  // the picture is still only a URL somewhere else.
  expect(calls.value).toEqual([])

  fireEvent.click(screen.getByRole('button', { name: /save food/i }))

  await waitFor(() => expect(calls.value).toHaveLength(1))
  // The action rather than the mutation, because the action is what fetches
  // and stores the picture (#69) — which is how it still arrives with the food
  // even though nothing was fetched until now.
  expect(calls.value[0][0]).toBe('foodsLookup:importFromOff')
  expect(calls.value[0][1]).toMatchObject({
    barcode: '3017620422003',
    name: 'Nutella',
    brand: 'Ferrero',
    nutritionPer100: { calories: 539 },
    nutritionSource: 'imported',
    imageUrl: 'https://images.openfoodfacts.org/images/products/front.jpg',
  })
  expect(navigated.value[0]).toEqual(returnsToBreakfast('food-new'))
})

test('a correction made while reviewing is what the import records', async () => {
  offProduct.value = {
    name: 'Nutella',
    nutritionPer100: { calories: 539 },
    servings: [],
  }
  renderWithI18n(<NewFoodPage barcode="3017620422003" nav={nav} />)
  await waitFor(() => expect(screen.getByDisplayValue('Nutella')).toBeDefined())

  fireEvent.change(screen.getByLabelText('Calories (kcal)'), {
    target: { value: '530' },
  })
  fireEvent.click(screen.getByRole('button', { name: /save food/i }))

  await waitFor(() => expect(calls.value).toHaveLength(1))
  expect(calls.value[0][1]).toMatchObject({
    nutritionPer100: { calories: 530 },
    // The figures are the person's now, and the food must not go on saying
    // they came off a packet.
    nutritionSource: 'manual',
  })
})

test('a scanned barcode you already have skips the review it has nothing to review', async () => {
  existingFood.value = { _id: 'food9', name: 'Volle melk' }
  renderWithI18n(
    <NewFoodPage
      barcode="8712345678901"
      after={returnsToBreakfast}
      nav={nav}
    />,
  )

  await waitFor(() => expect(navigated.value).toHaveLength(1))
  // Straight back to the meal with that food ready to log — not the food's
  // page, which is not where somebody logging breakfast was going.
  expect(navigated.value[0]).toMatchObject({
    ...returnsToBreakfast('food9'),
    replace: true,
  })
  expect(calls.value).toEqual([])
})
