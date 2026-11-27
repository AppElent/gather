/**
 * The filters on the search screen (APP-613): Module, Who, When, and the
 * Module's own (Status for Tasks).
 *
 * One screen serves the Search tab (the Module you tapped it from, else All;
 * APP-660) and every Module's search button (that Module preset). The Module filter decides what the server is
 * asked for (`typesFor`), because `search.group` keeps 30 rows and a Module
 * asked for by itself should get all 30. Who, When and Status go to the server
 * too (`serverFilters`, APP-633), and narrow the answer here again: that is
 * what filters an older server's rows, and the rows held meanwhile.
 *
 * Pure: the screen holds the state and passes `today` in.
 */
import { dayIn } from '@gather/core/civil-date'
import type { ModuleId } from '@gather/core/modules'
import {
  matchesRowFilters,
  type StatusFilter,
  type WhenFilter,
} from '@gather/core/search-filters'
import { isTastingKind, type TastingKind } from '@gather/core/tastings'

import type { SearchRecordType } from './recentRecords'

/**
 * The Modules a search can be narrowed to, in the order results are grouped
 * and the Module sheet lists them.
 */
export const SEARCH_MODULES = [
  'tasks',
  'notes',
  'recipes',
  'calendar',
  'loyalty-cards',
  'cheeses',
  'wines',
  'beers',
] as const satisfies readonly ModuleId[]

export type SearchModuleId = (typeof SEARCH_MODULES)[number]

export function isSearchModule(value: unknown): value is SearchModuleId {
  return SEARCH_MODULES.some((module) => module === value)
}

const TYPE_OF_MODULE = {
  tasks: 'task',
  notes: 'note',
  recipes: 'recipe',
  calendar: 'calendarEvent',
  'loyalty-cards': 'loyaltyCard',
  cheeses: 'tasting',
  wines: 'tasting',
  beers: 'tasting',
} as const satisfies Record<SearchModuleId, SearchRecordType>

/** A tasting Kind's Module, typed as one a search can be narrowed to. */
const MODULE_OF_KIND = {
  cheese: 'cheeses',
  wine: 'wines',
  beer: 'beers',
} as const satisfies Record<TastingKind, SearchModuleId>

export function searchModuleOfKind(kind: TastingKind): SearchModuleId {
  return MODULE_OF_KIND[kind]
}

/**
 * The tasting Kind a Module stands for, sent with the search so one tasting
 * Module's results are not crowded out of the 30 by the others'. Null for a
 * Module that is not a tasting one, and for All.
 */
export function searchKindOf(module: SearchModuleId | null): TastingKind | null {
  for (const [kind, each] of Object.entries(MODULE_OF_KIND))
    if (each === module && isTastingKind(kind)) return kind
  return null
}

/** The fields of a result or a recent the filters read. */
export type FilterableRecord = {
  type: SearchRecordType
  kind?: string
  dueDate?: string
  date?: string
  done?: boolean
  createdBy?: string
  creationTime?: number
}

/** The Module a record belongs to; a tasting's is its Kind's. */
export function moduleOf(record: FilterableRecord): SearchModuleId | null {
  switch (record.type) {
    case 'task':
      return 'tasks'
    case 'note':
      return 'notes'
    case 'recipe':
      return 'recipes'
    case 'calendarEvent':
      return 'calendar'
    case 'loyaltyCard':
      return 'loyalty-cards'
    case 'tasting':
      return isTastingKind(record.kind) ? MODULE_OF_KIND[record.kind] : null
  }
}

/** The Modules this build shows that a search can be narrowed to. */
export function searchModulesShown(
  shown: (moduleId: ModuleId) => boolean,
): SearchModuleId[] {
  return SEARCH_MODULES.filter(shown)
}

/**
 * The types to ask `search.group` for: the one Module's, or every shown
 * Module's when the filter is All.
 */
export function typesFor(
  module: SearchModuleId | null,
  shown: (moduleId: ModuleId) => boolean,
): SearchRecordType[] {
  const modules = module ? [module] : searchModulesShown(shown)
  return [...new Set(modules.map((each) => TYPE_OF_MODULE[each]))]
}

export type SearchFilters = {
  module: SearchModuleId | null
  /** A Member's user id. */
  who: string | null
  when: WhenFilter | null
  status: StatusFilter | null
}

export function initialFilters(
  module: SearchModuleId | null = null,
): SearchFilters {
  return { module, who: null, when: null, status: null }
}

/** The filters a Module adds after the shared ones. */
export function moduleFilters(module: SearchModuleId | null): 'status'[] {
  return module === 'tasks' ? ['status'] : []
}

/**
 * Another Module, keeping the shared filters and dropping the old Module's
 * own: Status means nothing once the filter is Notes. The query is the
 * screen's and is never touched here.
 */
export function withModule(
  filters: SearchFilters,
  module: SearchModuleId | null,
): SearchFilters {
  return {
    ...filters,
    module,
    status: moduleFilters(module).includes('status') ? filters.status : null,
  }
}

/** Whether one record passes every filter. */
export function matchesFilters(
  record: FilterableRecord,
  filters: SearchFilters,
  today: string,
  timeZone?: string,
): boolean {
  if (filters.module && moduleOf(record) !== filters.module) return false
  return matchesRowFilters(record, filters, { today, dayAt: dayIn(timeZone) })
}

export function applyFilters<T extends FilterableRecord>(
  records: readonly T[],
  filters: SearchFilters,
  today: string,
  timeZone?: string,
): T[] {
  const dayAt = dayIn(timeZone)
  return records.filter(
    (record) =>
      (!filters.module || moduleOf(record) === filters.module) &&
      matchesRowFilters(record, filters, { today, dayAt }),
  )
}

/** Whether anything beyond the Module narrows the results. */
export function narrowed(filters: SearchFilters): boolean {
  return Boolean(filters.who || filters.when || filters.status)
}

/**
 * Who, When and Status as `search.group` takes them; null when none is set.
 * `today` and the zone go along only with When, the one that reads them, so
 * the other filters' query does not change at midnight.
 */
export function serverFilters(
  filters: SearchFilters,
  today: string,
  timeZone: string,
) {
  if (!narrowed(filters)) return null
  return {
    ...(filters.who ? { createdBy: filters.who } : {}),
    ...(filters.when ? { when: filters.when, today, timeZone } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  }
}

/**
 * Results grouped per Module in `SEARCH_MODULES` order, each group keeping
 * the server's rank order. A record with no Module (a tasting without a
 * Kind) has nowhere to go and is left out, as it has no address either.
 */
export function groupByModule<T extends FilterableRecord>(
  records: readonly T[],
): { module: SearchModuleId; records: T[] }[] {
  const groups = new Map<SearchModuleId, T[]>()
  for (const record of records) {
    const module = moduleOf(record)
    if (!module) continue
    const group = groups.get(module)
    if (group) group.push(record)
    else groups.set(module, [record])
  }
  return SEARCH_MODULES.flatMap((module) => {
    const group = groups.get(module)
    return group ? [{ module, records: group }] : []
  })
}
