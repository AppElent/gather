import { act, fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { AllModulesPage } from './AllModulesPage'
import { renderInGroup } from './testing'

/**
 * The All page's pins move one place at a time, and a screen reader hears
 * where each one went (APP-572): the arrow keeps focus, so nothing else
 * would tell it.
 */

const pins = vi.hoisted(() => ({
  value: undefined as string[] | undefined,
  saves: [] as unknown[],
}))

vi.mock('convex/react', () => ({
  useQuery: () => pins.value,
  useMutation: () => (args: unknown) => {
    pins.saves.push(args)
    return Promise.resolve()
  },
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: { users: { myPins: 'users:myPins', setPins: 'users:setPins' } },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...rest }: { children: React.ReactNode }) => (
    <a {...rest}>{children}</a>
  ),
}))

beforeEach(() => {
  pins.value = ['recipes', 'tasks', 'notes']
  pins.saves = []
})

const status = () => screen.getByRole('status')
/** The arrows only show in Reorder mode. */
const reorder = (name = 'Reorder') =>
  fireEvent.click(screen.getByRole('button', { name }))

describe('AllModulesPage', () => {
  test('saves the new order and says where the pin went', () => {
    renderInGroup(<AllModulesPage />)
    expect(status()).toHaveTextContent('')
    reorder()

    fireEvent.click(screen.getByRole('button', { name: 'Move Tasks down' }))

    expect(pins.saves).toEqual([
      {
        groupSlug: 'jansen-household',
        moduleIds: ['recipes', 'notes', 'tasks'],
      },
    ])
    expect(status()).toHaveTextContent('Tasks moved to position 3 of 3')
  })

  test('says it in Dutch', () => {
    renderInGroup(<AllModulesPage />, { locale: 'nl' })
    reorder('Volgorde wijzigen')
    fireEvent.click(screen.getByRole('button', { name: 'Notities omhoog' }))
    expect(status()).toHaveTextContent('Notities verplaatst naar positie 2 van 3')
  })

  test('keeps focus on the other arrow once a pin reaches the top', () => {
    const { rerender } = renderInGroup(<AllModulesPage />)
    reorder()
    const up = screen.getByRole('button', { name: 'Move Tasks up' })
    up.focus()
    fireEvent.click(up)

    // Convex answers with the saved order a moment later.
    pins.value = ['tasks', 'recipes', 'notes']
    act(() => rerender(<AllModulesPage />))

    expect(screen.getByRole('button', { name: 'Move Tasks up' })).toBeDisabled()
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Move Tasks down' }),
    )
  })

  test('a pin or unpin clears the last move from the status line', () => {
    renderInGroup(<AllModulesPage />)
    reorder()
    fireEvent.click(screen.getByRole('button', { name: 'Move Tasks down' }))
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Actions for Recipes' })[0],
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Unpin' }))
    expect(status()).toHaveTextContent('')
  })

  test('the arrows wait for Reorder, and Done puts them away', () => {
    renderInGroup(<AllModulesPage />)
    expect(screen.queryByRole('button', { name: 'Move Tasks down' })).toBeNull()
    reorder()
    expect(
      screen.getByRole('button', { name: 'Move Tasks down' }),
    ).toBeInTheDocument()
    reorder('Done')
    expect(screen.queryByRole('button', { name: 'Move Tasks down' })).toBeNull()
  })

  test('Reorder mode ends when only one pin is left', () => {
    const { rerender } = renderInGroup(<AllModulesPage />)
    reorder()
    pins.value = ['recipes']
    act(() => rerender(<AllModulesPage />))
    expect(screen.queryByRole('button', { name: 'Move Recipes up' })).toBeNull()

    pins.value = ['recipes', 'tasks']
    act(() => rerender(<AllModulesPage />))
    expect(screen.getByRole('button', { name: 'Reorder' })).toBeInTheDocument()
  })

  test("a Module's row menu pins it", () => {
    renderInGroup(<AllModulesPage />)
    const menus = screen.getAllByRole('button', { name: /^Actions for / })
    // Every Module once in its group, and each pin once more at the top.
    expect(menus.length).toBeGreaterThan(3)
    const groceries = screen.getByRole('button', { name: 'Actions for Groceries' })
    fireEvent.click(groceries)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Pin' }))
    expect(pins.saves).toEqual([
      {
        groupSlug: 'jansen-household',
        moduleIds: ['recipes', 'tasks', 'notes', 'groceries'],
      },
    ])
  })

  test('no row menu until the pins have loaded', () => {
    pins.value = undefined
    renderInGroup(<AllModulesPage />)
    expect(screen.queryByRole('button', { name: /^Actions for / })).toBeNull()
  })
})
