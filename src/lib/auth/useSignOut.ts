/**
 * Signing out of this session, and no other (APP-872).
 *
 * Clerk's `signOut()` without a `sessionId` ends every session in the browser,
 * so a second account signed in beside this one would go too. The phone does
 * the same since APP-824 (`apps/mobile/src/auth/useSignOut.ts`). Clerk ignores
 * the id when only one session is signed in, and then ends the client's
 * sessions as before.
 */
import { useClerk } from '@clerk/react'
import { useCallback } from 'react'

interface SignsOut {
  signOut: (options: { sessionId: string; redirectUrl?: string }) => Promise<unknown>
}

/** Ends the named session. Without one there is no session to end. */
export async function endSession(
  clerk: SignsOut,
  sessionId: string | undefined,
  redirectUrl?: string,
): Promise<void> {
  if (!sessionId) return
  await clerk.signOut(redirectUrl ? { sessionId, redirectUrl } : { sessionId })
}

/** Ends the session that is current when it is called. */
export function useSignOut(): () => Promise<void> {
  const clerk = useClerk()
  // Read live, so a session switched to since render is the one that ends.
  return useCallback(() => endSession(clerk, clerk.session?.id), [clerk])
}
