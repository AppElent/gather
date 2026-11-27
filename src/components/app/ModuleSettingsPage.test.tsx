import { fireEvent, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { BabyListPage } from '../baby/BabyListPage'
import { BabySettingsPage } from '../baby/BabySettingsPage'
import {
  resetHiddenSmartListsForTests,
  useHiddenSmartLists,
} from '../tasks/hiddenSmartLists'
import { TasksSettingsPage } from '../tasks/TasksSettingsPage'
import { InsetRow } from './InsetList'
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
  window.localStorage.clear()
  resetHiddenSmartListsForTests()
})

afterEach(() => vi.restoreAllMocks())

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
  // Today is always on the index, so it has no switch.
  expect(screen.queryByRole('switch', { name: 'Today' })).toBeNull()
  expect(screen.getByTestId('wash-summary')).toHaveTextContent(
    '2 smart lists shown',
  )

  fireEvent.click(toggle('My tasks'))
  fireEvent.click(toggle('Unassigned'))
  expect(toggle('My tasks')).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByTestId('hidden')).toHaveTextContent('unassigned')
  expect(window.localStorage.getItem(key)).toBe('["unassigned"]')

  // Another tab's choice.
  window.localStorage.setItem(key, '["upcoming"]')
  fireEvent(window, new StorageEvent('storage', { key }))
  expect(toggle('Upcoming')).toHaveAttribute('aria-checked', 'false')
  expect(screen.getByTestId('hidden')).toHaveTextContent('upcoming')
})

test('Tasks settings show every list when the browser refuses its storage', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  renderInGroup(<TasksSettingsPage />)
  const mine = screen.getByRole('switch', { name: 'My tasks' })
  expect(mine).toHaveAttribute('aria-checked', 'true')

  // The choice still holds until the page closes.
  fireEvent.click(mine)
  expect(mine).toHaveAttribute('aria-checked', 'false')
})

describe('InsetRow as a switch', () => {
  test('says whether it is on and passes the press on', () => {
    const onClick = vi.fn()
    renderInGroup(
      <InsetRow title="Reminders" switchedOn={false} onClick={onClick} />,
    )
    const row = screen.getByRole('switch', { name: 'Reminders' })
    expect(row).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(row)
    expect(onClick).toHaveBeenCalledOnce()
  })

  test('disabled, it ignores the press', () => {
    const onClick = vi.fn()
    renderInGroup(
      <InsetRow title="Reminders" switchedOn disabled onClick={onClick} />,
    )
    const row = screen.getByRole('switch', { name: 'Reminders' })
    expect(row).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(row)
    expect(onClick).not.toHaveBeenCalled()
  })

  test('without switchedOn a pressable row is a plain button', () => {
    renderInGroup(<InsetRow title="Aisle order" onClick={() => {}} />)
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.getByRole('button', { name: 'Aisle order' })).not.toHaveAttribute(
      'aria-checked',
    )
  })
})
