import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { BabyDetailPage } from '../baby/BabyDetailPage'
import { groupBabyNav } from '../baby/babyNav'
import { EditBabyPage } from '../baby/EditBabyPage'
import { NewBabyPage } from '../baby/NewBabyPage'
import { EditFoodPage } from '../foods/EditFoodPage'
import { FoodDetailPage } from '../foods/FoodDetailPage'
import { groupFoodNav } from '../foods/foodNav'
import { EditRecipePage } from '../recipes/EditRecipePage'
import { NewRecipePage } from '../recipes/NewRecipePage'
import { RecipeDetailPage } from '../recipes/RecipeDetailPage'
import { groupRecipeNav } from '../recipes/recipeNav'

/**
 * Every nested page says where it sits and how to get out (#101).
 *
 * The shared trail is proved in `Breadcrumbs.test.tsx`; what is proved here is
 * that each page hands it the right hierarchy — the collection it belongs to,
 * the thing it is about, and the Group all of that lives in. A component with
 * nobody rendering it is the failure mode this file exists to catch, so these
 * render the real pages rather than the trail on its own.
 */

/** What each Convex function answers with, per test. */
const docs = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))

vi.mock('convex/react', () => ({
  useQuery: (name: string, args: unknown) =>
    args === 'skip' ? undefined : docs.value[name],
  useMutation: () => async () => undefined,
  useAction: () => async () => undefined,
  useConvex: () => ({ query: async () => null }),
}))

/** Every `api.x.y` is the string `'x:y'`, which is what the mock above keys on. */
vi.mock('../../../convex/_generated/api', () => ({
  api: new Proxy(
    {},
    {
      get: (_target, namespace) =>
        new Proxy(
          {},
          { get: (_t, fn) => `${String(namespace)}:${String(fn)}` },
        ),
    },
  ),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => () => undefined,
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

const GROUP = 'jansen-household'
const foodNav = groupFoodNav(GROUP)
const recipeNav = groupRecipeNav(GROUP)
const babyNav = groupBabyNav(GROUP)

/** The steps the trail draws, in order, as a reader would read them. */
function trailSteps(landmark = 'Breadcrumb') {
  const list = within(
    screen.getByRole('navigation', { name: landmark }),
  ).getByRole('list')
  return within(list)
    .getAllByRole('listitem')
    .map((item) => item.textContent)
}

/** Where the phone's back action goes. */
function backHref(name: string) {
  return screen.getByRole('link', { name }).getAttribute('href')
}

beforeEach(() => {
  docs.value = {}
})

describe('Foods', () => {
  test('a food sits under the collection it came from', () => {
    docs.value['foods:get'] = {
      _id: 'food_1',
      name: 'Hagelslag',
      baseUnit: 'g',
      nutritionPer100: { calories: 500 },
      seedKey: undefined,
    }
    renderWithI18n(<FoodDetailPage foodId="food_1" nav={foodNav} />)

    expect(trailSteps()).toEqual(['Foods', 'Hagelslag'])
    expect(backHref('Back to Foods')).toBe('/g/jansen-household/foods')
  })

  test('editing one sits under the food itself', () => {
    docs.value['foods:get'] = {
      _id: 'food_1',
      name: 'Hagelslag',
      baseUnit: 'g',
      nutritionPer100: { calories: 500 },
      seedKey: undefined,
    }
    renderWithI18n(<EditFoodPage foodId="food_1" nav={foodNav} />)

    expect(trailSteps()).toEqual(['Foods', 'Hagelslag', 'Edit'])
    // One step up, not all the way out — and still in this Group.
    expect(backHref('Back to Hagelslag')).toBe(
      '/g/jansen-household/foods/food_1',
    )
  })

  test('a food that is not there still has a way out', () => {
    docs.value['foods:get'] = null
    renderWithI18n(<FoodDetailPage foodId="food_1" nav={foodNav} />)

    expect(backHref('Back to Foods')).toBe('/g/jansen-household/foods')
  })
})

describe('Recipes', () => {
  const recipe = {
    _id: 'recipe_1',
    title: 'Boeuf bourguignon',
    ingredients: ['beef'],
    steps: ['cook'],
    tags: [],
    canEdit: false,
  }

  test('a recipe sits under its Group’s list', () => {
    docs.value['recipes:get'] = recipe
    renderWithI18n(
      <RecipeDetailPage
        recipeId="recipe_1"
        groupSlug={GROUP}
        nav={recipeNav}
      />,
    )

    expect(trailSteps()).toEqual(['Recipes', 'Boeuf bourguignon'])
    expect(backHref('Back to Recipes')).toBe('/g/jansen-household/recipes')
  })

  test('editing one sits under the recipe itself', () => {
    docs.value['recipes:get'] = { ...recipe, imageUrl: null }
    renderWithI18n(
      <EditRecipePage recipeId="recipe_1" groupSlug={GROUP} nav={recipeNav} />,
    )

    expect(trailSteps()).toEqual(['Recipes', 'Boeuf bourguignon', 'Edit'])
    expect(backHref('Back to Boeuf bourguignon')).toBe(
      '/g/jansen-household/recipes/recipe_1',
    )
  })

  test('adding one sits under the list it will land in', () => {
    renderWithI18n(
      <NewRecipePage
        destination={{
          groupSlug: GROUP,
          groupName: 'Jansen household',
          fallback: false,
        }}
        nav={recipeNav}
      />,
    )

    expect(trailSteps()).toEqual(['Recipes', 'New recipe'])
    expect(backHref('Back to Recipes')).toBe('/g/jansen-household/recipes')
  })
})

describe('Baby log', () => {
  const baby = {
    _id: 'baby_1',
    name: 'Fien',
    birthDate: '2026-01-05',
    photoUrl: null,
  }

  test('a child sits under the household’s log', () => {
    docs.value['babies:get'] = baby
    docs.value['babies:list'] = [baby]
    docs.value['babyEvents:listByBaby'] = []
    renderWithI18n(
      <BabyDetailPage babyId="baby_1" groupSlug={GROUP} nav={babyNav} />,
    )

    expect(trailSteps()).toEqual(['Baby log', 'Fien'])
    expect(backHref('Back to Baby log')).toBe('/g/jansen-household/baby')
  })

  test('editing one sits under the child', () => {
    docs.value['babies:get'] = baby
    renderWithI18n(
      <EditBabyPage babyId="baby_1" groupSlug={GROUP} nav={babyNav} />,
    )

    expect(trailSteps()).toEqual(['Baby log', 'Fien', 'Edit'])
    expect(backHref('Back to Fien')).toBe('/g/jansen-household/baby/baby_1')
  })

  test('adding one sits under the log, in the reader’s language', () => {
    renderWithI18n(<NewBabyPage groupSlug={GROUP} nav={babyNav} />, {
      locale: 'nl',
    })

    // The Module's name comes from the message tree keyed by its id, so a
    // Dutch reader gets a Dutch trail without the page knowing anything about
    // it (ADR-0011).
    expect(trailSteps('Kruimelpad')).toEqual([
      'Babylogboek',
      'Een kind toevoegen',
    ])
    expect(backHref('Terug naar Babylogboek')).toBe('/g/jansen-household/baby')
  })
})
