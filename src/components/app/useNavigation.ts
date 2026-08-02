import { useLocation } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { NavItem } from '../../lib/appNavigation'
import { activeNavItemId, navItems } from '../../lib/appNavigation'
import { useShellGroup } from './ShellGroup'

/**
 * The navigation, resolved once and shared by every surface that renders it.
 *
 * The sidebar and the dock read the same Pins, from the same Group, and get
 * the active item from the same predicate over the same full list. They are
 * not two implementations that happen to agree — there is only one answer, and
 * the dock merely shows less of it.
 *
 * The Group comes off the address bar because the shell is rendered above both
 * route trees, and the URL is the only thing that says which Group you are in
 * (ADR-0002) — through `useShellGroup`, which on a route naming no Group at all
 * falls back to the last one it named rather than emptying the sidebar and
 * unmounting the dock on the way to `/groups`. Which item is *active* is still
 * decided against the real pathname, so standing on `/groups` highlights
 * nothing: the links are there to go back with, not to claim you already did.
 */
export function useNavigation(): {
  items: NavItem[]
  activeId: string | null
} {
  const location = useLocation()
  const me = useQuery(api.users.me)
  const { slug } = useShellGroup()
  const items = navItems(me?.pinnedModuleIds, slug)

  return { items, activeId: activeNavItemId(location.pathname, items) }
}
