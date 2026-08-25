/**
 * The one pending Drop, and where it waits.
 *
 * This provider sits at the root layout **above both gates** — above Clerk's
 * signed-in check and above `GroupProvider`'s pending/none screens — because a
 * share can arrive at an app that is signed out, or signed in but still asking
 * the backend which Groups exist. Holding the payload one layer above both is
 * what makes "share, sign in, and it is still there" fall out rather than be
 * built (ADR-0028).
 *
 * ## In memory, and one at a time
 *
 * Nothing here is persisted. An image Drop is a live local file URI that must
 * stay readable until it is uploaded, and a text Drop can be an entire article,
 * which has no business in a route param. Navigation carries a target id and
 * nothing else; the payload is read back out of here.
 *
 * A second arrival **replaces** the first. A Drop is a hand-off in progress,
 * not a queue: being walked through two shares you no longer remember sending
 * is worse than losing the one you abandoned.
 *
 * ## Arriving is not the same as being shown
 *
 * `sequence` counts arrivals so the gate below the auth and Group screens can
 * tell a Drop it has already opened the chooser for from a new one. Without it,
 * every remount of the signed-in tree would re-push the chooser for a Drop the
 * person is halfway through answering.
 */

import { useShareIntent } from 'expo-share-intent'
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { type Drop, dropFromShareIntent } from './drop'

export interface PendingDrop {
  drop: Drop
  /** Which arrival this is. Increments on every share, including a replacement. */
  sequence: number
}

export interface DropContextValue {
  pending: PendingDrop | null
  /**
   * Put a Drop in front of the app. Used by the share-intent bridge and by the
   * `gather://` harness that stands in for a share sheet no automation can
   * drive.
   */
  offer: (drop: Drop) => void
  /** The Drop is finished, or abandoned. Either way nothing is kept. */
  clear: () => void
}

const DropContext = createContext<DropContextValue | null>(null)

/**
 * The pending Drop. Returns a null `pending` rather than throwing when there is
 * none, because "no share is in flight" is the normal state of the app.
 */
export function useDrop(): DropContextValue {
  const value = use(DropContext)
  if (!value) throw new Error('useDrop must be used within a DropProvider')
  return value
}

export function DropProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingDrop | null>(null)

  const offer = useCallback((drop: Drop) => {
    setPending((current) => ({ drop, sequence: (current?.sequence ?? 0) + 1 }))
  }, [])

  const clear = useCallback(() => setPending(null), [])

  const value = useMemo(
    () => ({ pending, offer, clear }),
    [pending, offer, clear],
  )

  return (
    <DropContext value={value}>
      <ShareIntentBridge onDrop={offer} />
      {children}
    </DropContext>
  )
}

/**
 * The native side, kept to one component that renders nothing.
 *
 * `resetOnBackground` is left on: leaving the app and coming back is how
 * somebody abandons a share, and a payload that survived that would reappear
 * over whatever they went back to do.
 *
 * The intent is reset the moment it is read. The Drop lives in this provider
 * from then on, and a native payload that is still "held" would be offered
 * again on the next foreground.
 */
function ShareIntentBridge({ onDrop }: { onDrop: (drop: Drop) => void }) {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({
    debug: __DEV__,
  })

  useEffect(() => {
    if (!hasShareIntent) return
    const drop = dropFromShareIntent(shareIntent)
    // A share that carried nothing Gather can place is not an error worth
    // showing anybody — another app offered something and then sent nothing in
    // it. Reset and carry on as though it had not happened.
    if (drop) onDrop(drop)
    resetShareIntent()
  }, [hasShareIntent, shareIntent, resetShareIntent, onDrop])

  return null
}
