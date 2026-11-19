import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { SignedInDevices } from './SignedInDevices'

/**
 * The Account page's list of Clerk sessions.
 *
 * The rules worth pinning: the session you hold is marked and has no button
 * (that is Sign out), revoking names the device first, and the list is fetched
 * again afterwards rather than edited in place.
 */

// Clerk hands out the same `user` and `session` between renders; so must this,
// or the component's reload effect would loop.
const clerk = vi.hoisted(() => {
  const getSessions = vi.fn()
  return {
    getSessions,
    user: { getSessions },
    session: { id: 'sess_here' },
  }
})
const forgetEnded = vi.hoisted(() => vi.fn())

vi.mock('@clerk/react', () => ({
  useUser: () => ({ user: clerk.user }),
  useSession: () => ({ session: clerk.session }),
}))

vi.mock('convex/react', () => ({
  useMutation: () => forgetEnded,
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    notifications: { forgetEndedSessions: 'notifications:forgetEndedSessions' },
  },
}))

function session(
  id: string,
  activity: Record<string, string> = {},
  revoke = vi.fn().mockResolvedValue(undefined),
) {
  return {
    id,
    lastActiveAt: new Date(2026, 10, 12),
    latestActivity: activity,
    revoke,
  }
}

beforeEach(() => {
  clerk.getSessions.mockReset()
  forgetEnded.mockReset()
  forgetEnded.mockResolvedValue(null)
})

describe('SignedInDevices', () => {
  test('lists sessions and marks the one you hold as This device', async () => {
    clerk.getSessions.mockResolvedValue([
      session('sess_here', { browserName: 'Chrome', deviceType: 'Mac' }),
      session('sess_phone', {
        browserName: 'Safari',
        deviceType: 'iPhone',
        city: 'Utrecht',
        country: 'Netherlands',
      }),
      session('sess_unknown'),
    ])

    renderWithI18n(<SignedInDevices />)

    expect(await screen.findByText('This device')).toBeTruthy()
    expect(screen.queryByText('Chrome · Mac')).toBeNull()
    expect(screen.getByText('Safari · iPhone')).toBeTruthy()
    expect(screen.getByText(/Utrecht, Netherlands · Last active/)).toBeTruthy()
    expect(screen.getByText('Unknown device')).toBeTruthy()
    // The held session has no way to sign itself out from the list.
    expect(screen.queryByTestId('account-revoke-sess_here')).toBeNull()
    expect(screen.getByTestId('account-revoke-sess_phone')).toBeTruthy()
  })

  test('says it is loading until Clerk answers', async () => {
    clerk.getSessions.mockReturnValue(new Promise(() => {}))
    renderWithI18n(<SignedInDevices />)
    expect(screen.getByText('Loading…')).toBeTruthy()
  })

  test('asks first, naming the device, then revokes and reloads', async () => {
    const revoke = vi.fn().mockResolvedValue(undefined)
    clerk.getSessions
      .mockResolvedValueOnce([
        session('sess_here'),
        session('sess_phone', { browserName: 'Safari', deviceType: 'iPhone' }, revoke),
      ])
      .mockResolvedValueOnce([session('sess_here')])

    renderWithI18n(<SignedInDevices />)
    fireEvent.click(await screen.findByTestId('account-revoke-sess_phone'))

    const dialog = await screen.findByRole('dialog', {
      name: 'Sign out of Safari · iPhone?',
    })
    expect(revoke).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out' }))

    await waitFor(() => expect(revoke).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(clerk.getSessions).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('Safari · iPhone')).toBeNull()
    // Its phone stops receiving this account's notifications.
    expect(forgetEnded).toHaveBeenCalledWith({
      activeSessionIds: ['sess_here'],
      endedSessionIds: ['sess_phone'],
    })
  })

  test('cancelling revokes nothing', async () => {
    const revoke = vi.fn()
    clerk.getSessions.mockResolvedValue([
      session('sess_here'),
      session('sess_phone', { browserName: 'Safari' }, revoke),
    ])

    renderWithI18n(<SignedInDevices />)
    fireEvent.click(await screen.findByTestId('account-revoke-sess_phone'))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(revoke).not.toHaveBeenCalled()
  })

  test('a failed load shows the error', async () => {
    clerk.getSessions.mockRejectedValue(new Error('network'))
    renderWithI18n(<SignedInDevices />)

    expect((await screen.findByRole('alert')).textContent).toMatch(
      /Could not load or change/,
    )
    expect(screen.queryByText('Loading…')).toBeNull()
  })

  test('a failed revoke keeps the dialog open with the error and the list as it was', async () => {
    const revoke = vi.fn().mockRejectedValue(new Error('nope'))
    clerk.getSessions.mockResolvedValue([
      session('sess_here'),
      session('sess_phone', { browserName: 'Safari' }, revoke),
    ])

    renderWithI18n(<SignedInDevices />)
    fireEvent.click(await screen.findByTestId('account-revoke-sess_phone'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out' }))

    expect((await within(dialog).findByRole('alert')).textContent).toBe('nope')
    expect(clerk.getSessions).toHaveBeenCalledTimes(1)
    expect(forgetEnded).not.toHaveBeenCalled()
  })

  test('reads in Dutch', async () => {
    clerk.getSessions.mockResolvedValue([session('sess_here')])
    renderWithI18n(<SignedInDevices />, { locale: 'nl' })
    expect(await screen.findByText('Ingelogde apparaten')).toBeTruthy()
    expect(screen.getByText('Dit apparaat')).toBeTruthy()
  })
})
