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
 * over the Pins it was told about, and gets a list back.
 */

import type { Messages } from '@gather/core/messages'
import type { ModuleDef } from '@gather/core/modules'
import { MODULES, moduleById, moduleText } from '@gather/core/modules'
import { pinnedModules } from '@gather/core/pins'
import {
  type AppLink,
  indexSurfaceOf,
  linkTo,
  moduleLink,
  ROUTES,
} from './links'

/**
 * The strings this file needs to say what it is returning.
 *
 * Passed in rather than read from a hook: everything here is a plain function
 * over plain data, called from tests and from React alike, and importing the
 * i18n context would end that (ADR-0011). A narrow slice rather than the whole
 * tree, so the signature says which strings are actually involved.
 */
export type NavMessages = Pick<Messages, 'shell' | 'modules'>

export interface NavItem {
  /** `home`, `all`, or a Module's id — the same id the active route resolves to. */
  id: string
  label: string
  icon: string
  link: AppLink
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

function moduleItem(module: ModuleDef, messages: NavMessages): NavItem {
  return {
    id: module.id,
    label: moduleText(module, messages).label,
    icon: module.icon,
    link: moduleLink(module),
    personal: module.scope === 'personal',
    placeholder: module.status === 'placeholder',
  }
}

/**
 * The whole navigation of the Current Group, in order: Home, the caller's
 * pinned Modules in their own order, then All.
 *
 * Takes the stored Pin ids rather than resolved Modules, so an id no Module
 * declares is dropped on the way in — a Pin left behind by a Module that no
 * longer exists cannot put a hole in somebody's sidebar.
 *
 * Every item names a page of the Current Group, so with no Current Group there
 * is no list: the caller renders none, and the surfaces say so in words.
 */
export function navItems(
  pins: readonly string[] | undefined,
  messages: NavMessages,
): NavItem[] {
  return [
    {
      id: HOME,
      label: messages.shell.nav.home,
      icon: 'Home',
      link: linkTo(HOME),
      personal: false,
      placeholder: false,
    },
    ...pinnedModules(pins).map((module) => moduleItem(module, messages)),
    {
      id: ALL,
      label: messages.shell.nav.all,
      icon: 'Grid2X2',
      link: linkTo(ALL),
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
): NavItem[] {
  if (items.length <= DOCK_SLOTS) return [...items]

  const first = items[0]
  const last = items[items.length - 1]
  const middle = items.slice(1, -1)
  const shown = middle.slice(0, DOCK_SLOTS - 2)

  const active = middle.find((item) => item.id === activeId)
  if (active && shown.length > 0 && !shown.includes(active)) {
    shown[shown.length - 1] = active
  }

  return [first, ...shown, last]
}

/**
 * Which item to light up for a given route — the one predicate both the
 * sidebar and the dock call, so they cannot disagree about it.
 *
 * A Module nobody pinned is reached through All and listed on it, so All stays
 * lit while you are inside one. Pass the full list even from the dock: it is
 * the truncation, not the route, that the dock does differently.
 *
 * The router's `Link` makes its own claim on top: by default it marks a link
 * `aria-current="page"` when its address is a segment prefix of this page, and
 * that wins over the caller's props. It cannot light a second item, because
 * every item's address is an index surface and no index surface sits below
 * another, so a prefix match is always the item this function returns.
 * Nesting one index under another (Home back at `/g/<slug>`, say) would break
 * that; `Sidebar.test.tsx` models the router to catch it.
 */
export function activeNavItemId(
  pathname: string,
  items: readonly NavItem[],
): string | null {
  const target = indexSurfaceOf(pathname)
  if (!target) return null
  if (items.some((item) => item.id === target)) return target
  if (!moduleById(target)) return null
  return items.some((item) => item.id === ALL) ? ALL : null
}

/** Somewhere the jump-to palette can send you. */
export interface JumpTarget {
  id: string
  label: string
  link: AppLink
}

/**
 * The pages that are about you rather than a Group — Settings and the Groups
 * list — and read the same from everywhere. With no Current Group they are all
 * the palette can offer.
 */
export function shellJumpTargets(messages: NavMessages): JumpTarget[] {
  const nav = messages.shell.nav
  return [
    { id: 'settings', label: nav.settings, link: linkTo('settings') },
    { id: 'groups', label: nav.groups, link: linkTo('groups') },
  ]
}

/**
 * Everywhere the palette can jump to inside the Current Group, then the shell
 * pages.
 *
 * Every Module, not only the pinned ones — the palette is how you reach the
 * Module you did not pin without going through All first. Home and All are
 * the same links the sidebar and dock use.
 *
 * A Group's *own* settings are a different page from yours and are offered
 * under a label that says whose settings they are, because the two would
 * otherwise be one word meaning two things.
 */
export function jumpTargets(messages: NavMessages): JumpTarget[] {
  const nav = messages.shell.nav
  return [
    { id: HOME, label: nav.home, link: linkTo(HOME) },
    ...MODULES.map((module) => ({
      id: module.id,
      label: moduleText(module, messages).label,
      link: moduleLink(module),
    })),
    { id: ALL, label: nav.all, link: linkTo(ALL) },
    {
      id: 'groupSettings',
      label: nav.groupSettings,
      link: linkTo('groupSettings'),
    },
    ...shellJumpTargets(messages),
  ]
}

export function getRouteContext(
  pathname: string,
  messages: NavMessages,
): RouteContext {
  const routes = messages.shell.routes
  const shellPage = (['settings', 'account', 'groups'] as const).find(
    (surface) => ROUTES[surface] === normalizePath(pathname),
  )
  if (shellPage) return routes[shellPage]

  const target = indexSurfaceOf(pathname)
  if (target === HOME || target === ALL || target === 'groupSettings') {
    return routes[target]
  }

  const module = target ? moduleById(target) : undefined
  if (module) {
    const text = moduleText(module, messages)
    return { title: text.label, subtitle: text.description }
  }

  return routes.fallback
}

function normalizePath(pathname: string) {
  const withoutHash = pathname.split('#')[0]
  if (withoutHash.length > 1 && withoutHash.endsWith('/')) {
    return withoutHash.slice(0, -1)
  }
  return withoutHash || '/'
}
