import type { FunctionArgs } from 'convex/server'
import { useMemo } from 'react'

import { api } from '../convex/api'
import { useQueries } from '../convex/queries'
import type { serverFilters } from './searchFilters'
import type { QueryResult } from './searchResults'

type SearchArgs = FunctionArgs<typeof api.search.group>
type Answer = QueryResult[] | Error | undefined

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
 */
export function useGroupSearch(
  args: SearchArgs | null,
  filters: ReturnType<typeof serverFilters>,
): QueryResult[] | undefined {
  const narrowed = useSearch(args && filters ? { ...args, ...filters } : null)
  const usePlain =
    !filters ||
    narrowed instanceof Error ||
    (narrowed !== undefined && narrowed.length === 0)
  const plain = useSearch(args && usePlain ? args : null)
  if (!usePlain) return narrowed
  if (plain instanceof Error) throw plain
  return plain
}
