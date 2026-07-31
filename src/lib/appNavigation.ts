/**
 * Navigation: Home, your pins, All — one list, two surfaces.
 *
 * The desktop sidebar and the mobile dock render the same items in the same
 * order, and ask the same function which one is active. That is the point of
 * this file existing: the previous shape had a "Today" block and a "Modules"
 * block that each built their own links, so "Tasks" appeared twice pointing at
 * two different places, one of which quietly left the Group you were in. Two
 * lists that have to agree eventually stop agreeing.
 *
 * Nothing here reads the URL for itself or talks to a backend — a caller hands
 * over the Group it is standing in and the Pins it was told about, and gets a
 * list back.
 */

import type { LinkProps } from '@tanstack/react-router'
import { groupLink, moduleLink } from './groupPaths'
import type { ModuleDef } from './modules'
import { MODULES, moduleById } from './modules'
import { pinnedModules } from './pins'

/** Where a navigation item points. */
export type NavDestination = Pick<
  LinkProps,
  'to' | 'params' | 'search' | 'hash'
>

export interface NavItem {
  /** `home`, `all`, or a Module's id — the same id the active route resolves to. */
  id: string
  label: string
  icon: string
  link: NavDestination
  /**
   * The Module's data is about you rather than the Group, so it reads the same
   * from every Group and nobody else can see it (ADR-0003). Marked wherever a
   * Module is listed, because "who can see this?" should never be a guess.
   */
  personal: boolean
  /** Declared but not built yet. */
  placeholder: boolean
}

export interface RouteContext {
  title: string
  subtitle: string
}

/** The item ids the Group itself owns, either side of the Pins. */
const HOME = 'home'
const ALL = 'all'

/** How many items the mobile dock has room for, Home and All included. */
export const DOCK_SLOTS = 5

/**
 * Where Home points from wherever you are standing.
 *
 * Inside a Group that is the Group's own landing page. On a flat route there is
 * no Group in the URL to land in, so it falls back to the legacy surface —
 * which is exactly the fallback that disappears with the flat routes in #24.
 */
export function homeDestination(groupSlug: string | null): NavDestination {
  return groupSlug ? groupLink(HOME, groupSlug) : { to: '/dashboard' }
}

function allDestination(groupSlug: string | null): NavDestination {
  return groupSlug
    ? groupLink(ALL, groupSlug)
    : { to: '/dashboard', hash: 'modules' }
}

function moduleItem(module: ModuleDef, groupSlug: string | null): NavItem {
  return {
    id: module.id,
    label: module.label,
    icon: module.icon,
    // The shell renders above both route trees, so this is the one kind of
    // link a route cannot build. `moduleLink` already knows how to keep you in
    // the Group you are in, and where to fall back when there is none.
    link: moduleLink(module, groupSlug),
    personal: module.scope === 'personal',
    placeholder: module.status === 'placeholder',
  }
}

/**
 * The whole navigation, in order: Home, the caller's pinned Modules in their
 * own order, then All.
 *
 * Takes the stored Pin ids rather than resolved Modules, so an id no Module
 * declares is dropped on the way in — a Pin left behind by a Module that no
 * longer exists cannot put a hole in somebody's sidebar.
 */
export function navItems(
  pins: readonly string[] | undefined,
  groupSlug: string | null,
): NavItem[] {
  return [
    {
      id: HOME,
      label: 'Home',
      icon: 'Home',
      link: homeDestination(groupSlug),
      personal: false,
      placeholder: false,
    },
    ...pinnedModules(pins).map((module) => moduleItem(module, groupSlug)),
    {
      id: ALL,
      label: 'All',
      icon: 'Grid2X2',
      link: allDestination(groupSlug),
      personal: false,
      placeholder: false,
    },
  ]
}

/**
 * The same list cut down to what a phone has room for: Home and All keep their
 * ends, and the pins in between lose their tail.
 *
 * Truncation is a rendering decision and nothing more — which item is active is
 * still decided against the full list by `activeNavItemId`, so the dock and the
 * sidebar cannot answer differently. The active pin is kept in the last pin
 * slot when it would otherwise have been dropped, so the answer they agree on
 * is also one the dock can show.
 */
export function dockNavItems(
  items: readonly NavItem[],
  activeId: string | null = null,
  slots: number = DOCK_SLOTS,
): NavItem[] {
  if (items.length <= slots) return [...items]

  const first = items[0]
  const last = items[items.length - 1]
  const middle = items.slice(1, -1)
  const shown = middle.slice(0, Math.max(slots - 2, 0))

  const active = middle.find((item) => item.id === activeId)
  if (active && shown.length > 0 && !shown.includes(active)) {
    shown[shown.length - 1] = active
  }

  return [first, ...shown, last]
}

/**
 * The navigation item a route belongs to — `home`, `all`, a Module id, or null
 * for somewhere the navigation does not describe.
 */
function navTargetOf(pathname: string): string | null {
  const path = normalizePath(pathname)
  const group = /^\/g\/[^/]+(\/.*)?$/.exec(path)

  if (group) {
    const segment = (group[1] ?? '').split('/').filter(Boolean)[0] ?? ''
    if (segment === '') return HOME
    if (segment === ALL) return ALL
    return MODULES.find((m) => moduleSegment(m) === segment)?.id ?? null
  }

  // The legacy flat surface, until #24 removes it.
  if (path === '/dashboard') return HOME
  return (
    MODULES.find((m) => path === m.path || path.startsWith(`${m.path}/`))?.id ??
    null
  )
}

/**
 * Which item to light up for a given route — the one predicate both the
 * sidebar and the dock call, so they cannot disagree about it.
 *
 * A Module nobody pinned is reached through All and listed on it, so All stays
 * lit while you are inside one. Pass the full list even from the dock: it is
 * the truncation, not the route, that the dock does differently.
 */
export function activeNavItemId(
  pathname: string,
  items: readonly NavItem[],
): string | null {
  const target = navTargetOf(pathname)
  if (!target) return null
  if (items.some((item) => item.id === target)) return target
  if (!moduleById(target)) return null
  return items.some((item) => item.id === ALL) ? ALL : null
}

const STATIC_ROUTE_CONTEXT: Record<string, RouteContext> = {
  '/groups': {
    title: 'Groups',
    subtitle: 'Manage sharing and membership.',
  },
  '/settings': {
    title: 'Settings',
    subtitle: 'Tune appearance and app preferences.',
  },
  '/account': {
    title: 'Account',
    subtitle: 'Manage your profile and sign-in details.',
  },
}

const OWN_ROUTE_CONTEXT: Record<string, RouteContext> = {
  [HOME]: {
    title: 'Home',
    subtitle: 'What your group has been up to.',
  },
  [ALL]: {
    title: 'All modules',
    subtitle: 'Every module in this group. Pin the ones you use.',
  },
}

export function getRouteContext(pathname: string): RouteContext {
  const staticContext = STATIC_ROUTE_CONTEXT[normalizePath(pathname)]
  if (staticContext) return staticContext

  const target = navTargetOf(pathname)
  const own = target ? OWN_ROUTE_CONTEXT[target] : undefined
  if (own) return own

  const module = target ? moduleById(target) : undefined
  if (module) return { title: module.label, subtitle: module.description }

  return {
    title: 'Gather',
    subtitle: 'Shared plans, modules, and context.',
  }
}

export function getModulesByStatus(): {
  live: ModuleDef[]
  placeholder: ModuleDef[]
} {
  return {
    live: MODULES.filter((module) => module.status === 'live'),
    placeholder: MODULES.filter((module) => module.status === 'placeholder'),
  }
}

/** The first path segment a Module occupies, flat or inside a Group. */
function moduleSegment(module: ModuleDef): string {
  return module.path.replace(/^\//, '').split('/')[0]
}

function normalizePath(pathname: string) {
  const withoutHash = pathname.split('#')[0]
  if (withoutHash.length > 1 && withoutHash.endsWith('/')) {
    return withoutHash.slice(0, -1)
  }
  return withoutHash || '/'
}
