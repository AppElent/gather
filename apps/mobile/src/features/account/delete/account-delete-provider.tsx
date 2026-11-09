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
 * The stranded state is held in memory, so it lasts while the app is open and
 * signed in. Quitting the app, or Clerk ending the session, loses it.
 */
import { useUser } from '@clerk/expo'
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

import { useSignOut } from '../../../auth/useSignOut'
import { api } from '../../../convex/api'
import { accountDeletion } from '../../../settings/accountDeletion'

/**
 * Where a deletion is.
 *
 * - **idle** — nothing has been asked for.
 * - **purging** — waiting for `accounts.deleteAccount`.
 * - **refused** — the purge refused. Nothing has been deleted, and the delete
 *   screen is still there to say so.
 * - **deletingLogin** — the purge is scheduled; waiting for Clerk.
 * - **stranded** — Clerk refused after the purge: the data is going and the
 *   login is not.
 */
export type AccountDeleteState =
  | { step: 'idle' }
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
}

export function AccountDeleteProvider({
  children,
  underway,
}: AccountDeleteProviderProps) {
  const { user } = useUser()
  const deleteAccount = useMutation(api.accounts.deleteAccount)
  const signOut = useSignOut()
  const [state, setState] = useState<AccountDeleteState>({ step: 'idle' })
  // Refs as well as the state, so a second tap in the same frame cannot start
  // a second run, or a second Clerk call, before the first has rendered.
  const running = useRef(false)
  const askingClerk = useRef(false)

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

  const start = useCallback(() => {
    if (running.current || accountDeletion(user) !== 'allowed') return
    running.current = true
    setState({ step: 'purging' })
    void (async () => {
      try {
        await deleteAccount({})
      } catch (cause) {
        running.current = false
        setState({ step: 'refused', cause })
        return
      }
      await deleteLogin()
    })()
  }, [user, deleteAccount, deleteLogin])

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
