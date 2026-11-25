import { screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { Route } from '../../routes/_app/account'

// The Account page with its other panels left out: what is pinned here is that
// the page carries the way to the portal.
vi.mock('./SignedInDevices', () => ({ SignedInDevices: () => null }))
vi.mock('./AccountDeleteSettings', () => ({
  AccountDeleteSettings: () => null,
}))
vi.mock('../settings/DataExportSettings', () => ({
  DataExportSettings: () => null,
}))
vi.mock('../../lib/auth', () => ({ ProfilePanel: () => null }))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: () => null,
}))

const AccountPage = Route.options.component as () => React.ReactElement

describe('the Account page', () => {
  test.each([
    ['en', 'Manage your AppElent account (opens in a new tab)'],
    ['nl', 'Beheer je AppElent-account (opent in een nieuw tabblad)'],
  ] as const)('links to the account portal in a new tab (%s)', (locale, name) => {
    renderWithI18n(<AccountPage />, { locale })

    const link = screen.getByRole('link', { name })
    expect(link.getAttribute('href')).toBe('https://account.appelent.nl')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })
})
