/**
 * Deleting the account on the web, run from above the signed-in tree.
 *
 * The phone's `AccountDeleteProvider`
 * (`apps/mobile/src/features/account/delete/`), on the same server path and
 * with the same states; read its header first. In short: deletion is Convex
 * first, Clerk second (ADR-0032). `accounts.deleteAccount` schedules the purge,
 * and from then on nothing the signed-in tree shows is true. Worse, keeping it
 * mounted would let `ensureUser` (in `routes/_app.tsx`) provision a fresh
 * account into the gap the purge leaves once the `users` row goes. So this
 * provider sits above that gate and, once the purge has started, draws
 * `underway` instead of it. A Clerk refusal after that point is the stranded
 * state: the data is going and the login is not, with Try again and Sign out.
 *
 * Two things differ from the phone:
 *
 * - **A recent sign-in comes first.** Clerk deletes a login only within ten
 *   minutes of the strongest sign-in factor (its "sensitive actions"), and a
 *   browser tab stays signed in for days. Finding that out after the purge
 *   would strand every such account, so the check runs before anything is
 *   deleted, with Clerk's own verify dialog when the sign-in is older than half
 *   that window (Foundry learnt this in APP-34). `user.delete()` is wrapped
 *   too, in case a slow purge outlasts the window.
 * - **No Apple revocation.** The phone revokes the Sign in with Apple grant
 *   from the native sheet (APP-213). The web would need Apple JS with the web
 *   Services ID and server support for it, which `accounts.revokeAppleSignIn`
 *   does not have; the web deletes the account unrevoked, as Android does.
 *
 * Every Clerk step re-checks that the signed-in user and session are still the
 * ones that confirmed, and the purge names that user (`expectedSubject`), so a
 * sign-in to another account in another tab is never what gets deleted.
 *
 * The stranded state is held in memory, like the phone's: a reload loses it.
 */
import { useClerk, useReverification, useUser } from '@clerk/react'
import { isReverificationCancelledError } from '@clerk/react/errors'
import { accountDeletion } from '@gather/core/account-deletion'
import { useMutation } from 'convex/react'
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react'
import { api } from '../../../convex/_generated/api'

/**
 * Where a deletion is.
 *
 * - **idle** — nothing has been asked for, or Clerk's verify dialog was
 *   dismissed.
 * - **confirmingSignIn** — asking Clerk for a recent sign-in; nothing is
 *   deleted yet.
 * - **purging** — waiting for `accounts.deleteAccount`.
 * - **refused** — the sign-in check or the purge refused. Nothing has been
 *   deleted, and the Account page is still there to say so.
 * - **deletingLogin** — the purge is scheduled; waiting for Clerk.
 * - **stranded** — Clerk refused after the purge: the data is going and the
 *   login is not.
 */
export type AccountDeleteState =
  | { step: 'idle' }
  | { step: 'confirmingSignIn' }
  | { step: 'purging' }
  | { step: 'refused'; cause: unknown }
  | { step: 'deletingLogin' }
  | { step: 'stranded' }

/** Whether the purge has started, after which the signed-in tree is gone. */
export function purgeStarted(state: AccountDeleteState): boolean {
  return state.step === 'deletingLogin' || state.step === 'stranded'
}

export interface AccountDeleteValue {
  state: AccountDeleteState
  /** Delete the account. Does nothing unless Clerk allows self-deletion, or
   * while a deletion is already running. */
  start: () => void
  /** Ask Clerk again after it refused. The purge is not repeated: it is
   * already running, and its `users` row may already be gone. */
  retryLogin: () => void
  /** Sign out, from the stranded state. */
  signOut: () => void
}

/** The sign-in check failed for a reason the page can name. */
export class SignInNotConfirmed extends Error {}
/** Another account or session is signed in than the one that confirmed. */
export class AccountChanged extends Error {}

/**
 * Clerk's reverification hint (`reverificationError('strict')` in
 * `@clerk/shared`): `useReverification` answers it with Clerk's verify dialog
 * and then calls the wrapped function once more.
 */
const NEEDS_RECENT_SIGN_IN = {
  clerk_error: {
    type: 'forbidden',
    reason: 'reverification-error',
    metadata: { reverification: 'strict' },
  },
} as const

/** Half of Clerk's ten-minute window, so it cannot lapse during the purge. */
const RECENT_SIGN_IN = {
  reverification: { level: 'second_factor', afterMinutes: 5 },
} as const

/** The Clerk account and session the person confirmed the deletion in. */
type Confirmed = { userId: string; sessionId: string }

/** Where the browser goes once the account is gone. */
const SIGNED_OUT_HOME = '/'

const AccountDeleteContext = createContext<AccountDeleteValue | null>(null)

export function useAccountDelete(): AccountDeleteValue {
  const value = use(AccountDeleteContext)
  if (!value) {
    throw new Error('useAccountDelete must be used within AccountDeleteProvider')
  }
  return value
}

export interface AccountDeleteProviderProps {
  children: ReactNode
  /** Drawn in place of `children` once the purge has started. */
  underway: (value: AccountDeleteValue) => ReactNode
  /** Leaves the page once Clerk has deleted the login or the person signed
   * out. A full load, so nothing of the deleted account stays in memory. */
  leave?: (to: string) => void
}

function replaceLocation(to: string) {
  window.location.replace(to)
}

export function AccountDeleteProvider({
  children,
  underway,
  leave = replaceLocation,
}: AccountDeleteProviderProps) {
  const { user } = useUser()
  const clerk = useClerk()
  const deleteAccount = useMutation(api.accounts.deleteAccount)
  const [state, setState] = useState<AccountDeleteState>({ step: 'idle' })
  // Refs as well as the state, so a second click in the same frame cannot
  // start a second run, or a second Clerk call, before the first has rendered.
  const running = useRef(false)
  const askingClerk = useRef(false)
  const confirmed = useRef<Confirmed | null>(null)

  // Reads Clerk live rather than from a render: verifying replaces the
  // session object, and another tab can sign in someone else meanwhile.
  const sameAccount = useCallback(
    (account: Confirmed) =>
      clerk.user?.id === account.userId &&
      clerk.session?.id === account.sessionId,
    [clerk],
  )

  const confirmRecentSignIn = useReverification(async (account: Confirmed) => {
    if (!sameAccount(account)) throw new AccountChanged()
    // The sign-in age is only as fresh as the last session reload.
    await clerk.session?.reload()
    if (!sameAccount(account)) throw new AccountChanged()
    return clerk.session?.checkAuthorization(RECENT_SIGN_IN)
      ? true
      : NEEDS_RECENT_SIGN_IN
  })

  const deleteUser = useReverification(async (account: Confirmed) => {
    if (!sameAccount(account)) throw new AccountChanged()
    await clerk.user?.delete()
    return true
  })

  const deleteLogin = useCallback(async () => {
    if (askingClerk.current) return
    askingClerk.current = true
    setState({ step: 'deletingLogin' })
    try {
      const account = confirmed.current
      // No account here would leave the purge running with nobody told; it is
      // the same outcome as a refusal, and says so.
      if (!account) throw new Error('No confirmed account to delete')
      // Clerk retries once after its dialog and returns that answer as is:
      // anything but `true` is still a refusal.
      if ((await deleteUser(account)) !== true)
        throw new Error('Clerk still refused')
    } catch {
      setState({ step: 'stranded' })
      return
    } finally {
      askingClerk.current = false
    }
    leave(SIGNED_OUT_HOME)
  }, [deleteUser, leave])

  const start = useCallback(() => {
    if (
      !user ||
      !clerk.session ||
      running.current ||
      accountDeletion(user) !== 'allowed'
    )
      return
    running.current = true
    const account = { userId: user.id, sessionId: clerk.session.id }
    confirmed.current = account
    setState({ step: 'confirmingSignIn' })
    void (async () => {
      try {
        if ((await confirmRecentSignIn(account)) !== true)
          throw new SignInNotConfirmed()
      } catch (cause) {
        running.current = false
        // Closing Clerk's dialog is a cancel, like closing the confirmation.
        setState(
          isReverificationCancelledError(cause)
            ? { step: 'idle' }
            : { step: 'refused', cause },
        )
        return
      }
      setState({ step: 'purging' })
      try {
        // Bound to the account the person confirmed: if the session changed
        // while Clerk's dialog was up, Convex refuses and nothing is deleted.
        await deleteAccount({ expectedSubject: account.userId })
      } catch (cause) {
        running.current = false
        setState({ step: 'refused', cause })
        return
      }
      await deleteLogin()
    })()
  }, [user, clerk, confirmRecentSignIn, deleteAccount, deleteLogin])

  const retryLogin = useCallback(() => {
    if (state.step === 'stranded') void deleteLogin()
  }, [state.step, deleteLogin])

  const signOut = useCallback(() => {
    void clerk
      .signOut()
      .catch(() => {
        // Leaving reloads the page; Clerk asks again if a session survived.
      })
      .finally(() => leave(SIGNED_OUT_HOME))
  }, [clerk, leave])

  const value = useMemo(
    () => ({ state, start, retryLogin, signOut }),
    [state, start, retryLogin, signOut],
  )

  return (
    <AccountDeleteContext value={value}>
      {purgeStarted(state) ? underway(value) : children}
    </AccountDeleteContext>
  )
}
