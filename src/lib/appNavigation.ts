/**
 * Navigation: Home, your pins, All — one list, one predicate for which is
 * active.
 *
 * The desktop sidebar renders these items; at phone width the bar is the
 * phone's fixed destinations instead (`activeTab`). That this list exists once
 * is the point of this file: the previous shape had a "Today" block and a "Modules"
 * block that each built their own links, so "Tasks" appeared twice pointing at
 * two different places, one of which quietly left the Group you were in. Two
 * lists that have to agree eventually stop agreeing.
 *
 * Nothing here reads the URL for itself or talks to a backend — a caller hands
 * over the Pins it was told about, and gets a list back.
 */

import type { Messages } from '@gather/core/messages'
import type { ModuleDef, ModuleGroup } from '@gather/core/modules'
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
  /** Declared but not built yet. */
  placeholder: boolean
  /** A Module's group, whose tile it wears; none for Home and All. */
  group?: ModuleGroup
}

export interface RouteContext {
  title: string
  subtitle: string
}

/** The item ids the Group itself owns, either side of the Pins. */
const HOME = 'home'
const ALL = 'all'

function moduleItem(module: ModuleDef, messages: NavMessages): NavItem {
  return {
    id: module.id,
    label: moduleText(module, messages).label,
    icon: module.icon,
    link: moduleLink(module),
    placeholder: module.status === 'placeholder',
    group: module.group,
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
      placeholder: false,
    },
    ...pinnedModules(pins).map((module) => moduleItem(module, messages)),
    {
      id: ALL,
      label: messages.shell.nav.all,
      icon: 'Grid2X2',
      link: linkTo(ALL),
      placeholder: false,
    },
  ]
}

/**
 * Which item to light up for a given route.
 *
 * A Module nobody pinned is reached through All and listed on it, so All stays
 * lit while you are inside one.
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

/** The phone's destinations, as the bar below 768 px draws them (ADR-0018). */
export type Tab = 'home' | 'add' | 'settings' | 'all'

/**
 * Which tab of the phone-width bar is the page you are on. The bar has no
 * place for pins, so every Module page — pinned or not — belongs to All, as on
 * the phone. Pages that are no tab (Groups, Account, a Group's settings) light
 * none.
 */
export function activeTab(pathname: string): Tab | null {
  if (normalizePath(pathname) === ROUTES.settings) return 'settings'
  const target = indexSurfaceOf(pathname)
  if (target === HOME) return 'home'
  if (target === ALL || (target && moduleById(target))) return 'all'
  return null
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
 * the same links the sidebar and the tab bar use.
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

/**
 * The group whose colours a page wears: the Module's, from anywhere inside it,
 * and none on the shell's own pages (Start, All modules, settings), which stay
 * neutral. The shell puts it on the page as `data-group`.
 */
export function getRouteGroup(pathname: string): ModuleGroup | undefined {
  const target = indexSurfaceOf(pathname)
  return target ? moduleById(target)?.group : undefined
}

function normalizePath(pathname: string) {
  const withoutHash = pathname.split('#')[0]
  if (withoutHash.length > 1 && withoutHash.endsWith('/')) {
    return withoutHash.slice(0, -1)
  }
  return withoutHash || '/'
}
