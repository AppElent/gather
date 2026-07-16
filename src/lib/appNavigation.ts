import type { ModuleDef } from './modules'
import { MODULES } from './modules'

export interface PrimaryArea {
  id: 'command-center' | 'tasks' | 'calendar' | 'modules'
  label: string
  icon: string
  path: string
  description: string
}

export interface MobileDockItem {
  id: 'home' | 'tasks' | 'calendar' | 'modules'
  label: string
  icon: string
  path: string
  activePaths: string[]
  activeHash?: string
  inactiveHash?: string
}

export interface RouteContext {
  title: string
  subtitle: string
}

export const PRIMARY_AREAS: PrimaryArea[] = [
  {
    id: 'command-center',
    label: 'Command Center',
    icon: 'MessagesSquare',
    path: '/dashboard',
    description: 'Group overview and next actions.',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: 'ListChecks',
    path: '/tasks',
    description: 'Shared to-dos and recurring responsibilities.',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: 'Calendar',
    path: '/calendar',
    description: 'Upcoming group events and reminders.',
  },
  {
    id: 'modules',
    label: 'Modules',
    icon: 'Grid2X2',
    path: '/dashboard#modules',
    description: 'All connected group modules.',
  },
]

export const MOBILE_DOCK_ITEMS: MobileDockItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: 'Home',
    path: '/dashboard',
    activePaths: ['/dashboard'],
    inactiveHash: '#modules',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: 'ListChecks',
    path: '/tasks',
    activePaths: ['/tasks'],
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: 'Calendar',
    path: '/calendar',
    activePaths: ['/calendar'],
  },
  {
    id: 'modules',
    label: 'Modules',
    icon: 'Grid2X2',
    path: '/dashboard#modules',
    activePaths: MODULES.filter(
      (module) => !['/tasks', '/calendar'].includes(module.path),
    ).map((module) => module.path),
    activeHash: '#modules',
  },
]

const STATIC_ROUTE_CONTEXT: Record<string, RouteContext> = {
  '/dashboard': {
    title: 'Command Center',
    subtitle: 'A shared view of group plans, modules, and next actions.',
  },
  '/groups': {
    title: 'Groups',
    subtitle: 'Manage sharing, membership, and active group setup.',
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

export function getRouteContext(pathname: string): RouteContext {
  const normalized = normalizePath(pathname)
  const staticContext = STATIC_ROUTE_CONTEXT[normalized]
  if (staticContext) return staticContext

  const module = MODULES.find(
    (item) =>
      normalized === item.path || normalized.startsWith(`${item.path}/`),
  )

  if (module) {
    return {
      title: module.label,
      subtitle: module.description,
    }
  }

  return {
    title: 'Gather',
    subtitle: 'Group plans, modules, and shared context.',
  }
}

export function isDockItemActive(
  location: string | { pathname: string; hash?: string },
  item: MobileDockItem,
): boolean {
  const { pathname, hash } = normalizeLocation(location)

  if (
    item.activeHash &&
    pathname === '/dashboard' &&
    hash === item.activeHash
  ) {
    return true
  }

  if (
    item.inactiveHash &&
    pathname === '/dashboard' &&
    hash === item.inactiveHash
  ) {
    return false
  }

  return item.activePaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
}

export function isPrimaryAreaActive(
  location: string | { pathname: string; hash?: string },
  item: PrimaryArea,
): boolean {
  const { pathname, hash } = normalizeLocation(location)

  if (item.id === 'modules') {
    return pathname === '/dashboard' && hash === '#modules'
  }

  if (item.id === 'command-center') {
    return pathname === '/dashboard' && hash !== '#modules'
  }

  return pathname === item.path || pathname.startsWith(`${item.path}/`)
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

function normalizePath(pathname: string) {
  const withoutHash = pathname.split('#')[0]
  if (withoutHash.length > 1 && withoutHash.endsWith('/')) {
    return withoutHash.slice(0, -1)
  }
  return withoutHash || '/dashboard'
}

function normalizeLocation(
  location: string | { pathname: string; hash?: string },
) {
  if (typeof location === 'string') {
    const [pathname, hash = ''] = location.split('#')
    return { pathname: normalizePath(pathname), hash: hash ? `#${hash}` : '' }
  }

  return {
    pathname: normalizePath(location.pathname),
    hash: normalizeHash(location.hash ?? ''),
  }
}

function normalizeHash(hash: string) {
  return hash ? (hash.startsWith('#') ? hash : `#${hash}`) : ''
}
