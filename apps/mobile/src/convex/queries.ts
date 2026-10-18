/**
 * The phone's one query module: the `retention` flavor of the Convex query
 * caching standard (`docs/standards/convex-query-caching.md`), copied from its
 * starter. Screens import `useQuery`, `useQueries` and `usePaginatedQuery`
 * from here and never from `convex/react`; Biome refuses the direct import
 * everywhere but this file and the identity query (`auth/useViewer.ts`).
 *
 * After the last screen reading a query unmounts, its subscription stays open
 * for `EXPIRATION_MS`, at most `MAX_IDLE_ENTRIES` of them, so going back to a
 * tab answers from the socket's copy instead of a loading state. The values
 * are recorded in `CODING_STANDARDS.md` and apply to every query through the
 * one provider (`QueryCacheProvider.tsx`); there are no per-query lifetimes.
 *
 * `usePaginatedQuery` passes through unretained, as the standard says.
 *
 * The provider lives in its own file because it needs React Native's
 * `AppState`, and the pure modules that import these hooks are tested in Node.
 */
import { usePaginatedQuery } from 'convex/react'
import { useQueries, useQuery } from 'convex-helpers/react/cache'

export { usePaginatedQuery, useQueries, useQuery }

export const EXPIRATION_MS = 5 * 60_000
export const MAX_IDLE_ENTRIES = 20
