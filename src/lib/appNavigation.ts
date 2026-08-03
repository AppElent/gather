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
import {
  groupLink,
  groupSurfaceSegment,
  moduleLink,
  moduleSegment,
} from './groupPaths'
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

/**
 * The Group's own settings page. Not a navigation item — the sidebar and the
 * dock are Home, your Pins and All, and nothing else — but it is somewhere the
 * palette can jump to and something the topbar has to be able to name.
 */
const GROUP_SETTINGS = 'group-settings'

/** Read off the surface, so the id and the URL cannot drift apart. */
const GROUP_SETTINGS_SEGMENT = groupSurfaceSegment('settings')

/** How many items the mobile dock has room for, Home and All included. */
export const DOCK_SLOTS = 5

/**
 * What every navigation `<Link>` must pass, so the router stops answering a
 * question this file already answers.
 *
 * TanStack's `Link` decides for itself whether it points at the current page,
 * and by default it does so by *prefix* (`activeOptions.exact ?? false`). Home
 * points at `/g/<slug>`, which is a prefix of every other page in the Group —
 * so on `/g/<slug>/tasks` the router considered Home active, and its
 * `STATIC_ACTIVE_PROPS` are spread after the caller's own props, forcing
 * `aria-current="page"` onto Home no matter what we passed. The desktop sidebar
 * hid this by colouring itself from `activeId` instead, but the dock styles
 * `aria-[current=page]:`, so Home sat lit under every Module a phone opened.
 *
 * `exact` narrows the router's claim to the one case where it cannot be wrong —
 * the link *is* the page — and `activeNavItemId` keeps the rest, including the
 * two the router cannot know: `/g/<slug>/recipes/<id>` belongs to Recipes, and
 * a Module nobody pinned lights All.
 */
export const NAV_ACTIVE_OPTIONS = { exact: true } as const

/**
 * Where Home points: the landing page of the Group you are standing in.
 *
 * There is no answer without a Group. Home is *a Group's* shared surface
 * (CONTEXT.md), so a Home that belongs to no Group is not a page that was
 * removed — it is a page that never meant anything.
 */
export function homeDestination(groupSlug: string): NavDestination {
  return groupLink(HOME, groupSlug)
}

function allDestination(groupSlug: string): NavDestination {
  return groupLink(ALL, groupSlug)
}

function moduleItem(module: ModuleDef, groupSlug: string): NavItem {
  return {
    id: module.id,
    label: module.label,
    icon: module.icon,
    // The shell renders above the route it is showing, so this is the one kind
    // of link a route cannot build. `moduleLink` knows where each Module lives
    // inside the Group it is given.
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
 *
 * Empty off any Group route, and that is the honest answer rather than a
 * degraded one. Every item in this list — Home, a Module, All — names a page
 * inside a Group; with no Group named there is nothing here to point at, and
 * the surfaces that render it say so in words instead of showing rows that
 * would have to guess a Group to go to.
 */
export function navItems(
  pins: readonly string[] | undefined,
  groupSlug: string | null,
): NavItem[] {
  if (!groupSlug) return []

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
  // Every page the navigation describes is inside a Group. Settings, Account
  // and the Groups list are outside one on purpose, and the navigation says so
  // by lighting nothing.
  if (!group) return null

  const segment = (group[1] ?? '').split('/').filter(Boolean)[0] ?? ''
  if (segment === '') return HOME
  if (segment === ALL) return ALL
  if (segment === GROUP_SETTINGS_SEGMENT) return GROUP_SETTINGS
  return MODULES.find((m) => moduleSegment(m.id) === segment)?.id ?? null
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

/** Somewhere the jump-to palette can send you. */
export interface JumpTarget {
  id: string
  label: string
  link: NavDestination
}

/**
 * Everywhere the palette can jump to, from wherever you are standing.
 *
 * Every Module, not only the pinned ones — the palette is how you reach the
 * Module you did not pin without going through All first. Home and All come
 * from the same two functions the sidebar and dock use, so there is one
 * definition of where each points and the palette cannot drift from the
 * navigation beside it.
 *
 * The shell's own pages carry no Module id and so stay flat wherever you are:
 * Settings, Account and the Groups list are about you and read the same from
 * everywhere. They are also all that is left to offer off a Group route — every
 * other target here would have to invent a Group to be in.
 *
 * A Group's *own* settings are a different page and are offered separately,
 * under a label that says whose settings they are, because the two would
 * otherwise be one word meaning two things.
 */
export function jumpTargets(groupSlug: string | null): JumpTarget[] {
  const shellPages: JumpTarget[] = [
    { id: 'settings', label: 'Settings', link: { to: '/settings' } },
    { id: 'groups', label: 'Groups', link: { to: '/groups' } },
  ]
  if (!groupSlug) return shellPages

  return [
    { id: HOME, label: 'Home', link: homeDestination(groupSlug) },
    ...MODULES.map((module) => ({
      id: module.id,
      label: module.label,
      link: moduleLink(module, groupSlug),
    })),
    { id: ALL, label: 'All', link: allDestination(groupSlug) },
    {
      id: GROUP_SETTINGS,
      label: 'Group settings',
      link: groupLink('settings', groupSlug),
    },
    ...shellPages,
  ]
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
  [GROUP_SETTINGS]: {
    title: 'Group settings',
    subtitle: 'Settings everyone in this group shares.',
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

function normalizePath(pathname: string) {
  const withoutHash = pathname.split('#')[0]
  if (withoutHash.length > 1 && withoutHash.endsWith('/')) {
    return withoutHash.slice(0, -1)
  }
  return withoutHash || '/'
}
