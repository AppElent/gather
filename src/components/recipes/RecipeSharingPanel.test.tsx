import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Id } from '../../../convex/_generated/dataModel'
import { renderWithI18n } from '../../lib/i18n/testing'
import { RecipeSharingPanel } from './RecipeSharingPanel'

/**
 * The control that answers "who can see this recipe?" and offers to change it.
 *
 * The rules it has to encode are the server's, so that a household never meets
 * a button that can only fail: a recipe cannot be moved or shared into a Group
 * you are not a Member of, and cannot be shared with the Group it already lives
 * in or with one it is already shared with. The server refuses all three
 * anyway — these tests are about not offering them.
 */

const myGroups = vi.hoisted(() => ({ value: [] as unknown }))
const calls = vi.hoisted(() => ({
  value: {} as Record<string, unknown[]>,
}))
const navigations = vi.hoisted(() => ({ value: [] as unknown[] }))

vi.mock('convex/react', () => ({
  useQuery: () => myGroups.value,
  useMutation: (name: string) => async (args: unknown) => {
    calls.value[name] = [...(calls.value[name] ?? []), args]
  },
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    groups: { myGroups: 'groups:myGroups' },
    recipes: {
      move: 'recipes:move',
      share: 'recipes:share',
      unshare: 'recipes:unshare',
    },
  },
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => async (options: unknown) => {
    navigations.value = [...navigations.value, options]
  },
}))

const RECIPE_ID = 'recipe_1' as Id<'recipes'>

const HOUSEHOLD = {
  _id: 'g_household',
  name: 'Household',
  slug: 'household',
  isPersonal: false,
}
const CLUB = {
  _id: 'g_club',
  name: 'Cooking club',
  slug: 'cooking-club',
  isPersonal: false,
}
const ALLOTMENT = {
  _id: 'g_allotment',
  name: 'Allotment',
  slug: 'allotment',
  isPersonal: false,
}

beforeEach(() => {
  myGroups.value = [HOUSEHOLD, CLUB, ALLOTMENT]
  calls.value = {}
  navigations.value = []
})

function renderPanel(
  sharedGroups: Array<{ _id: Id<'groups'>; name: string; slug: string }> = [],
) {
  renderWithI18n(
    <RecipeSharingPanel
      recipeId={RECIPE_ID}
      homeGroupName="Household"
      homeGroupSlug="household"
      sharedGroups={sharedGroups}
    />,
  )
}

const club = {
  _id: 'g_club' as Id<'groups'>,
  name: 'Cooking club',
  slug: 'cooking-club',
}

function optionsOf(label: RegExp) {
  const options = screen.getByLabelText(label).querySelectorAll('option')
  return [...options].map((o) => o.textContent)
}

describe('what the panel says', () => {
  test('names the Group the recipe lives in', () => {
    renderPanel()
    expect(screen.getByText(/lives in/i).textContent).toContain('Household')
  })

  test('says plainly when it is shared with nobody', () => {
    renderPanel()
    expect(screen.getByText(/not shared with any other group/i)).toBeDefined()
  })

  test('names every Group it is shared with', () => {
    renderPanel([club])
    expect(screen.getByText(/shared with cooking club/i)).toBeDefined()
  })
})

describe('what the panel offers', () => {
  test('the home Group is not somewhere to move to', () => {
    renderPanel()
    expect(optionsOf(/move to/i)).toEqual([
      'Choose a group…',
      'Cooking club',
      'Allotment',
    ])
  })

  test('a Group it is already shared with is not somewhere to share to', () => {
    renderPanel([club])
    expect(optionsOf(/share with/i)).toEqual(['Choose a group…', 'Allotment'])
    // It is still somewhere it could be moved: moving there would make it home.
    expect(optionsOf(/move to/i)).toContain('Cooking club')
  })

  test('someone in one Group is told why there is nothing to choose', () => {
    myGroups.value = [HOUSEHOLD]
    renderPanel()
    expect(screen.queryByLabelText(/move to/i)).toBeNull()
    expect(screen.getByText(/only in one group/i)).toBeDefined()
  })
})

describe('what the panel does', () => {
  test('a move goes to the chosen Group, and the page follows the recipe', async () => {
    renderPanel()

    fireEvent.change(screen.getByLabelText(/move to/i), {
      target: { value: 'cooking-club' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^move$/i }))

    await waitFor(() => {
      expect(calls.value['recipes:move']).toEqual([
        { id: RECIPE_ID, toGroupSlug: 'cooking-club' },
      ])
    })
    // The address this page was opened at is inside the Group the recipe has
    // just left, and no longer resolves to it.
    await waitFor(() => {
      expect(navigations.value).toEqual([
        {
          to: '/recipes/$recipeId',
          params: { recipeId: RECIPE_ID },
        },
      ])
    })
  })

  test('a share names the chosen Group and leaves the page where it is', async () => {
    renderPanel()

    fireEvent.change(screen.getByLabelText(/share with/i), {
      target: { value: 'allotment' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^share$/i }))

    await waitFor(() => {
      expect(calls.value['recipes:share']).toEqual([
        { id: RECIPE_ID, withGroupSlug: 'allotment' },
      ])
    })
    expect(navigations.value).toEqual([])
  })

  test('an unshare names the Group whose row it sits on', async () => {
    renderPanel([club])

    fireEvent.click(screen.getByRole('button', { name: /unshare/i }))

    await waitFor(() => {
      expect(calls.value['recipes:unshare']).toEqual([
        { id: RECIPE_ID, withGroupSlug: 'cooking-club' },
      ])
    })
  })

  test('nothing is sent until a Group has been chosen', () => {
    renderPanel()
    const moveButton = screen.getByRole('button', { name: /^move$/i })
    expect(moveButton.hasAttribute('disabled')).toBe(true)
    fireEvent.click(moveButton)
    expect(calls.value['recipes:move']).toBeUndefined()
  })
})
