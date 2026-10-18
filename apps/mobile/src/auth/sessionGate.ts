/**
 * When the signed-in tree may render: the decision behind `ConvexSessionGate`,
 * kept free of React so the Node suite can walk it through a sign-in, a
 * sign-out and an account switch.
 *
 * Two signals, and neither is enough alone:
 *
 * - **Convex's `isAuthenticated`** says the websocket holds an accepted token.
 *   Clerk flips `isSignedIn` before that, and every query asked in the gap runs
 *   without identity.
 * - **The backend's own answer to "who am I"** (`users.me`). Convex's boolean
 *   describes *a* session, not *this* one: on an account switch it can stay
 *   `true` while the socket is still authenticated as the previous account, and
 *   every query in the tree would answer for them. Only an identity the backend
 *   derived from `ctx.auth` can say the token belongs to the Clerk user on
 *   screen.
 *
 * Once confirmed, the confirmation outlives the viewer query going briefly
 * `undefined` — Convex drops results while it recovers a socket, and closing
 * the gate for that would tear down every tab stack the Member had open. It does
 * not outlive Convex losing the session, or Clerk naming somebody else.
 */

/** The part of `users.me` the gate reads: who the backend thinks is asking. */
export interface BackendViewer {
  clerkId: string
}

/** The Clerk user the backend has vouched for, and the account it was asked
 * about. */
export interface SessionConfirmation {
  account: string | null
  confirmed: string | null
}

export const UNCONFIRMED: SessionConfirmation = {
  account: null,
  confirmed: null,
}

export interface SessionInput {
  /** Clerk's current user id; `null` signed out, `undefined` still loading. */
  account: string | null | undefined
  /** `useConvexAuth().isAuthenticated`. */
  isAuthenticated: boolean
  /** `users.me` — `undefined` while unanswered or skipped, `null` when the
   * caller has no `users` row yet. */
  viewer: BackendViewer | null | undefined
}

/**
 * Fold the latest signals into the confirmation. Returns `previous` itself when
 * nothing changed, so a component can adjust state during render and converge
 * in one pass.
 */
export function confirmSession(
  previous: SessionConfirmation,
  { account, isAuthenticated, viewer }: SessionInput,
): SessionConfirmation {
  const current = account ?? null
  // A different person, or no session at all: whatever was vouched for before
  // was about somebody else's token.
  const carried =
    isAuthenticated && previous.account === current ? previous.confirmed : null
  const confirmed = !isAuthenticated
    ? null
    : viewer === undefined
      ? carried
      : (viewer?.clerkId ?? null)
  if (previous.account === current && previous.confirmed === confirmed) {
    return previous
  }
  return { account: current, confirmed }
}

/** Whether the signed-in tree may render. */
export function isSessionOpen(
  { account, isAuthenticated }: Omit<SessionInput, 'viewer'>,
  confirmation: SessionConfirmation,
): boolean {
  return (
    typeof account === 'string' &&
    isAuthenticated &&
    confirmation.account === account &&
    confirmation.confirmed === account
  )
}
