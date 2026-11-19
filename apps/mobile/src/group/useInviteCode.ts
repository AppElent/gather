/**
 * The Current Group's invite code, or why it is not here yet.
 *
 * Read through `useQueries`, which hands a refusal back as an `Error` instead
 * of throwing it, so a code that cannot load fails this card and not the whole
 * Groups screen. A code that never answers (a stalled connection) counts as
 * failed after `INVITE_CODE_PATIENCE_MS`, rather than reading "Loading…"
 * forever (APP-362).
 *
 * Retry starts the wait again. The subscription stays open throughout, so a
 * code that arrives late, or after a reconnect, still replaces the failure.
 */
import { useEffect, useState } from 'react'

import { api } from '../convex/api'
import { useQueries } from '../convex/queries'

export const INVITE_CODE_PATIENCE_MS = 10_000

export type InviteCodeState =
  | { state: 'loading' }
  | { state: 'ready'; code: string }
  | { state: 'failed' }

export function useInviteCode(
  slug: string,
): InviteCodeState & { retry: () => void } {
  const [attempt, setAttempt] = useState(0)
  // Which wait ran out, so a new Group or a Retry starts with a fresh one.
  const [waitedOut, setWaitedOut] = useState<string | null>(null)
  const wait = `${slug}#${attempt}`
  const { code: answer } = useQueries({
    code: { query: api.groups.inviteCode, args: { slug } },
  })
  const pending = answer === undefined

  useEffect(() => {
    if (!pending) return
    const timer = setTimeout(() => setWaitedOut(wait), INVITE_CODE_PATIENCE_MS)
    return () => clearTimeout(timer)
  }, [pending, wait])

  useEffect(() => {
    if (answer instanceof Error)
      console.warn('[gather] invite code failed', answer)
  }, [answer])

  const retry = () => setAttempt((count) => count + 1)
  if (typeof answer === 'string') return { state: 'ready', code: answer, retry }
  if (answer instanceof Error || waitedOut === wait)
    return { state: 'failed', retry }
  return { state: 'loading', retry }
}
