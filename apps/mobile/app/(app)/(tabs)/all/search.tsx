import { type ErrorBoundaryProps, useLocalSearchParams } from 'expo-router'

import { SearchError } from '../../../../src/search/SearchError'
import { SearchScreen } from '../../../../src/search/SearchScreen'
import { isSearchModule } from '../../../../src/search/searchFilters'

/**
 * A Module's search (APP-613): the Search tab's screen, pushed inside All's
 * stack with that Module preset, so Back returns to the Module. An unknown
 * `module` opens it on All Modules rather than failing.
 */
export default function ModuleSearch() {
  const { module } = useLocalSearchParams<{ module?: string }>()
  return <SearchScreen preset={isSearchModule(module) ? module : undefined} />
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <SearchError error={error} retry={retry} />
}
