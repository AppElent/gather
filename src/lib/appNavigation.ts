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
    activePaths: MODULES.map((module) => module.path),
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
  pathname: string,
  item: MobileDockItem,
): boolean {
  const normalized = normalizePath(pathname)
  return item.activePaths.some(
    (path) => normalized === path || normalized.startsWith(`${path}/`),
  )
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
