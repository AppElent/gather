/**
 * Where dismissing search puts you back.
 *
 * iOS models search as a **mode over the page you were on**, not as a place you
 * go: `role: 'search'` is what makes iOS 26 draw the Search tab as a detached
 * item rather than a fifth peer, and Photos' dismiss throws the search page away
 * and returns you to the Library. gather's routing says the opposite — Search is
 * one of five destinations — so cancel would otherwise have nowhere to land and
 * you would sit on an emptied Search screen.
 *
 * This is the missing half: the tab you came from, remembered on the way in.
 *
 * A wrong guess costs one tap. gather's Search spans every Module, so unlike
 * Photos it has no home of its own to fall back to — "the tab you came from" is
 * the best answer available, and `home` is the answer when there isn't one
 * (a cold start straight onto `/search` via a deep link).
 *
 * Module-level state rather than a context, matching [[searchFocus]]: the two
 * ends are a route layout and a screen, and threading a provider between them to
 * carry one string is more machinery than the string is worth.
 */
import { isTastingKind } from '@gather/core/tastings'

import type { ShellTab } from '../shell/tabs'
import {
  isSearchModule,
  type SearchModuleId,
  searchModuleOfKind,
} from './searchFilters'

/** The tabs you can be standing on. `add` opens a sheet and is never a page. */
export type OriginTab = Exclude<ShellTab['name'], 'search' | 'add'>

/**
 * Typed as a `Record` rather than an array so a sixth tab fails `pnpm typecheck`
 * here instead of silently never being returned to.
 */
const ORIGIN_TABS: Record<OriginTab, true> = {
  home: true,
  settings: true,
  all: true,
}

const FALLBACK: OriginTab = 'home'

/** Which tab a pathname belongs to, or `null` for Search and for anything else. */
export function originTabFor(pathname: string): OriginTab | null {
  const segment = pathname.split('/')[1]
  return segment && Object.hasOwn(ORIGIN_TABS, segment)
    ? (segment as OriginTab)
    : null
}

/**
 * The Module search can be narrowed to that a pathname stands in, or `null`
 * (APP-660). Modules live under All as `/all/<module>/...`, a detail screen
 * included; the tasting Modules share `/all/tasting/<kind>/...`, so theirs is
 * the Kind's. Home, Settings, the All grid, a pushed `/all/search` and every
 * Module search does not cover answer `null`.
 */
export function searchModuleFor(pathname: string): SearchModuleId | null {
  const [, tab, segment, kind] = pathname.split('/')
  if (tab !== 'all') return null
  if (segment === 'tasting')
    return isTastingKind(kind) ? searchModuleOfKind(kind) : null
  return isSearchModule(segment) ? segment : null
}

let origin: OriginTab | null = null

/**
 * The page you were on outside Search, as the Search tab reads it on the way
 * in: its Module (APP-660) and a count that moves with every page.
 *
 * The count is what tells "you came back" from "you tapped Search again while
 * on it": the Search stack stays mounted, and a Module the person chose by
 * hand is only replaced on a fresh arrival, even one from the same Module.
 */
export type SearchArrival = { visit: number; module: SearchModuleId | null }

let arrival: SearchArrival = { visit: 0, module: null }

/** Ignores `/search` itself, so entering search does not erase where you were. */
export function rememberSearchOrigin(pathname: string) {
  const tab = originTabFor(pathname)
  if (!tab) return
  origin = tab
  arrival = { visit: arrival.visit + 1, module: searchModuleFor(pathname) }
}

export function searchArrival(): SearchArrival {
  return arrival
}

export function searchOrigin(): OriginTab {
  return origin ?? FALLBACK
}
