/**
 * `users.me`: who the backend says is signed in, derived from `ctx.auth`.
 *
 * This is the identity the Convex query caching standard has the cache
 * provider wait for, so it is read with Convex's own hook, outside the cache
 * (`convex/queries.ts`) and exempt from the Biome rule that sends every other
 * read through it. A retained copy could only ever describe a previous socket.
 *
 * A failure is thrown as the error `SessionIdentityBoundary` recovers from
 * rather than as whatever Convex threw.
 */
import { type RequestForQueries, useQueries } from 'convex/react'
import { useMemo } from 'react'

import { api } from '../../../../convex/_generated/api'
import type { Doc } from '../../../../convex/_generated/dataModel'
import { SessionIdentityError } from './SessionIdentityBoundary'

export function useViewer(enabled: boolean): Doc<'users'> | null | undefined {
  // Memoised: `useQueries` keys its subscription on this object's identity,
  // and a fresh one every render re-subscribes in a render loop.
  const queries = useMemo((): RequestForQueries => {
    if (!enabled) return {}
    return { me: { query: api.users.me, args: {} } }
  }, [enabled])
  const { me } = useQueries(queries)
  if (me instanceof Error) throw new SessionIdentityError(me)
  return me as Doc<'users'> | null | undefined
}
