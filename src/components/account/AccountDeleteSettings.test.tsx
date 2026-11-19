import { fireEvent, screen, within } from '@testing-library/react'
import { ConvexError } from 'convex/values'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import type { AccountDeleteState } from './AccountDeleteProvider'
import { AccountDeleteSettings } from './AccountDeleteSettings'

/**
 * The Danger zone says what goes and what stays before it asks, asks with the
 * account's name and a typed word, and only then starts the run.
 */

type Preview = {
  email: string
  deleted: string[]
  kept: string[]
} | null

const state = vi.hoisted(() => ({
  user: {
    deleteSelfEnabled: true as boolean | undefined,
    primaryEmailAddress: { emailAddress: 'sam@example.com' },
  } as {
    deleteSelfEnabled?: boolean
    primaryEmailAddress?: { emailAddress: string }
  } | null,
  preview: undefined as Preview | undefined,
  deletion: { step: 'idle' } as AccountDeleteState,
  start: vi.fn(),
}))

vi.mock('@clerk/react', () => ({ useUser: () => ({ user: state.user }) }))
vi.mock('convex/react', () => ({ useQuery: () => state.preview }))
vi.mock('../../../convex/_generated/api', () => ({
  api: { accounts: { deletionPreview: 'accounts:deletionPreview' } },
}))
vi.mock('./AccountDeleteProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./AccountDeleteProvider')>()
  return {
    ...actual,
    useAccountDelete: () => ({
      state: state.deletion,
      start: state.start,
      retryLogin: vi.fn(),
      signOut: vi.fn(),
    }),
  }
})

const submit = () => screen.getByTestId('account-delete-submit')

beforeEach(() => {
  state.user = {
    deleteSelfEnabled: true,
    primaryEmailAddress: { emailAddress: 'sam@example.com' },
  }
  state.preview = {
    email: 'sam@example.com',
    deleted: ['Sam’s kitchen'],
    kept: ['The Jansens'],
  }
  state.deletion = { step: 'idle' }
  state.start.mockReset()
})

describe('before asking', () => {
  test('names the Groups that go and the Groups that stay', () => {
    renderWithI18n(<AccountDeleteSettings />)

    const goes = screen.getByRole('heading', { name: 'Deleted with your account' })
      .parentElement as HTMLElement
    const kept = screen.getByRole('heading', { name: 'Left, not deleted' })
      .parentElement as HTMLElement
    expect(within(goes).getByText('Sam’s kitchen')).toBeInTheDocument()
    expect(within(kept).getByText('The Jansens')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Danger zone' })).toBeInTheDocument()
  })

  test('says so when there are no Groups', () => {
    state.preview = { email: 'sam@example.com', deleted: [], kept: [] }
    renderWithI18n(<AccountDeleteSettings />)

    expect(screen.getByText('You are not in any Groups.')).toBeInTheDocument()
    expect(submit()).toBeEnabled()
  })

  test('waits for the preview before offering the button', () => {
    state.preview = undefined
    renderWithI18n(<AccountDeleteSettings />)

    expect(submit()).toBeDisabled()
  })

  test('withholds the button when Clerk does not allow self-deletion, and says why', () => {
    state.user = { deleteSelfEnabled: false }
    renderWithI18n(<AccountDeleteSettings />)

    expect(submit()).toBeDisabled()
    expect(screen.getByRole('alert').textContent).toBe(
      'This account cannot be deleted here. Please contact support.',
    )
  })

  test('keeps the button off without claiming anything while Clerk loads', () => {
    state.user = null
    renderWithI18n(<AccountDeleteSettings />)

    expect(submit()).toBeDisabled()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  test('reads in Dutch', () => {
    renderWithI18n(<AccountDeleteSettings />, { locale: 'nl' })

    expect(screen.getByText('Verdwijnt met je account')).toBeInTheDocument()
    expect(submit().textContent).toBe('Verwijder mijn account')
  })
})

describe('asking', () => {
  test('names the account and starts only once the word is typed', () => {
    renderWithI18n(<AccountDeleteSettings />)
    fireEvent.click(submit())

    const dialog = screen.getByRole('dialog', { name: 'Delete sam@example.com?' })
    const confirm = within(dialog).getByRole('button', { name: 'Delete' })
    expect(confirm).toBeDisabled()

    fireEvent.change(within(dialog).getByLabelText('Type DELETE to confirm'), {
      target: { value: 'delete' },
    })
    fireEvent.click(confirm)

    expect(state.start).toHaveBeenCalledTimes(1)
  })

  test('cancelling starts nothing', () => {
    renderWithI18n(<AccountDeleteSettings />)
    fireEvent.click(submit())
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(state.start).not.toHaveBeenCalled()
  })

  test('is busy while the sign-in is checked and the purge is asked for', () => {
    state.deletion = { step: 'purging' }
    renderWithI18n(<AccountDeleteSettings />)

    expect(submit()).toBeDisabled()
    expect(submit().textContent).toBe('Working…')
  })
})

describe('after a refusal, when nothing was deleted', () => {
  test('a server refusal says its own reason', () => {
    state.deletion = {
      step: 'refused',
      cause: new ConvexError(
        'You are signed in to a different account now. Nothing was deleted.',
      ),
    }
    renderWithI18n(<AccountDeleteSettings />)

    expect(screen.getByRole('alert').textContent).toBe(
      'You are signed in to a different account now. Nothing was deleted.',
    )
    expect(submit()).toBeEnabled()
  })

  test('a sign-in that could not be confirmed says nothing was deleted', async () => {
    const { SignInNotConfirmed } = await import('./AccountDeleteProvider')
    state.deletion = { step: 'refused', cause: new SignInNotConfirmed() }
    renderWithI18n(<AccountDeleteSettings />)

    expect(screen.getByRole('alert').textContent).toBe(
      'Your sign-in could not be confirmed, so nothing was deleted. Try again.',
    )
  })

  test('a refusal with nothing readable still says nothing was deleted', () => {
    state.deletion = { step: 'refused', cause: {} }
    renderWithI18n(<AccountDeleteSettings />)

    expect(screen.getByRole('alert').textContent).toBe(
      'Your account could not be deleted. Nothing was deleted.',
    )
  })
})
