import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { GroupSettingsLinks } from './GroupSettingsLinks'

/**
 * What stands where the connections used to be.
 *
 * Connecting Notion moved off `/settings`, which is a page about you, onto each
 * Group's own settings page — a connection belongs to a Group. Somebody who
 * knows where it was should be sent on rather than shown a gap, and each Group
 * has its own answer, so every Group gets a row.
 */

const groups = vi.hoisted(() => ({ value: undefined as unknown }))

vi.mock('convex/react', () => ({ useQuery: () => groups.value }))

vi.mock('../../../convex/_generated/api', () => ({
  api: { groups: { myGroups: 'groups:myGroups' } },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    children,
    ...rest
  }: {
    to: string
    params: Record<string, string>
    children: React.ReactNode
  }) => (
    <a href={to.replace('$groupSlug', params.groupSlug)} {...rest}>
      {children}
    </a>
  ),
}))

beforeEach(() => {
  groups.value = undefined
})

describe('the signpost to each Group’s settings', () => {
  test('says a connection belongs to a group rather than to you', () => {
    renderWithI18n(<GroupSettingsLinks />)
    expect(screen.getByText(/belong to a group, not to you/i)).toBeDefined()
  })

  test('links to every Group the caller is in, by its own slug', () => {
    groups.value = [
      { _id: 'g1', name: 'Jansen Household', slug: 'jansen-household' },
      { _id: 'g2', name: 'Cooking club', slug: 'cooking-club' },
    ]

    renderWithI18n(<GroupSettingsLinks />)

    expect(
      screen
        .getByRole('link', { name: /Jansen Household/ })
        .getAttribute('href'),
    ).toBe('/g/jansen-household/settings')
    expect(
      screen.getByRole('link', { name: /Cooking club/ }).getAttribute('href'),
    ).toBe('/g/cooking-club/settings')
  })

  test('offers nothing at all until the answer has arrived', () => {
    renderWithI18n(<GroupSettingsLinks />)
    expect(screen.queryAllByRole('link')).toEqual([])
  })
})
