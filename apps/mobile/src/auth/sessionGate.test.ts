import { describe, expect, test } from 'vitest'

import {
  closedGateView,
  confirmSession,
  isSessionOpen,
  type SessionConfirmation,
  type SessionInput,
  UNCONFIRMED,
} from './sessionGate'

/** Feed a sequence of signals through the gate the way renders would, and
 * report whether it was open after each one. */
function walk(steps: SessionInput[]): boolean[] {
  let confirmation: SessionConfirmation = UNCONFIRMED
  return steps.map((input) => {
    confirmation = confirmSession(confirmation, input)
    return isSessionOpen(input, confirmation)
  })
}

const a = { clerkId: 'user_a' }
const b = { clerkId: 'user_b' }

describe('ConvexSessionGate decision', () => {
  test('stays closed while Clerk is signed in but Convex has not authenticated', () => {
    expect(
      walk([
        { account: 'user_a', isAuthenticated: false, viewer: undefined },
        { account: 'user_a', isAuthenticated: true, viewer: undefined },
      ]),
    ).toEqual([false, false])
  })

  test('opens once the backend vouches for the Clerk user on screen', () => {
    expect(
      walk([
        { account: 'user_a', isAuthenticated: true, viewer: undefined },
        { account: 'user_a', isAuthenticated: true, viewer: a },
      ]),
    ).toEqual([false, true])
  })

  test('stays closed for an account with no users row until ensureUser provisions it', () => {
    expect(
      walk([
        { account: 'user_a', isAuthenticated: true, viewer: null },
        { account: 'user_a', isAuthenticated: true, viewer: a },
      ]),
    ).toEqual([false, true])
  })

  test('stays open while the viewer query is briefly unanswered for the same account', () => {
    expect(
      walk([
        { account: 'user_a', isAuthenticated: true, viewer: a },
        { account: 'user_a', isAuthenticated: true, viewer: undefined },
        { account: 'user_a', isAuthenticated: true, viewer: a },
      ]),
    ).toEqual([true, true, true])
  })

  test('closes on sign-out, and a later sign-in waits for a fresh confirmation', () => {
    expect(
      walk([
        { account: 'user_a', isAuthenticated: true, viewer: a },
        { account: null, isAuthenticated: false, viewer: undefined },
        { account: 'user_a', isAuthenticated: true, viewer: undefined },
        { account: 'user_a', isAuthenticated: true, viewer: a },
      ]),
    ).toEqual([true, false, false, true])
  })

  test('closes on a direct account switch while Convex still answers for the previous account', () => {
    expect(
      walk([
        { account: 'user_a', isAuthenticated: true, viewer: a },
        // Clerk has switched; Convex is still authenticated, as user_a.
        { account: 'user_b', isAuthenticated: true, viewer: a },
        { account: 'user_b', isAuthenticated: true, viewer: undefined },
        { account: 'user_b', isAuthenticated: true, viewer: b },
      ]),
    ).toEqual([true, false, false, true])
  })

  test('does not carry a confirmation back across a quick switch and return', () => {
    expect(
      walk([
        { account: 'user_a', isAuthenticated: true, viewer: a },
        { account: 'user_b', isAuthenticated: true, viewer: undefined },
        { account: 'user_a', isAuthenticated: true, viewer: undefined },
      ]),
    ).toEqual([true, false, false])
  })

  test('closes when Convex loses the session even if the last answer matched', () => {
    expect(
      walk([
        { account: 'user_a', isAuthenticated: true, viewer: a },
        { account: 'user_a', isAuthenticated: false, viewer: undefined },
      ]),
    ).toEqual([true, false])
  })

  test('returns the same confirmation once converged, so render-time updates settle', () => {
    const input = { account: 'user_a', isAuthenticated: true, viewer: a }
    const once = confirmSession(UNCONFIRMED, input)
    expect(confirmSession(once, input)).toBe(once)
    expect(
      confirmSession(UNCONFIRMED, {
        account: null,
        isAuthenticated: false,
        viewer: undefined,
      }),
    ).toBe(UNCONFIRMED)
  })
})

describe('closedGateView', () => {
  const waiting = {
    unprovisioned: false,
    provisioningFailed: false,
    provisionWaitExpired: false,
    revealed: false,
  }

  test('stays quiet, then admits it is waiting', () => {
    expect(closedGateView(waiting)).toBe('quiet')
    expect(closedGateView({ ...waiting, revealed: true })).toBe('pending')
  })

  test('offers recovery when an account with no users row could not be provisioned', () => {
    expect(
      closedGateView({
        ...waiting,
        unprovisioned: true,
        provisioningFailed: true,
      }),
    ).toBe('recover')
  })

  test('offers recovery when provisioning has outlasted its wait without an answer', () => {
    expect(closedGateView({ ...waiting, unprovisioned: true })).toBe('quiet')
    expect(
      closedGateView({
        ...waiting,
        unprovisioned: true,
        provisionWaitExpired: true,
        revealed: true,
      }),
    ).toBe('recover')
  })

  test('does not blame provisioning while the users row is merely unanswered', () => {
    expect(
      closedGateView({
        ...waiting,
        provisioningFailed: true,
        provisionWaitExpired: true,
        revealed: true,
      }),
    ).toBe('pending')
  })
})
