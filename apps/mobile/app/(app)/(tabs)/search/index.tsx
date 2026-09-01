import type { ErrorBoundaryProps } from 'expo-router'

import { SearchError } from '../../../../src/search/SearchError'
import { SearchScreen } from '../../../../src/search/SearchScreen'

export default SearchScreen

/**
 * Convex's `useQuery` throws on the render path when the server refuses — a
 * Group whose access was revoked, a schema that moved. Without this the tab
 * spins forever or takes the app down; with it the header survives and the
 * reader gets a way back.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <SearchError error={error} retry={retry} />
}
