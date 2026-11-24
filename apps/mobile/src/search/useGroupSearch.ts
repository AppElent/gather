import type { FunctionArgs } from 'convex/server'
import { useEffect, useMemo, useRef } from 'react'

import { api } from '../convex/api'
import { useQueries } from '../convex/queries'
import type { serverFilters } from './searchFilters'
import type { QueryResult } from './searchResults'

type SearchArgs = FunctionArgs<typeof api.search.group>
type Answer = QueryResult[] | Error | undefined
type Held = {
  key: string
  plain: QueryResult[] | undefined
  last: QueryResult[] | undefined
}

/** One search as a batched request, so its error is a value and not a throw. */
function useSearch(args: SearchArgs | null): Answer {
  const key = args ? JSON.stringify(args) : null
  const requests = useMemo(
    () =>
      key === null
        ? {}
        : {
            rows: {
              query: api.search.group,
              args: JSON.parse(key) as SearchArgs,
            },
          },
    [key],
  )
  return useQueries(requests as Parameters<typeof useQueries>[0]).rows as Answer
}

/**
 * The rows for one search, narrowed by the server where it can (APP-633).
 *
 * When the filtered search has no rows to give, the plain one answers and the
 * screen filters it, as it did before the server could. That is the case when:
 *
 * - it failed: a server from before APP-633 refuses arguments it does not
 *   know, and one may not know this phone's time zone. When the plain search
 *   fails as well, that throws to the screen's error boundary.
 * - it found nothing: the plain rows tell "nothing with these filters" from
 *   "nothing at all", which offer different ways back.
 *
 * While a new query for the same search (`args`) is loading — or offline and
 * unable to answer — this returns the last plain rows seen for that search
 * when available, or otherwise the previous rows seen for it (APP-759). The
 * screen filters those locally instead of flashing a loading skeleton, without
 * keeping a second plain subscription open.
 */
export function useGroupSearch(
  args: SearchArgs | null,
  filters: ReturnType<typeof serverFilters>,
): QueryResult[] | undefined {
  const argsKey = args ? JSON.stringify(args) : null
  const narrowed = useSearch(args && filters ? { ...args, ...filters } : null)
  const usePlain =
    !filters ||
    narrowed instanceof Error ||
    (narrowed !== undefined && narrowed.length === 0)
  const plain = useSearch(args && usePlain ? args : null)

  const held = useRef<Held | null>(null)
  const same =
    argsKey !== null && held.current?.key === argsKey ? held.current : null
  const livePlain = plain instanceof Error ? undefined : plain
  const liveNarrowed = narrowed instanceof Error ? undefined : narrowed
  const live = usePlain ? livePlain : liveNarrowed
  const nextPlain = livePlain ?? same?.plain
  const nextLast = live ?? same?.last

  useEffect(() => {
    if (
      argsKey === null ||
      (nextPlain === undefined && nextLast === undefined)
    ) {
      held.current = null
    } else {
      held.current = { key: argsKey, plain: nextPlain, last: nextLast }
    }
  }, [argsKey, nextPlain, nextLast])

  if (usePlain && plain instanceof Error) throw plain
  if (argsKey === null) return undefined
  if (live !== undefined) return live
  return nextPlain ?? nextLast
}
