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
vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ isLoaded: true, isSignedIn: true, user }),
  useClerk: () => ({ signOut }),
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

  it('signs out', () => {
    renderWithI18n(<ProfilePanel />)
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    expect(signOut).toHaveBeenCalled()
  })
})
