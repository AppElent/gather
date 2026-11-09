import { fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderInGroup } from '../app/testing'
import { RecipesPage } from './RecipesPage'

/**
 * The recipe list narrows what it already loaded: a title search and a tag
 * pick, together, without asking the server again.
 */

const loaded = vi.hoisted(() => ({ value: undefined as unknown }))
const queried = vi.hoisted(() => ({ value: [] as unknown[] }))

const RECIPES = [
  { _id: 'r1', title: 'Stamppot', tags: ['winter'], imageUrl: null },
  { _id: 'r2', title: 'Pea soup', tags: ['winter', 'soup'], imageUrl: null },
  { _id: 'r3', title: 'Gazpacho', tags: ['soup'], imageUrl: null },
]

vi.mock('convex/react', () => ({
  useQuery: (_name: string, args: unknown) => {
    queried.value.push(args)
    return loaded.value
  },
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: { recipes: { list: 'recipes:list' } },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...rest
  }: {
    children: React.ReactNode
    to: string
    params?: { recipeId?: string }
  }) => (
    <a href={params?.recipeId ? `/recipes/${params.recipeId}` : to} {...rest}>
      {children}
    </a>
  ),
}))

beforeEach(() => {
  loaded.value = RECIPES
  queried.value = []
  window.localStorage.clear()
})

/** The title on each recipe card, in the order the list shows them. */
const shownTitles = () =>
  screen
    .queryAllByRole('link')
    .filter((link) => link.getAttribute('href')?.startsWith('/recipes/r'))
    .map((link) => link.querySelector('p')?.textContent)

const search = () => screen.getByRole('searchbox', { name: 'Search recipes' })
const tagPicker = () => screen.getByRole('combobox', { name: 'Filter by tag' })

describe('RecipesPage filtering', () => {
  test('shows the whole collection with no filter', () => {
    renderInGroup(<RecipesPage />)
    expect(shownTitles()).toEqual(['Stamppot', 'Pea soup', 'Gazpacho'])
  })

  test('the search narrows by title, case-insensitively, and clears', () => {
    renderInGroup(<RecipesPage />)
    fireEvent.change(search(), { target: { value: 'SOUP' } })
    expect(shownTitles()).toEqual(['Pea soup'])

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(search()).toHaveValue('')
    expect(shownTitles()).toEqual(['Stamppot', 'Pea soup', 'Gazpacho'])
  })

  test('the tag picker offers the loaded tags and narrows by one', () => {
    renderInGroup(<RecipesPage />)
    const options = within(tagPicker())
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(options).toEqual(['All tags', 'soup', 'winter'])

    fireEvent.change(tagPicker(), { target: { value: 'soup' } })
    expect(shownTitles()).toEqual(['Pea soup', 'Gazpacho'])

    fireEvent.change(tagPicker(), { target: { value: '' } })
    expect(shownTitles()).toEqual(['Stamppot', 'Pea soup', 'Gazpacho'])
  })

  test('search and tag compose, down to an empty result that clears', () => {
    renderInGroup(<RecipesPage />)
    fireEvent.change(tagPicker(), { target: { value: 'winter' } })
    fireEvent.change(search(), { target: { value: 'pea' } })
    expect(shownTitles()).toEqual(['Pea soup'])

    fireEvent.change(search(), { target: { value: 'gazpacho' } })
    expect(
      screen.getByRole('heading', { name: 'Nothing found' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('No recipe tagged "winter" matches "gazpacho".'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(search()).toHaveValue('')
    expect(tagPicker()).toHaveValue('')
    expect(shownTitles()).toEqual(['Stamppot', 'Pea soup', 'Gazpacho'])
  })

  test('cards still link to their recipe', () => {
    renderInGroup(<RecipesPage />)
    fireEvent.change(search(), { target: { value: 'gaz' } })
    expect(
      screen.getByRole('link', { name: /Gazpacho/ }),
    ).toHaveAttribute('href', '/recipes/r3')
  })

  test('filtering never changes the Group-scoped query', () => {
    renderInGroup(<RecipesPage />)
    fireEvent.change(search(), { target: { value: 'soup' } })
    fireEvent.change(tagPicker(), { target: { value: 'soup' } })
    expect(new Set(queried.value.map((args) => JSON.stringify(args)))).toEqual(
      new Set([JSON.stringify({ groupSlug: 'jansen-household' })]),
    )
  })

  test('a picked tag that leaves the collection is dropped, not revived', () => {
    const { rerender } = renderInGroup(<RecipesPage />)
    fireEvent.change(tagPicker(), { target: { value: 'soup' } })
    expect(shownTitles()).toEqual(['Pea soup', 'Gazpacho'])

    loaded.value = [RECIPES[0]]
    rerender(<RecipesPage />)
    expect(shownTitles()).toEqual(['Stamppot'])

    loaded.value = RECIPES
    rerender(<RecipesPage />)
    expect(tagPicker()).toHaveValue('')
    expect(shownTitles()).toEqual(['Stamppot', 'Pea soup', 'Gazpacho'])
  })

  test('without tags there is no tag picker', () => {
    loaded.value = [{ _id: 'r9', title: 'Pancakes', tags: [], imageUrl: null }]
    renderInGroup(<RecipesPage />)
    expect(search()).toBeInTheDocument()
    expect(
      screen.queryByRole('combobox', { name: 'Filter by tag' }),
    ).not.toBeInTheDocument()
  })

  test('loading and an empty collection show no filter controls', () => {
    loaded.value = undefined
    const { unmount } = renderInGroup(<RecipesPage />)
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    unmount()

    loaded.value = []
    renderInGroup(<RecipesPage />)
    expect(
      screen.getByRole('heading', { name: 'No recipes yet' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })

  test('the controls are translated', () => {
    renderInGroup(<RecipesPage />, { locale: 'nl' })
    expect(
      screen.getByRole('searchbox', { name: 'Recepten zoeken' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: 'Filteren op label' }),
    ).toBeInTheDocument()
  })
})
