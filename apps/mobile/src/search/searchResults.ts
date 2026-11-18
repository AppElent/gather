/**
 * Turning a server row into something openable.
 *
 * A result from `api.search.group` and a stored recent are the same thing at
 * different ages, so a row becomes a `RecentRecordInput` once — here — and
 * every screen below works from that one shape. The alternative, narrowing a
 * `QueryResult | RecentRecordInput` union at each use, is what let a
 * translated Kind label reach a route param.
 */
import { minutesToClock } from '@gather/core/civil-date'
import type { ModuleId } from '@gather/core/modules'
import { isTastingKind, TASTING_KIND_SPECS } from '@gather/core/tastings'
import type { Href } from 'expo-router'

import type { Messages } from '../i18n'
import {
  type RecentRecordInput,
  SEARCH_RECORD_TYPES,
  type SearchRecordType,
} from './recentRecords'

export type QueryResult = {
  id: string
  type: SearchRecordType
  title: string
  tags: string[]
  excerpt: string
  listName?: string
  dueDate?: string
  kind?: string
  calendarName?: string
  date?: string
  startMinutes?: number
  endMinutes?: number
  creationTime: number
}

function clock(value?: number) {
  return value === undefined
    ? null
    : minutesToClock(value)
}

/** The one-line subtitle. Display text in the reader's language, and only that. */
function detailOf(result: QueryResult, t: Messages) {
  switch (result.type) {
    case 'recipe':
      return result.tags.join(', ')
    case 'task':
      return [result.listName, result.dueDate].filter(Boolean).join(' - ')
    case 'note':
      return result.excerpt
    case 'tasting':
      return isTastingKind(result.kind) ? t.search.kinds[result.kind] : ''
    case 'loyaltyCard':
      // The holder, so two Bonuskaarten in one household tell apart.
      return result.excerpt
    default: {
      const start = clock(result.startMinutes)
      const end = clock(result.endMinutes)
      return [
        result.calendarName,
        result.date,
        start && end ? `${start}-${end}` : null,
      ]
        .filter(Boolean)
        .join(' - ')
    }
  }
}

export function toRecent(result: QueryResult, t: Messages): RecentRecordInput {
  return {
    id: result.id,
    type: result.type,
    title: result.title,
    detail: detailOf(result, t),
    ...(isTastingKind(result.kind) ? { kind: result.kind } : {}),
  }
}

/**
 * Where a record lives. Built from typed fields only — a tasting without a
 * Kind has no address, and says so, rather than guessing from its subtitle.
 */
export function hrefFor(record: RecentRecordInput): Href | null {
  // Under Search's own stack, not All's: pushing into another tab's stack
  // switches tabs, and Back then lands on that tab's root instead of on the
  // results the person came from.
  switch (record.type) {
    case 'recipe':
      return {
        pathname: '/search/recipes/recipe',
        params: { recipeId: record.id },
      }
    case 'task':
      return {
        pathname: '/search/tasks/task/[taskId]',
        params: { taskId: record.id },
      }
    case 'note':
      return {
        pathname: '/search/notes/[noteId]',
        params: { noteId: record.id },
      }
    case 'tasting':
      return record.kind
        ? {
            pathname: '/search/tasting/[kind]/subject',
            params: { kind: record.kind, subjectId: record.id },
          }
        : null
    case 'loyaltyCard':
      return {
        pathname: '/search/loyalty-cards/card',
        params: { cardId: record.id },
      }
    default:
      return {
        pathname: '/search/calendar/[eventId]',
        params: { eventId: record.id },
      }
  }
}

/**
 * The Module a record belongs to. A tasting's is its Kind's, so it is `null`
 * here and read from the record in `recordShown`.
 */
const MODULE_OF_TYPE = {
  recipe: 'recipes',
  task: 'tasks',
  note: 'notes',
  tasting: null,
  calendarEvent: 'calendar',
  loyaltyCard: 'loyalty-cards',
} as const satisfies Record<SearchRecordType, ModuleId | null>

const TASTING_MODULES = Object.values(TASTING_KIND_SPECS).map(
  (spec) => spec.moduleId,
)

/**
 * The types to ask `search.group` for: those of the Modules this build shows
 * (`modules/moduleVisibility.ts`). A hidden Module's records are not found.
 */
export function searchableTypes(
  shown: (moduleId: ModuleId) => boolean,
): SearchRecordType[] {
  return SEARCH_RECORD_TYPES.filter((type) => {
    const module = MODULE_OF_TYPE[type]
    return module ? shown(module) : TASTING_MODULES.some(shown)
  })
}

/** Whether a stored recent may still be listed, by the same rule. */
export function recordShown(
  record: Pick<RecentRecordInput, 'type' | 'kind'>,
  shown: (moduleId: ModuleId) => boolean,
): boolean {
  const module = MODULE_OF_TYPE[record.type]
  if (module) return shown(module)
  return record.kind ? shown(TASTING_KIND_SPECS[record.kind].moduleId) : false
}
