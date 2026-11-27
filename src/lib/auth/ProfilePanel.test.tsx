import { fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

// jsdom ships without matchMedia, which the embedded AppearanceSettings
// touches on mount.
beforeAll(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }))
})

const update = vi.fn()
const updatePassword = vi.fn()
const signOut = vi.fn()
// Stable user reference so ProfilePanel's seeding effect (deps: [user]) doesn't
// re-run on every render and clobber typed input.
const user = {
  firstName: 'Eric',
  lastName: 'Jansen',
  primaryEmailAddress: { emailAddress: 'e@x.com' },
  update,
  updatePassword,
}
vi.mock('@clerk/react', () => ({
  useUser: () => ({ isLoaded: true, isSignedIn: true, user }),
  useClerk: () => ({ session: { id: 'sess_current' }, signOut }),
}))

import { renderWithI18n } from '../i18n/testing'
import { ProfilePanel } from './ProfilePanel'

describe('ProfilePanel', () => {
  afterEach(() => {
    for (const m of [update, updatePassword, signOut]) m.mockReset()
  })

  it('saves name changes', async () => {
    update.mockResolvedValue({})
    renderWithI18n(<ProfilePanel />)
    fireEvent.change(screen.getByLabelText('First name'), {
      target: { value: 'Erik' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }))
    await vi.waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        firstName: 'Erik',
        lastName: 'Jansen',
      }),
    )
  })

  it('names the account in the change-password form for password managers', () => {
    renderWithI18n(<ProfilePanel />)
    const form = screen.getByLabelText('New password').closest('form')
    const hint = form?.querySelector('input[autocomplete="username"]')
    expect(hint).toHaveValue('e@x.com')
    expect(hint).not.toBeVisible()
    expect(screen.getByLabelText('Current password')).toHaveAttribute(
      'autocomplete',
      'current-password',
    )
    expect(screen.getByLabelText('New password')).toHaveAttribute(
      'autocomplete',
      'new-password',
    )
  })

  it('signs out of the current session only (APP-872)', () => {
    signOut.mockResolvedValue(undefined)
    renderWithI18n(<ProfilePanel />)
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    expect(signOut).toHaveBeenCalledExactlyOnceWith({
      sessionId: 'sess_current',
    })
  })
})
