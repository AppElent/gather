import { fireEvent, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { BabyListPage } from '../baby/BabyListPage'
import { BabySettingsPage } from '../baby/BabySettingsPage'
import { useHiddenSmartLists } from '../tasks/hiddenSmartLists'
import { TasksSettingsPage } from '../tasks/TasksSettingsPage'
import { renderInGroup } from './testing'

const state = vi.hoisted(() => ({ babies: undefined as unknown }))

vi.mock('convex/react', () => ({ useQuery: () => state.babies }))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...rest
  }: {
    children: ReactNode
    to: string
    params?: Record<string, string>
  }) => (
    <a
      href={to.replace(/\$(\w+)/g, (_, name) => params?.[name] ?? '')}
      {...rest}
    >
      {children}
    </a>
  ),
}))

const MILA = {
  _id: 'b1',
  name: 'Mila',
  birthDate: '2026-01-02',
  photoUrl: null,
}

beforeEach(() => {
  state.babies = [MILA]
})

describe('Baby log', () => {
  test('the gear opens the settings page', () => {
    renderInGroup(<BabyListPage />, { locale: 'nl' })
    expect(
      screen.getByRole('link', { name: 'Instellingen van Babylogboek' }),
    ).toHaveAttribute('href', '/baby/settings')
    expect(screen.getByTestId('wash-summary')).toHaveTextContent(
      '1 kind · Jansen household',
    )
  })

  test('its settings list each child, opening the edit page', () => {
    renderInGroup(<BabySettingsPage />)
    const list = screen.getByRole('list', { name: 'Baby log' })
    expect(within(list).getByRole('link', { name: 'Mila' })).toHaveAttribute(
      'href',
      '/baby/b1/edit',
    )
    expect(
      screen.getByText('Shared with everyone in Jansen household.'),
    ).toBeInTheDocument()
  })

  test('without a child it offers to add one', () => {
    state.babies = []
    renderInGroup(<BabySettingsPage />)
    expect(
      screen.getByRole('link', { name: 'Add your first child' }),
    ).toHaveAttribute('href', '/baby/new')
  })
})

test('the frame has a trail from the Module and one way back on a phone', () => {
  renderInGroup(<BabySettingsPage />)
  const trail = screen.getByRole('navigation')
  expect(within(trail).getByRole('link', { name: 'Baby log' })).toHaveAttribute(
    'href',
    '/baby',
  )
  expect(within(trail).getByText('Baby log settings')).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(screen.getAllByRole('link', { name: 'Back to Baby log' })).toHaveLength(
    1,
  )
})

test('Tasks settings switch a smart list, kept under the phone’s key', () => {
  function Index() {
    return <p data-testid="hidden">{useHiddenSmartLists().hidden.join()}</p>
  }
  const key = 'gather:tasks:hidden-smart-lists'
  window.localStorage.setItem(key, '["mine","someday"]')
  renderInGroup(
    <>
      <TasksSettingsPage />
      <Index />
    </>,
  )
  const toggle = (name: string) => screen.getByRole('switch', { name })
  expect(toggle('My tasks')).toHaveAttribute('aria-checked', 'false')
  expect(toggle('Today')).toHaveAttribute('aria-checked', 'true')

  fireEvent.click(toggle('My tasks'))
  fireEvent.click(toggle('Today'))
  expect(toggle('My tasks')).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByTestId('hidden')).toHaveTextContent('today')
  expect(window.localStorage.getItem(key)).toBe('["today"]')

  // Another tab's choice.
  window.localStorage.setItem(key, '["upcoming"]')
  fireEvent(window, new StorageEvent('storage', { key }))
  expect(toggle('Upcoming')).toHaveAttribute('aria-checked', 'false')
  expect(screen.getByTestId('hidden')).toHaveTextContent('upcoming')
})
