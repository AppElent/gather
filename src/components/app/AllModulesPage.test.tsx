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

describe('AllModulesPage', () => {
  test('saves the new order and says where the pin went', () => {
    renderInGroup(<AllModulesPage />)
    expect(status()).toHaveTextContent('')

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
    fireEvent.click(screen.getByRole('button', { name: 'Notities omhoog' }))
    expect(status()).toHaveTextContent('Notities verplaatst naar positie 2 van 3')
  })

  test('keeps focus on the other arrow once a pin reaches the top', () => {
    const { rerender } = renderInGroup(<AllModulesPage />)
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
    fireEvent.click(screen.getByRole('button', { name: 'Move Tasks down' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Unpin Recipes' })[0])
    expect(status()).toHaveTextContent('')
  })
})
