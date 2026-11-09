import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { ConvexError } from 'convex/values'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderInGroup } from '../app/testing'
import { RecipeDetailPage } from './RecipeDetailPage'

/**
 * Deleting a recipe asks first.
 *
 * The button used to delete on click, so a stray tap took somebody's recipe
 * with it. It now asks in the app's own dialog, and a refusal is shown there
 * rather than swallowed.
 */

const removeResult = vi.hoisted(() => ({ error: null as unknown }))
const calls = vi.hoisted(() => ({ value: [] as Array<[string, unknown]> }))
const navigated = vi.hoisted(() => ({ value: [] as unknown[] }))

const RECIPE = {
  _id: 'rec_1',
  title: 'Stamppot',
  canEdit: true,
  ingredients: ['Potatoes'],
  steps: ['Mash'],
  imageUrl: null,
  sharedGroups: [],
}

vi.mock('convex/react', () => ({
  useQuery: (name: string) => (name === 'recipes:get' ? RECIPE : undefined),
  useMutation: (name: string) => async (args: unknown) => {
    calls.value.push([name, args])
    if (name === 'recipes:remove' && removeResult.error) throw removeResult.error
  },
  useAction: () => async () => undefined,
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    recipes: {
      get: 'recipes:get',
      remove: 'recipes:remove',
      aiConfigured: 'recipes:aiConfigured',
      setNutrition: 'recipes:setNutrition',
    },
    recipeNutrition: { estimateNutrition: 'recipeNutrition:estimate' },
  },
}))

// Sharing has its own queries and its own tests.
vi.mock('./RecipeSharingPanel', () => ({ RecipeSharingPanel: () => null }))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => async (link: unknown) => {
    navigated.value.push(link)
  },
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => {
    const { params: _params, ...anchor } = rest as Record<string, unknown>
    return (
      <a href={to} {...anchor}>
        {children}
      </a>
    )
  },
}))

beforeEach(() => {
  removeResult.error = null
  calls.value = []
  navigated.value = []
})

function openDelete() {
  renderInGroup(<RecipeDetailPage recipeId="rec_1" />)
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  return screen.getByRole('dialog')
}

const removed = () => calls.value.filter(([name]) => name === 'recipes:remove')

describe('deleting a recipe', () => {
  test('asks first, naming the recipe, and deletes nothing yet', () => {
    const dialog = openDelete()

    expect(dialog.textContent).toContain('Stamppot')
    expect(removed()).toEqual([])
  })

  test('cancelling keeps the recipe', () => {
    openDelete()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(removed()).toEqual([])
  })

  test('confirming deletes it and goes back to Recipes', async () => {
    const dialog = openDelete()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(removed()).toEqual([['recipes:remove', { id: 'rec_1' }]])
    expect(navigated.value).toEqual([
      expect.objectContaining({ to: '/recipes' }),
    ])
  })

  test('a refusal stays on the dialog, in words', async () => {
    removeResult.error = new ConvexError('Recipe not found')
    const dialog = openDelete()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      'Recipe not found',
    )
    expect(navigated.value).toEqual([])
  })
})
