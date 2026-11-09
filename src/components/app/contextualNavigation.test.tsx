import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { BabyDetailPage } from '../baby/BabyDetailPage'
import { EditBabyPage } from '../baby/EditBabyPage'
import { NewBabyPage } from '../baby/NewBabyPage'
import { EditRecipePage } from '../recipes/EditRecipePage'
import { NewRecipePage } from '../recipes/NewRecipePage'
import { RecipeDetailPage } from '../recipes/RecipeDetailPage'
import { renderInGroup } from './testing'

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
    renderInGroup(<RecipeDetailPage recipeId="recipe_1" />)

    expect(trailSteps()).toEqual(['Recipes', 'Boeuf bourguignon'])
    expect(backHref('Back to Recipes')).toBe('/recipes')
  })

  test('editing one sits under the recipe itself', () => {
    docs.value['recipes:get'] = { ...recipe, imageUrl: null }
    renderInGroup(<EditRecipePage recipeId="recipe_1" />)

    expect(trailSteps()).toEqual(['Recipes', 'Boeuf bourguignon', 'Edit'])
    expect(backHref('Back to Boeuf bourguignon')).toBe('/recipes/recipe_1')
  })

  test('adding one sits under the list it will land in', () => {
    renderInGroup(<NewRecipePage />)

    expect(trailSteps()).toEqual(['Recipes', 'New recipe'])
    expect(backHref('Back to Recipes')).toBe('/recipes')
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
    renderInGroup(<BabyDetailPage babyId="baby_1" />)

    expect(trailSteps()).toEqual(['Baby log', 'Fien'])
    expect(backHref('Back to Baby log')).toBe('/baby')
  })

  test('editing one sits under the child', () => {
    docs.value['babies:get'] = baby
    renderInGroup(<EditBabyPage babyId="baby_1" />)

    expect(trailSteps()).toEqual(['Baby log', 'Fien', 'Edit'])
    expect(backHref('Back to Fien')).toBe('/baby/baby_1')
  })

  test('adding one sits under the log, in the reader’s language', () => {
    renderInGroup(<NewBabyPage />, { locale: 'nl' })

    // The Module's name comes from the message tree keyed by its id, so a
    // Dutch reader gets a Dutch trail without the page knowing anything about
    // it (ADR-0011).
    expect(trailSteps('Kruimelpad')).toEqual([
      'Babylogboek',
      'Een kind toevoegen',
    ])
    expect(backHref('Terug naar Babylogboek')).toBe('/baby')
  })
})
