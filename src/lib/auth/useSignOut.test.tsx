import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const clerk = vi.hoisted(() => ({
  session: { id: 'sess_current' } as { id: string } | null,
  signOut: vi.fn((_options: unknown) => Promise.resolve()),
}))
vi.mock('@clerk/react', () => ({ useClerk: () => clerk }))

import { endSession, useSignOut } from './useSignOut'

beforeEach(() => {
  clerk.session = { id: 'sess_current' }
  clerk.signOut.mockClear()
})

describe('ending one Clerk session (APP-872)', () => {
  it('names the session, so another one in the browser stays', async () => {
    await endSession(clerk, 'sess_a')
    expect(clerk.signOut).toHaveBeenCalledExactlyOnceWith({ sessionId: 'sess_a' })
  })

  it('passes the redirect along with the session', async () => {
    await endSession(clerk, 'sess_a', '/sign-in?deleted=gather')
    expect(clerk.signOut).toHaveBeenCalledExactlyOnceWith({
      sessionId: 'sess_a',
      redirectUrl: '/sign-in?deleted=gather',
    })
  })

  it('never calls Clerk without a session, which would end them all', async () => {
    await endSession(clerk, undefined)
    expect(clerk.signOut).not.toHaveBeenCalled()
  })

  it('signs out of the session current at the call, not at render', async () => {
    const { result } = renderHook(() => useSignOut())
    clerk.session = { id: 'sess_switched' }
    await result.current()
    expect(clerk.signOut).toHaveBeenCalledExactlyOnceWith({
      sessionId: 'sess_switched',
    })
  })

  it('does nothing with nobody signed in', async () => {
    clerk.session = null
    const { result } = renderHook(() => useSignOut())
    await result.current()
    expect(clerk.signOut).not.toHaveBeenCalled()
  })
})
