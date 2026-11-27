/**
 * Deleting rows a bounded page per transaction. One `PurgePage` is what one
 * transaction may delete, whichever tables the rows come from; when it is
 * spent, the caller schedules its next step after `pauseMs`.
 */

import { getDocumentSize, type Value } from 'convex/values'
import type { Doc, Id, TableNames } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { writePauseMs } from './energyWritePace'
import { storedFileIdsOf } from './storedFiles'

/** Rows one transaction deletes, when they are short. */
const ROWS_PER_PAGE = 500

/** The bytes of rows one transaction deletes, and at most one row more. */
const BYTES_PER_PAGE = 2 * 1024 * 1024

const BYTES_PER_SECOND = 1024 * 1024

export interface PurgePage {
  rows: number
  bytes: number
  /** The stored files the deleted rows held. */
  files: Id<'_storage'>[]
}

export function newPurgePage(): PurgePage {
  return { rows: 0, bytes: 0, files: [] }
}

/** Count a row this page read and wrote. */
export function charge(page: PurgePage, row: Record<string, unknown>): void {
  page.rows += 1
  page.bytes += getDocumentSize(row as Record<string, Value>)
}

function isSpent(page: PurgePage): boolean {
  return page.rows >= ROWS_PER_PAGE || page.bytes >= BYTES_PER_PAGE
}

/**
 * The wait before the next page: at most 1 MiB of rows a second, and the rows
 * `writePauseMs` allows (why: `energyWritePace.ts`).
 */
export function pauseMs(page: PurgePage): number {
  return Math.max(
    writePauseMs(page.rows),
    Math.ceil((page.bytes / BYTES_PER_SECOND) * 1000),
  )
}

/**
 * Delete these rows until the page is spent. True means none are left; after
 * false the caller stops and goes on in its next step, from the start.
 *
 * `rows` is read one at a time, never collected. `before` runs ahead of each
 * row's deletion; answering false keeps the row and stops, which is how a
 * parent stays until its children, deleted through the same page, are gone.
 */
export async function drain<T extends TableNames>(
  ctx: MutationCtx,
  page: PurgePage,
  table: T,
  rows: AsyncIterable<Doc<T>>,
  before?: (row: Doc<T>) => Promise<boolean>,
): Promise<boolean> {
  for await (const row of rows) {
    if (before && !(await before(row))) return false
    page.files.push(...storedFileIdsOf(table, row))
    charge(page, row)
    await ctx.db.delete(row._id)
    if (isSpent(page)) return false
  }
  return true
}
