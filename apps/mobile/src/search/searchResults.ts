/**
 * Turning a server row into something openable.
 *
 * A result from `api.search.group` and a stored recent are the same thing at
 * different ages, so a row becomes a `RecentRecordInput` once — here — and
 * every screen below works from that one shape. The alternative, narrowing a
 * `QueryResult | RecentRecordInput` union at each use, is what let a
 * translated Kind label reach a route param.
 */
import { isTastingKind } from '@gather/core/tastings'
import type { Href } from 'expo-router'

import type { Messages } from '../i18n'
import type { RecentRecordInput, SearchRecordType } from './recentRecords'

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
    : `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
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
  switch (record.type) {
    case 'recipe':
      return {
        pathname: '/all/recipes/recipe',
        params: { recipeId: record.id },
      }
    case 'task':
      return {
        pathname: '/all/tasks/task/[taskId]',
        params: { taskId: record.id },
      }
    case 'note':
      return { pathname: '/all/notes/[noteId]', params: { noteId: record.id } }
    case 'tasting':
      return record.kind
        ? {
            pathname: '/all/tasting/[kind]/subject',
            params: { kind: record.kind, subjectId: record.id },
          }
        : null
    default:
      return {
        pathname: '/all/calendar/[eventId]',
        params: { eventId: record.id },
      }
  }
}
