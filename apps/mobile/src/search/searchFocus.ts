/**
 * "The Search tab was tapped."
 *
 * `SearchScreen`'s other focus trigger is the pathname changing to `/search`,
 * which covers arriving from another tab and nothing else. This covers the rest:
 *
 * - **Android**, where dismissing search collapses the view in place and leaves
 *   you on `/search`. Tapping the tab again changes no path, so the effect
 *   cannot fire — and `autoFocus` is no help either, despite being the one prop
 *   `react-native-screens` marks Android-only, because the screen is already
 *   mounted. (On iOS, dismiss leaves the tab entirely; see `searchOrigin.ts`.)
 * - **The recents re-read**, on every arrival. Records are written by
 *   `useRecordRecent` on detail screens in other tabs, and Search's stack is
 *   Group-keyed so it does not remount on the way back. Doing it here rather
 *   than in the pathname effect is also what keeps the React Compiler's
 *   `set-state-in-effect` rule satisfied.
 *
 * A module-level emitter rather than a context: the two ends are a route layout
 * and a screen three files apart, and threading a provider between them to
 * carry one void event is more machinery than the event is worth.
 */
type Listener = () => void

const listeners = new Set<Listener>()

/** Ask whoever draws the search field to open it. */
export function requestSearchFocus() {
  for (const listener of listeners) listener()
}

export function onSearchFocusRequest(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
