import { useLocation } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { NavItem } from '../../lib/appNavigation'
import { activeNavItemId, navItems } from '../../lib/appNavigation'
import { useMessages } from '../../lib/i18n'
import { useCurrentGroup } from './useCurrentGroup'

/**
 * The navigation, resolved once and shared by every surface that renders it.
 *
 * The sidebar and the dock read the same Pins, from the same Group, and get
 * the active item from the same predicate over the same full list. They are
 * not two implementations that happen to agree — there is only one answer, and
 * the dock merely shows less of it.
 *
 * The Group is the Current Group (ADR-0031), so the sidebar and dock stay drawn
 * on `/groups` and `/settings`. Which item is *active* is still decided against
 * the real pathname, so standing on `/groups` highlights nothing: the links are
 * there to go back with, not to claim you already did.
 */
export function useNavigation(): {
  items: NavItem[]
  activeId: string | null
} {
  const location = useLocation()
  const messages = useMessages()
  const { current } = useCurrentGroup()
  // Pins belong to a person *in a Group* (ADR-0005), and every item names a
  // page of the Current Group, so without one there is nothing to ask for and
  // nothing to list.
  const pins = useQuery(
    api.users.myPins,
    current ? { groupSlug: current.slug } : 'skip',
  )
  const items = current ? navItems(pins ?? undefined, messages) : []

  return { items, activeId: activeNavItemId(location.pathname, items) }
}
