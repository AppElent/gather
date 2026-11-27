import { act, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { AppleRevocation } from '../../lib/auth/appleRevocation'
import {
  AccountChanged,
  AccountDeleteProvider,
  type AccountDeleteValue,
  AppleNotRevoked,
  GATHER_DATA_DELETED_HOME,
  SignInNotConfirmed,
  useAccountDelete,
} from './AccountDeleteProvider'

/**
 * The web's deletion run, on the phone's terms
 * (`apps/mobile/src/features/account/delete/account-delete-provider.test.tsx`)
 * plus Clerk's recent-sign-in check, which has to pass before anything is
 * deleted.
 */

type ClerkUser = {
  id: string
  deleteSelfEnabled?: boolean
  delete: () => Promise<void>
}

const state = vi.hoisted(() => ({
  user: null as ClerkUser | null,
  sessionId: 'sess_1',
  /** Whether the session's sign-in is recent enough, read per check. */
  recent: [] as boolean[],
  /** What the person does with Clerk's verify dialog, per dialog. */
  dialog: [] as ('complete' | 'cancel')[],
  dialogsShown: 0,
  /** Runs while Clerk reloads the session. */
  onReload: () => {},
  purge: (): Promise<void> => Promise.resolve(),
  order: [] as string[],
  purgeArgs: [] as unknown[],
  signedOut: 0,
  signOutArgs: [] as unknown[],
  /** The Apple return URL for this account and origin; none skips Apple. */
  appleReturnUrl: null as string | null,
  /** How Apple's popup and the revocation end (APP-388). */
  apple: (): Promise<AppleRevocation> => Promise.resolve('continue'),
  appleArgs: [] as unknown[],
}))

const signOutStandIn = vi.hoisted(() => (options?: unknown) => {
  state.signedOut += 1
  state.order.push('signOut')
  state.signOutArgs.push(options)
  return Promise.resolve()
})

const clerk = vi.hoisted(() => ({
  get user() {
    return state.user
  },
  get session() {
    return state.sessionId
      ? {
          id: state.sessionId,
          reload: () => {
            state.order.push('reload')
            state.onReload()
            return Promise.resolve()
          },
          checkAuthorization: () => {
            state.order.push('check')
            return state.recent.length > 1
              ? (state.recent.shift() as boolean)
              : (state.recent[0] ?? true)
          },
        }
      : null
  },
  signOut: signOutStandIn as (options?: unknown) => Promise<void>,
}))

/** `isReverificationHint` from `@clerk/shared` (4.45.1), the check Clerk's
 * handler runs, so a malformed hint from the provider fails here too. */
function isReverificationHint(result: unknown) {
  const error =
    typeof result === 'object' && result !== null && 'clerk_error' in result
      ? (result as { clerk_error?: { type?: string; reason?: string } })
          .clerk_error
      : undefined
  return error?.type === 'forbidden' && error.reason === 'reverification-error'
}

vi.mock('@clerk/react', () => ({
  useUser: () => ({ user: state.user }),
  useClerk: () => clerk,
  // Clerk's handler: a hint, or a `session_reverification_required` refusal,
  // opens its dialog; completing it calls the function once more and returns
  // that answer as is, cancelling rejects.
  useReverification:
    <A extends unknown[], R>(fetcher: (...args: A) => Promise<R>) =>
    async (...args: A) => {
      const call = async () => {
        try {
          return await fetcher(...args)
        } catch (error) {
          if ((error as { code?: string }).code === 'needs_reverification')
            return {
              clerk_error: { type: 'forbidden', reason: 'reverification-error' },
            }
          throw error
        }
      }
      let result: unknown = await call()
      if (isReverificationHint(result)) {
        state.dialogsShown += 1
        if ((state.dialog.shift() ?? 'complete') === 'cancel')
          throw Object.assign(new Error('cancelled'), {
            code: 'reverification_cancelled',
          })
        result = await call()
      }
      return result
    },
}))
vi.mock('@clerk/react/errors', () => ({
  isReverificationCancelledError: (error: unknown) =>
    (error as { code?: string } | null)?.code === 'reverification_cancelled',
}))
vi.mock('../../lib/auth/appleRevocation', () => ({
  appleRevocationReturnUrl: () => state.appleReturnUrl,
  preloadAppleJs: () => {},
  revokeAppleSignIn: (_user: unknown, revoke: unknown, options: unknown) => {
    state.order.push('apple')
    state.appleArgs.push({ revoke, options })
    return state.apple()
  },
}))
vi.mock('../../lib/i18n', () => ({ useI18n: () => ({ locale: 'nl' }) }))
vi.mock('convex/react', () => ({
  useAction: () => 'accounts:revokeAppleSignIn',
  useMutation: () => (args: unknown) => {
    state.order.push('purge')
    state.purgeArgs.push(args)
    return state.purge()
  },
}))
vi.mock('../../../convex/_generated/api', () => ({
  api: { accounts: { deleteAccount: 'accounts:deleteAccount' } },
}))

/** Resolved or rejected by the test, so it decides what lands first. */
function deferred() {
  let resolve!: () => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<void>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

function clerkUser(overrides: Partial<ClerkUser> = {}): ClerkUser {
  return {
    id: 'user_1',
    deleteSelfEnabled: true,
    delete: () => {
      state.order.push('clerk')
      return Promise.resolve()
    },
    ...overrides,
  }
}

/** Stands in for the signed-in gate: the Account page, until the purge
 * empties the household and the page goes with it. */
let emptyHousehold: () => void
function SignedIn() {
  const [inAGroup, setInAGroup] = useState(true)
  emptyHousehold = () => setInAGroup(false)
  return inAGroup ? <AccountPage /> : <p>no group</p>
}

let deletion: AccountDeleteValue
function AccountPage() {
  deletion = useAccountDelete()
  return <p>account page: {deletion.state.step}</p>
}

const leave = vi.fn()

function mount() {
  return render(
    <AccountDeleteProvider
      leave={leave}
      underway={(value) => {
        deletion = value
        return <p>underway: {value.state.step}</p>
      }}
    >
      <SignedIn />
    </AccountDeleteProvider>,
  )
}

function shown() {
  return document.body.textContent
}

beforeEach(() => {
  state.user = clerkUser()
  state.sessionId = 'sess_1'
  state.recent = [true]
  state.dialog = []
  state.dialogsShown = 0
  state.onReload = () => {}
  state.purge = () => Promise.resolve()
  state.order = []
  state.purgeArgs = []
  state.signedOut = 0
  state.signOutArgs = []
  state.appleReturnUrl = null
  state.apple = () => Promise.resolve('continue')
  state.appleArgs = []
  leave.mockReset()
})

describe('deleting the account on the web', () => {
  test('a Clerk refusal is shown even after the purge has taken the Account page away', async () => {
    const purge = deferred()
    const login = deferred()
    state.purge = () => purge.promise
    state.user = clerkUser({ delete: () => login.promise })
    mount()

    act(() => deletion.start('wholeAccount'))
    await waitFor(() => expect(shown()).toBe('account page: purging'))

    // The scheduled purge empties the Group list before the mutation's answer
    // is back.
    act(() => {
      emptyHousehold()
      purge.resolve()
    })
    await waitFor(() => expect(shown()).toBe('underway: deletingLogin'))

    login.reject(new Error('Clerk refused'))
    await waitFor(() => expect(shown()).toBe('underway: stranded'))
    expect(leave).not.toHaveBeenCalled()
  })

  test('a stranded login can be asked for again, without purging again, and then leaves', async () => {
    let attempts = 0
    state.user = clerkUser({
      delete: () => {
        attempts += 1
        return attempts === 1
          ? Promise.reject(new Error('Clerk refused'))
          : Promise.resolve()
      },
    })
    mount()

    act(() => deletion.start('wholeAccount'))
    await waitFor(() => expect(shown()).toBe('underway: stranded'))

    act(() => deletion.retryLogin())
    await waitFor(() => expect(leave).toHaveBeenCalledWith('/'))
    expect(attempts).toBe(2)
    expect(state.order.filter((step) => step === 'purge')).toHaveLength(1)
  })

  test('a second Try again click before the first has rendered asks Clerk once', async () => {
    const retry = deferred()
    let attempts = 0
    state.user = clerkUser({
      delete: () => {
        attempts += 1
        return attempts === 1
          ? Promise.reject(new Error('Clerk refused'))
          : retry.promise
      },
    })
    mount()
    act(() => deletion.start('wholeAccount'))
    await waitFor(() => expect(shown()).toBe('underway: stranded'))

    const { retryLogin } = deletion
    act(() => {
      retryLogin()
      retryLogin()
    })
    retry.resolve()
    await waitFor(() => expect(leave).toHaveBeenCalledTimes(1))
    expect(attempts).toBe(2)
  })

  test('Clerk agreeing leaves for the signed-out start page', async () => {
    mount()

    act(() => deletion.start('wholeAccount'))

    await waitFor(() => expect(leave).toHaveBeenCalledWith('/'))
    expect(state.order).toEqual(['reload', 'check', 'purge', 'clerk'])
  })

  test('a purge refusal stays on the Account page and never reaches Clerk', async () => {
    const refusal = new Error('Not signed in')
    state.purge = () => Promise.reject(refusal)
    mount()

    act(() => deletion.start('wholeAccount'))

    await waitFor(() => expect(shown()).toBe('account page: refused'))
    expect(deletion.state).toEqual({
      step: 'refused',
      choice: 'wholeAccount',
      cause: refusal,
    })
    expect(state.order).not.toContain('clerk')
  })

  test('does nothing unless Clerk allows self-deletion', async () => {
    for (const deleteSelfEnabled of [false, undefined]) {
      state.user = clerkUser({ deleteSelfEnabled })
      const view = mount()
      act(() => deletion.start('wholeAccount'))
      await Promise.resolve()
      expect(shown()).toBe('account page: idle')
      view.unmount()
    }
    expect(state.order).toEqual([])
  })

  test('a second click before the first has rendered starts one deletion', async () => {
    mount()

    const { start } = deletion
    act(() => {
      start('wholeAccount')
      start('wholeAccount')
    })

    await waitFor(() => expect(leave).toHaveBeenCalled())
    expect(state.order.filter((step) => step === 'purge')).toHaveLength(1)
  })

  test('the purge names the account the person confirmed', async () => {
    mount()

    act(() => deletion.start('wholeAccount'))

    await waitFor(() => expect(leave).toHaveBeenCalled())
    expect(state.purgeArgs).toEqual([{ expectedSubject: 'user_1' }])
  })
})

describe('a recent sign-in, before anything is deleted', () => {
  test('an old sign-in asks Clerk, and once confirmed the deletion goes on', async () => {
    state.recent = [false, true]
    mount()

    act(() => deletion.start('wholeAccount'))

    await waitFor(() => expect(leave).toHaveBeenCalledWith('/'))
    expect(state.dialogsShown).toBe(1)
    expect(state.order.indexOf('purge')).toBeGreaterThan(
      state.order.lastIndexOf('check'),
    )
  })

  test('closing Clerk’s dialog deletes nothing and can be tried again', async () => {
    state.recent = [false, true]
    state.dialog = ['cancel']
    mount()

    act(() => deletion.start('wholeAccount'))
    await waitFor(() => expect(state.dialogsShown).toBe(1))
    await waitFor(() => expect(shown()).toBe('account page: idle'))
    expect(state.order).not.toContain('purge')

    act(() => deletion.start('wholeAccount'))
    await waitFor(() => expect(leave).toHaveBeenCalled())
  })

  test('a sign-in still old after Clerk’s dialog deletes nothing', async () => {
    state.recent = [false]
    mount()

    act(() => deletion.start('wholeAccount'))

    await waitFor(() => expect(shown()).toBe('account page: refused'))
    expect(
      deletion.state.step === 'refused' &&
        deletion.state.cause instanceof SignInNotConfirmed,
    ).toBe(true)
    expect(state.order).not.toContain('purge')
  })

  test('another account signed in meanwhile is never deleted', async () => {
    // The session changes while Clerk reloads it, as a sign-in in another
    // tab would.
    state.onReload = () => {
      state.sessionId = 'sess_2'
    }
    mount()

    act(() => deletion.start('wholeAccount'))

    await waitFor(() => expect(shown()).toBe('account page: refused'))
    expect(
      deletion.state.step === 'refused' &&
        deletion.state.cause instanceof AccountChanged,
    ).toBe(true)
    expect(state.order).not.toContain('purge')
  })

  test('Clerk asking again after the purge, and that being cancelled, strands the login', async () => {
    state.user = clerkUser({
      delete: () =>
        Promise.reject(
          Object.assign(new Error('reverify'), {
            code: 'needs_reverification',
          }),
        ),
    })
    state.dialog = ['cancel']
    mount()

    act(() => deletion.start('wholeAccount'))

    await waitFor(() => expect(shown()).toBe('underway: stranded'))
    expect(state.dialogsShown).toBe(1)
  })

  test('signing out from the stranded state signs out of Clerk and leaves', async () => {
    state.user = clerkUser({
      delete: () => Promise.reject(new Error('Clerk refused')),
    })
    mount()
    act(() => deletion.start('wholeAccount'))
    await waitFor(() => expect(shown()).toBe('underway: stranded'))

    act(() => deletion.signOut())

    await waitFor(() => expect(leave).toHaveBeenCalledWith('/'))
    expect(state.signedOut).toBe(1)
    // Only the session whose login is stranded (APP-872).
    expect(state.signOutArgs).toEqual([{ sessionId: 'sess_1' }])
  })
})

describe('deleting Gather data only (APP-397)', () => {
  test('purges with the login kept, never asks Clerk to delete, and signs out to say so', async () => {
    const del = vi.fn(() => Promise.resolve())
    state.user = clerkUser({ delete: del })
    mount()

    act(() => deletion.start('gatherData'))

    await waitFor(() =>
      expect(leave).toHaveBeenCalledWith(GATHER_DATA_DELETED_HOME),
    )
    expect(state.order).toEqual(['reload', 'check', 'purge', 'signOut'])
    expect(state.purgeArgs).toEqual([
      { expectedSubject: 'user_1', keepLogin: true },
    ])
    // Only the session that confirmed, not every one in the browser (APP-872).
    expect(state.signOutArgs).toEqual([
      { sessionId: 'sess_1', redirectUrl: GATHER_DATA_DELETED_HOME },
    ])
    expect(del).not.toHaveBeenCalled()
    expect(GATHER_DATA_DELETED_HOME).toBe('/sign-in?deleted=gather')
  })

  test('takes the signed-in tree away while it signs out', async () => {
    const out = deferred()
    clerk.signOut = () => out.promise
    try {
      mount()
      act(() => deletion.start('gatherData'))
      await waitFor(() => expect(shown()).toBe('underway: signingOut'))
      out.resolve()
      await waitFor(() => expect(leave).toHaveBeenCalled())
    } finally {
      clerk.signOut = signOutStandIn
    }
  })

  test('needs no permission from Clerk to delete the login', async () => {
    state.user = clerkUser({ deleteSelfEnabled: false })
    mount()

    act(() => deletion.start('gatherData'))

    await waitFor(() => expect(leave).toHaveBeenCalled())
    expect(state.order).toContain('purge')
  })

  test('still confirms a recent sign-in first', async () => {
    state.recent = [false]
    mount()

    act(() => deletion.start('gatherData'))

    await waitFor(() => expect(shown()).toBe('account page: refused'))
    expect(state.order).not.toContain('purge')
  })

  test('a purge refusal stays on the Account page and does not sign out', async () => {
    const refusal = new Error('nope')
    state.purge = () => Promise.reject(refusal)
    mount()

    act(() => deletion.start('gatherData'))

    await waitFor(() => expect(shown()).toBe('account page: refused'))
    expect(deletion.state).toEqual({
      step: 'refused',
      choice: 'gatherData',
      cause: refusal,
    })
    expect(state.signedOut).toBe(0)
    expect(leave).not.toHaveBeenCalled()
  })
})

test('useAccountDelete outside the provider says so', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(() => render(<AccountPage />)).toThrow(/AccountDeleteProvider/)
  spy.mockRestore()
  expect(screen.queryByText(/account page/)).toBeNull()
})

describe('Sign in with Apple before the whole account goes (APP-388)', () => {
  beforeEach(() => {
    state.appleReturnUrl = 'https://gather.appelent.nl/account'
  })

  async function askedForApple() {
    mount()
    act(() => deletion.start('wholeAccount'))
    await waitFor(() => expect(shown()).toBe('account page: confirmingApple'))
    // Nothing happens until the person clicks: the popup needs that click.
    expect(state.order).toEqual(['reload', 'check'])
  }

  test('revokes after the sign-in check and before anything is deleted', async () => {
    await askedForApple()
    act(() => deletion.continueWithApple())
    await waitFor(() => expect(leave).toHaveBeenCalledWith('/'))
    // Apple's step can outlast the sign-in window, so it is checked again.
    expect(state.order).toEqual([
      'reload',
      'check',
      'apple',
      'reload',
      'check',
      'purge',
      'clerk',
    ])
    expect(state.appleArgs).toEqual([
      {
        revoke: 'accounts:revokeAppleSignIn',
        options: { expectedSubject: 'user_1', locale: 'nl' },
      },
    ])
  })

  test('backing out before the popup deletes nothing and can be tried again', async () => {
    await askedForApple()
    act(() => deletion.cancelApple())
    await waitFor(() => expect(shown()).toBe('account page: idle'))
    expect(state.order).toEqual(['reload', 'check'])

    act(() => deletion.start('wholeAccount'))
    await waitFor(() => expect(shown()).toBe('account page: confirmingApple'))
  })

  test('closing the Apple popup deletes nothing', async () => {
    state.apple = () => Promise.resolve('cancelled')
    await askedForApple()
    act(() => deletion.continueWithApple())
    await waitFor(() => expect(shown()).toBe('account page: idle'))
    expect(state.order).toEqual(['reload', 'check', 'apple'])
    expect(state.purgeArgs).toEqual([])
    expect(leave).not.toHaveBeenCalled()
  })

  test.each([
    'popupBlocked',
    'appleMismatch',
    'failed',
  ] as const)('a popup that ends %s deletes nothing and says why', async (reason) => {
    state.apple = () => Promise.resolve(reason)
    await askedForApple()
    act(() => deletion.continueWithApple())
    await waitFor(() => expect(shown()).toBe('account page: refused'))
    expect(deletion.state).toEqual({
      step: 'refused',
      choice: 'wholeAccount',
      cause: new AppleNotRevoked(reason),
    })
    expect((deletion.state as { cause: AppleNotRevoked }).cause.reason).toBe(
      reason,
    )
    expect(state.order).toEqual(['reload', 'check', 'apple'])
    expect(leave).not.toHaveBeenCalled()
  })

  test('shows the popup step while Apple is open', async () => {
    const apple = deferred()
    state.apple = () => apple.promise.then(() => 'continue' as const)
    await askedForApple()
    act(() => deletion.continueWithApple())
    await waitFor(() => expect(shown()).toBe('account page: revokingApple'))
    apple.resolve()
    await waitFor(() => expect(leave).toHaveBeenCalledWith('/'))
  })

  test('never opens Apple for an account that changed while it waited', async () => {
    await askedForApple()
    state.user = clerkUser({ id: 'user_2' })
    act(() => deletion.continueWithApple())
    await waitFor(() => expect(shown()).toBe('account page: refused'))
    expect((deletion.state as { cause: unknown }).cause).toBeInstanceOf(
      AccountChanged,
    )
    expect(state.order).toEqual(['reload', 'check'])
  })

  test('a sign-in gone old during Apple deletes nothing', async () => {
    state.recent = [true, false]
    state.dialog = ['cancel']
    await askedForApple()
    act(() => deletion.continueWithApple())
    await waitFor(() => expect(shown()).toBe('account page: idle'))
    expect(state.order).not.toContain('purge')
  })

  test("Gather's data only never asks Apple", async () => {
    mount()
    act(() => deletion.start('gatherData'))
    await waitFor(() => expect(leave).toHaveBeenCalled())
    expect(state.order).not.toContain('apple')
  })

  test('an origin Apple does not know deletes without asking, as before', async () => {
    state.appleReturnUrl = null
    mount()
    act(() => deletion.start('wholeAccount'))
    await waitFor(() => expect(leave).toHaveBeenCalledWith('/'))
    expect(state.order).toEqual(['reload', 'check', 'purge', 'clerk'])
  })
})
