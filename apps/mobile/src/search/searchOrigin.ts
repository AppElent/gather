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
  type SearchFilters,
  type SearchModuleId,
  searchModuleOfKind,
  withModule,
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
 * The Module of the page you were last on outside Search, and the Group it
 * belongs to (APP-660). The Search tab reads it on the way in; a Module
 * remembered in another Group answers `null`, so a Group switch or fallback
 * that remounts Search does not carry the old Group's Module across.
 */
let originModule: { module: SearchModuleId | null; groupSlug: string } | null =
  null

/** Ignores `/search` itself, so entering search does not erase where you were. */
export function rememberSearchOrigin(pathname: string, groupSlug: string) {
  const tab = originTabFor(pathname)
  if (!tab) return
  origin = tab
  originModule = { module: searchModuleFor(pathname), groupSlug }
}

/** The Module the Search tab should start on in this Group, or All (`null`). */
export function searchOriginModule(groupSlug: string): SearchModuleId | null {
  return originModule?.groupSlug === groupSlug ? originModule.module : null
}

/**
 * The filters after a tap on the Search tab (APP-660). `applied` is the origin
 * Module they were last set from: coming from a different one (All counts as
 * one) selects it, keeping the query and the shared filters; coming from the
 * same one, or tapping while already on Search, keeps whatever the person
 * chose since.
 */
export function filtersOnArrival(
  filters: SearchFilters,
  applied: SearchModuleId | null,
  from: SearchModuleId | null,
): SearchFilters {
  return from === applied ? filters : withModule(filters, from)
}

export function searchOrigin(): OriginTab {
  return origin ?? FALLBACK
}
