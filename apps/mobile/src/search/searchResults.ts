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
import { isTastingKind } from '@gather/core/tastings'
import type { Href } from 'expo-router'

import type { Messages } from '../i18n'
import type { RecentRecordInput, SearchRecordType } from './recentRecords'
import { moduleOf } from './searchFilters'

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
  done?: boolean
  createdBy?: string
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
 * The stack a search runs in: the Search tab's own, or All's when a Module's
 * search button pushed it (APP-613).
 */
export type SearchStack = 'search' | 'all'

/**
 * Where a record lives. Built from typed fields only — a tasting without a
 * Kind has no address, and says so, rather than guessing from its subtitle.
 *
 * Under the stack the search runs in: pushing into another tab's stack
 * switches tabs, and Back then lands on that tab's root instead of on the
 * results the person came from.
 */
export function hrefFor(
  record: RecentRecordInput,
  stack: SearchStack = 'search',
): Href | null {
  switch (record.type) {
    case 'recipe':
      return {
        pathname: `/${stack}/recipes/recipe`,
        params: { recipeId: record.id },
      }
    case 'task':
      return {
        pathname: `/${stack}/tasks/task/[taskId]`,
        params: { taskId: record.id },
      }
    case 'note':
      return {
        pathname: `/${stack}/notes/[noteId]`,
        params: { noteId: record.id },
      }
    case 'tasting':
      return record.kind
        ? {
            pathname: `/${stack}/tasting/[kind]/subject`,
            params: { kind: record.kind, subjectId: record.id },
          }
        : null
    case 'loyaltyCard':
      return {
        pathname: `/${stack}/loyalty-cards/card`,
        params: { cardId: record.id },
      }
    default:
      return {
        pathname: `/${stack}/calendar/[eventId]`,
        params: { eventId: record.id },
      }
  }
}

/**
 * Whether a stored recent may still be listed: only a record of a Module this
 * build shows (`modules/moduleVisibility.ts`), by the same rule `typesFor`
 * asks the server with. A tasting without a Kind has no Module.
 */
export function recordShown(
  record: Pick<RecentRecordInput, 'type' | 'kind'>,
  shown: (moduleId: ModuleId) => boolean,
): boolean {
  const module = moduleOf(record)
  return module ? shown(module) : false
}
