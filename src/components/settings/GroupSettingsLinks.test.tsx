import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderInGroup } from '../app/testing'
import { GroupSettingsLinks } from './GroupSettingsLinks'

/**
 * The way from your settings to each Group's: a connection such as Notion
 * belongs to a Group, and each Group has its own answer, so every Group gets a
 * row.
 */

const groups = vi.hoisted(() => ({ value: undefined as unknown }))

vi.mock('convex/react', () => ({ useQuery: () => groups.value }))

vi.mock('../../../convex/_generated/api', () => ({
  api: { groups: { myGroups: 'groups:myGroups' } },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params: _params,
    children,
    ...rest
  }: {
    to: string
    params: Record<string, string>
    children: React.ReactNode
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

beforeEach(() => {
  groups.value = undefined
})

describe('the signpost to each Group’s settings', () => {
  test('says a connection belongs to a group rather than to you', () => {
    renderInGroup(<GroupSettingsLinks />)
    expect(screen.getByText(/belong to a group, not to you/i)).toBeDefined()
  })

  test('links every Group the caller is in to its settings, as the Current Group', () => {
    groups.value = [
      { _id: 'g1', name: 'Jansen Household', slug: 'jansen-household' },
      { _id: 'g2', name: 'Cooking club', slug: 'cooking-club' },
    ]

    const setCurrentGroup = vi.fn()
    renderInGroup(<GroupSettingsLinks />, { setCurrentGroup })

    expect(
      screen
        .getByRole('link', { name: /Jansen Household/ })
        .getAttribute('href'),
    ).toBe('/group-settings')
    expect(
      screen.getByRole('link', { name: /Cooking club/ }).getAttribute('href'),
    ).toBe('/group-settings')

    fireEvent.click(screen.getByRole('link', { name: /Cooking club/ }))
    expect(setCurrentGroup).toHaveBeenCalledWith('g2')
  })

  test('offers nothing at all until the answer has arrived', () => {
    renderInGroup(<GroupSettingsLinks />)
    expect(screen.queryAllByRole('link')).toEqual([])
  })
})
