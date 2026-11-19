import { fireEvent, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { AccountDeleteUnderway } from './AccountDeleteUnderway'

test('says the account is being deleted while Clerk is asked', () => {
  renderWithI18n(
    <AccountDeleteUnderway
      state={{ step: 'deletingLogin' }}
      retryLogin={vi.fn()}
      signOut={vi.fn()}
    />,
  )

  expect(screen.getByText('Deleting your account…')).toBeInTheDocument()
  expect(screen.queryByRole('button')).toBeNull()
})

test('a stranded login says the data is gone and offers Try again and Sign out', () => {
  const retryLogin = vi.fn()
  const signOut = vi.fn()
  renderWithI18n(
    <AccountDeleteUnderway
      state={{ step: 'stranded' }}
      retryLogin={retryLogin}
      signOut={signOut}
    />,
  )

  expect(screen.getByRole('alert').textContent).toContain(
    'Your data was deleted, but the account itself could not be.',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  expect(retryLogin).toHaveBeenCalledTimes(1)
  expect(signOut).toHaveBeenCalledTimes(1)
})
