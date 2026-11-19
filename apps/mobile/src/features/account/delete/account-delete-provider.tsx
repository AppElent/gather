/**
 * Deleting the account, run from above the signed-in tree.
 *
 * Deletion is Convex first, Clerk second (ADR-0032), and the first step is
 * the one that takes the screen away: `accounts.deleteAccount` schedules the
 * purge, the purge empties `groups.myGroups`, and `GroupProvider` replaces the
 * whole tree — the delete screen with it — with the no-Group screen. Clerk's
 * `user.delete()` is still in flight at that moment. A refusal that lands
 * after it would be set on a screen that no longer exists, while the
 * household is already gone (#233).
 *
 * So the run lives here, in `(app)/_layout`, above `ConvexSessionGate` and
 * `GroupProvider`, and the delete screen only starts it and reads it. Once
 * the purge has started this provider stops drawing the signed-in tree at all
 * and draws `underway` instead: nothing below it is true any more, and
 * keeping it mounted would let `ensureUser` provision a fresh account into
 * the gap the purge leaves (`users.deletedAt` goes with the `users` row). From
 * then on the only ways out are Clerk agreeing, which signs out, or the
 * person signing out themselves.
 *
 * Before any of it, an account linked to Sign in with Apple has its Apple
 * grant revoked (`apple-revocation.ts`, APP-213): Clerk does not do it, and
 * the purge would leave nobody authenticated to ask. Backing out of the Apple
 * sheet cancels the deletion with nothing deleted.
 *
 * The stranded state is held in memory, so it lasts while the app is open and
 * signed in. Quitting the app, or Clerk ending the session, loses it.
 *
 * **Two choices (APP-397).** Gather shares its Clerk login with the other
 * AppElent apps, so `start` takes what to delete. `gatherData` runs the same
 * purge with `keepLogin` and nothing else: no Apple revocation and no
 * `user.delete()`, because the login (and its Apple grant) is the other apps'
 * too, and no `deleteSelfEnabled`, because nothing asks Clerk to delete
 * anything. It then signs out of this phone and says so
 * (`onGatherDataDeleted`). Signing in again starts a fresh, empty account.
 * `wholeAccount` is the run above.
 */
import { useUser } from '@clerk/expo'
import { accountDeletion } from '@gather/core/account-deletion'
import { useAction, useMutation } from 'convex/react'
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { useSignOut } from '../../../auth/useSignOut'
import { api } from '../../../convex/api'
import { revokeAppleSignIn } from './apple-revocation'

/** What the person chose to delete. */
export type DeleteChoice = 'gatherData' | 'wholeAccount'

/**
 * Where a deletion is.
 *
 * - **idle** — nothing has been asked for, or the Apple sheet was dismissed.
 * - **revokingApple** — revoking the Sign in with Apple grant; nothing is
 *   deleted yet.
 * - **purging** — waiting for `accounts.deleteAccount`.
 * - **refused** — the purge refused. Nothing has been deleted, and the delete
 *   screen is still there to say so.
 * - **deletingLogin** — the purge is scheduled; waiting for Clerk.
 * - **stranded** — Clerk refused after the purge: the data is going and the
 *   login is not.
 * - **signingOut** — Gather's data only: the purge is scheduled and the login
 *   stays; signing out of this phone.
 */
export type AccountDeleteState =
  | { step: 'idle' }
  | { step: 'revokingApple' }
  | { step: 'purging'; choice: DeleteChoice }
  | { step: 'refused'; choice: DeleteChoice; cause: unknown }
  | { step: 'deletingLogin' }
  | { step: 'stranded' }
  | { step: 'signingOut' }

/** Whether the purge has started, after which the signed-in tree is gone. */
export function purgeStarted(state: AccountDeleteState): boolean {
  return (
    state.step === 'deletingLogin' ||
    state.step === 'stranded' ||
    state.step === 'signingOut'
  )
}

export interface AccountDeleteValue {
  state: AccountDeleteState
  /** Delete Gather's data, or the whole account. Does nothing while a
   * deletion is already running, or for the whole account unless Clerk
   * allows self-deletion. */
  start: (choice: DeleteChoice) => void
  /** Ask Clerk again after it refused. The purge is not repeated: it is
   * already running, and its `users` row may already be gone. */
  retryLogin: () => void
}

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
  /** Says Gather's data is gone and the login still works elsewhere, once
   * this phone has signed out. Something that outlives this provider (an
   * alert), since signing out unmounts it. */
  onGatherDataDeleted: () => void
}

export function AccountDeleteProvider({
  children,
  underway,
  onGatherDataDeleted,
}: AccountDeleteProviderProps) {
  const { user } = useUser()
  const deleteAccount = useMutation(api.accounts.deleteAccount)
  const revokeApple = useAction(api.accounts.revokeAppleSignIn)
  const signOut = useSignOut()
  const [state, setState] = useState<AccountDeleteState>({ step: 'idle' })
  // Refs as well as the state, so a second tap in the same frame cannot start
  // a second run, or a second Clerk call, before the first has rendered.
  const running = useRef(false)
  const askingClerk = useRef(false)
  // The Apple sheet can stay up for as long as the person likes. If this
  // provider is gone by the time it closes (signed out, app torn down), the
  // person never saw the deletion through, so it does not go on to purge.
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const deleteLogin = useCallback(async () => {
    if (askingClerk.current) return
    askingClerk.current = true
    setState({ step: 'deletingLogin' })
    try {
      // No user here would leave the purge running with nobody told; it is
      // the same outcome as a refusal, and says so.
      if (!user) throw new Error('No Clerk user to delete')
      await user.delete()
    } catch {
      setState({ step: 'stranded' })
      return
    } finally {
      askingClerk.current = false
    }
    signOut()
  }, [user, signOut])

  const start = useCallback(
    (choice: DeleteChoice) => {
      if (!user || running.current) return
      // Only the whole account asks Clerk to delete anything, so only it
      // needs Clerk's permission to.
      if (choice === 'wholeAccount' && accountDeletion(user) !== 'allowed')
        return
      running.current = true
      void (async () => {
        if (choice === 'wholeAccount') {
          setState({ step: 'revokingApple' })
          const apple = await revokeAppleSignIn(user, revokeApple)
          if (!mounted.current) return
          if (apple === 'cancelled') {
            running.current = false
            setState({ step: 'idle' })
            return
          }
        }
        setState({ step: 'purging', choice })
        try {
          // Bound to the account the person confirmed: if the session changed
          // while the Apple sheet was up, Convex refuses and nothing is
          // deleted.
          await deleteAccount({
            expectedSubject: user.id,
            ...(choice === 'gatherData' ? { keepLogin: true } : {}),
          })
        } catch (cause) {
          running.current = false
          setState({ step: 'refused', choice, cause })
          return
        }
        if (choice === 'wholeAccount') {
          await deleteLogin()
          return
        }
        setState({ step: 'signingOut' })
        signOut()
        onGatherDataDeleted()
      })()
    },
    [user, deleteAccount, revokeApple, deleteLogin, signOut, onGatherDataDeleted],
  )

  const retryLogin = useCallback(() => {
    if (state.step === 'stranded') void deleteLogin()
  }, [state.step, deleteLogin])

  const value = useMemo(
    () => ({ state, start, retryLogin }),
    [state, start, retryLogin],
  )

  return (
    <AccountDeleteContext value={value}>
      {purgeStarted(state) ? underway(value) : children}
    </AccountDeleteContext>
  )
}
