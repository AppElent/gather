import { screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { linkTo } from '../../lib/links'
import { Breadcrumbs, type Crumb, parentCrumb } from './Breadcrumbs'

/**
 * The local hierarchy of a nested page, and the one way back out of it.
 *
 * The sidebar and the dock answer "which Module am I in?" and cannot answer
 * "where am I inside it?" — they render above the route and never see the recipe,
 * the subject or the child the page is about. This is the piece that does, so
 * everything it is asked to prove is about the trail it was handed: that the
 * order survives, that every link in it points at its step's page, and
 * that a phone gets a real, reachable back action rather than a chevron that
 * calls `history.back()` and lands wherever the person happened to come from.
 */

/**
 * The router's `Link`, modelled rather than stubbed, the same way
 * `Sidebar.test.tsx` models it: the point of these assertions is the *href*,
 * so the params have to be substituted into the path exactly as the router
 * would substitute them.
 */
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    search,
    ...rest
  }: {
    children: React.ReactNode
    to: string
    params?: Record<string, string>
    search?: Record<string, string>
  }) => {
    const path = Object.entries(params ?? {}).reduce(
      (acc, [key, value]) => acc.replace(`$${key}`, value),
      to,
    )
    const query = new URLSearchParams(search ?? {}).toString()

    return (
      <a href={query ? `${path}?${query}` : path} {...rest}>
        {children}
      </a>
    )
  },
}))

const recipes = linkTo('recipes')
const recipe = linkTo('recipe', { recipeId: 'recipe_1' })

/** Recipes → Stamppot → Edit, the deepest trail the app has. */
const editTrail: Crumb[] = [
  { label: 'Recipes', link: recipes },
  { label: 'Stamppot', link: recipe },
  { label: 'Edit' },
]

function crumbList() {
  return within(
    screen.getByRole('navigation', { name: 'Breadcrumb' }),
  ).getByRole('list')
}

describe('the trail a nested page shows', () => {
  test('is an ordered list of every step, in route order', () => {
    renderWithI18n(<Breadcrumbs trail={editTrail} />)

    const items = within(crumbList()).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      'Recipes',
      'Stamppot',
      'Edit',
    ])
  })

  test('links every ancestor and marks the page you are on', () => {
    renderWithI18n(<Breadcrumbs trail={editTrail} />)
    const list = crumbList()

    expect(within(list).getByRole('link', { name: 'Recipes' })).toBeDefined()
    expect(within(list).getByRole('link', { name: 'Stamppot' })).toBeDefined()
    // The page you are on is not somewhere to go.
    expect(within(list).queryByRole('link', { name: 'Edit' })).toBeNull()
    expect(within(list).getByText('Edit').getAttribute('aria-current')).toBe(
      'page',
    )
  })

  test('points every step at its own page', () => {
    renderWithI18n(<Breadcrumbs trail={editTrail} />)
    const list = crumbList()

    expect(
      within(list).getByRole('link', { name: 'Recipes' }).getAttribute('href'),
    ).toBe('/recipes')
    expect(
      within(list)
        .getByRole('link', { name: 'Stamppot' })
        .getAttribute('href'),
    ).toBe('/recipes/recipe_1')
  })

  test('is nothing at all when there is no trail to draw', () => {
    const { container } = renderWithI18n(<Breadcrumbs trail={[]} />)

    expect(container.firstChild).toBeNull()
  })
})

describe('the back action a phone gets', () => {
  test('is a real link to the immediate parent, named for it', () => {
    renderWithI18n(<Breadcrumbs trail={editTrail} />)

    // Not the root: from Recipes → Stamppot → Edit, back is the recipe.
    const back = screen.getByRole('link', { name: 'Back to Stamppot' })
    expect(back.getAttribute('href')).toBe('/recipes/recipe_1')
  })

  test('meets the touch-target size the app holds itself to', () => {
    renderWithI18n(<Breadcrumbs trail={editTrail} />)

    const back = screen.getByRole('link', { name: 'Back to Stamppot' })
    expect(back.className).toContain('min-h-11')
  })

  test('falls back to the collection while the item is still loading', () => {
    // A detail page knows its Module before it knows what it is showing, and
    // that half-trail is the state somebody lands in on a slow connection.
    renderWithI18n(<Breadcrumbs trail={[{ label: 'Recipes', link: recipes }]} />)

    expect(
      screen.getByRole('link', { name: 'Back to Recipes' }).getAttribute('href'),
    ).toBe('/recipes')
  })

  test('is left out when nothing in the trail is somewhere to go', () => {
    renderWithI18n(<Breadcrumbs trail={[{ label: 'Edit' }]} />)

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeDefined()
  })
})

describe('the words around it', () => {
  test('are the reader’s, landmark and back action alike', () => {
    renderWithI18n(<Breadcrumbs trail={editTrail} />, { locale: 'nl' })

    expect(screen.getByRole('navigation', { name: 'Kruimelpad' })).toBeDefined()
    expect(
      screen.getByRole('link', { name: 'Terug naar Stamppot' }),
    ).toBeDefined()
  })
})

describe('parentCrumb', () => {
  test('is the last step that is somewhere to go', () => {
    expect(parentCrumb(editTrail)?.label).toBe('Stamppot')
  })

  test('skips a step the page could not link', () => {
    expect(
      parentCrumb([
        { label: 'Recipes', link: recipes },
        { label: 'Stamppot' },
        { label: 'Edit' },
      ])?.label,
    ).toBe('Recipes')
  })

  test('is null when there is nowhere to go back to', () => {
    expect(parentCrumb([])).toBeNull()
    expect(parentCrumb([{ label: 'Edit' }])).toBeNull()
  })
})
