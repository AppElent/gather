/**
 * What a Group switch does to the tab stacks (ADR-0015): every Group-scoped
 * stack goes back to a fresh copy of its root screen.
 *
 * ## Why this is navigation state and not a `key`
 *
 * The stacks used to be keyed by the Group's slug, which remounted them. On
 * Android that is a native crash (#235): unmounting a `ScreenStack` clears
 * each screen's container before the stack's own detach cleanup runs, so that
 * cleanup skips the screen's fragment and leaves it in the tab's
 * `FragmentManager`. The next time the tab is selected Android tries to put
 * the orphan back into a container that no longer exists — *"No view found
 * for id … for fragment ScreenStackFragment"*. react-native-screens fixed it
 * in 4.29 (software-mansion/react-native-screens#4504); Expo SDK 57 pins
 * 4.26. The native stacks therefore stay mounted for the app's lifetime, and
 * a switch resets what they show instead: screens come and go inside a stack
 * that is still attached, which is the path react-native-screens cleans up.
 *
 * Root routes are given new keys rather than kept, so the root screen
 * remounts too. Search's query and All's edit mode belong to the Group that
 * was on screen; a switch is a new place, not the old one re-labelled.
 *
 * Settings is not here: it is not Group-scoped, and keeps its place.
 */

/** The tabs whose stacks show one Group's content. */
export const GROUP_SCOPED_TABS = ['home', 'all', 'search'] as const

/** The slice of a navigator's state this reads; hand-typed for the same
 * reason as `SearchScreen`'s `Navigator`. */
export interface NavState {
  key: string
  type?: string
  index?: number
  routeNames?: string[]
  routes: NavRoute[]
  stale?: boolean
}

interface NavRoute {
  key?: string
  name: string
  params?: object
  state?: NavState
}

export interface UnwindAction {
  type: 'RESET'
  payload: NavState & { index: 0; stale: false; preloadedRoutes: [] }
  /** The stack's own key: a targeted action reaches a nested navigator from
   * anywhere in the tree. */
  target: string
}

/** The tab navigator: the only one in the tree whose state is a `tab`. */
function findTabs(state: NavState | undefined): NavState | undefined {
  if (!state) return undefined
  if (state.type === 'tab') return state
  for (const route of state.routes) {
    const found = findTabs(route.state)
    if (found) return found
  }
  return undefined
}

/**
 * One RESET per Group-scoped stack that has state, each back to its root
 * route with no key so the router mints a fresh one. The stack keeps its own
 * key and route names (`stale: false`), so the navigator is the same
 * navigator; only its screens change.
 */
export function groupUnwindActions(
  rootState: NavState | undefined,
  tabs: readonly string[] = GROUP_SCOPED_TABS,
): UnwindAction[] {
  const tabState = findTabs(rootState)
  if (!tabState) return []

  return tabState.routes.flatMap((route) => {
    const stack = route.state
    const root = stack?.routes[0]
    if (!tabs.includes(route.name) || !stack || !root) return []
    return [
      {
        type: 'RESET' as const,
        payload: {
          ...stack,
          index: 0 as const,
          stale: false as const,
          preloadedRoutes: [] as [],
          routes: [{ name: root.name, params: root.params }],
        },
        target: stack.key,
      },
    ]
  })
}
