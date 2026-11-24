/**
 * The account portal contract (AppElent `standards/account-portal.md`, 1.0.0):
 * what account.appelent.nl reads to show, export and — later — delete one
 * person's Gather data, with no backend of its own.
 *
 * The portal opens a Convex client with the shared Clerk session's `convex`
 * token, which `auth.config.ts` already accepts; nothing here trusts the
 * portal beyond that token. Every function resolves the caller from it and
 * takes no user id, and none of them writes: a person who never used Gather
 * gets `null` and an empty export, and no `users` row appears.
 *
 * Each is a thin wrapper over code the app already has. `summary` counts on
 * the indexes the export registry names (`countGroupRows`), `exportPage`
 * walks the same steps as "Export your data" (`exportManifest`,
 * `readExportPage`), so the content rules are those of the in-app file
 * (docs/contracts/data-export.md). `deleteAppData` follows APP-392.
 *
 * Connected apps are refused: the portal is the person's own account, and
 * account management stays in the app (ADR-0046).
 */

import {
  EXPORT_CONVENTIONS,
  EXPORT_FORMAT,
  EXPORT_NOT_INCLUDED,
  type ExportManifest,
} from '@gather/core/data-export'
import {
  DELETION_IN_PROGRESS,
  INVALID_EXPORT_CURSOR,
} from '@gather/core/refusals'
import { ConvexError, v } from 'convex/values'
import type { Doc, TableNames } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { query } from './_generated/server'
import { getGatedIdentity, rejectConnectedApps } from './lib/connectedApps'
import {
  countGroupRows,
  exportGroups,
  exportLayout,
  exportManifest,
  guardedRows,
  readExportPage,
} from './lib/dataExport'
import { getMembership, groupRefusalError } from './lib/groupAccess'
import { getUserByClerkId, NOT_SIGNED_IN } from './lib/sharing'

/** Bumped only for a breaking change to these shapes. */
export const PORTAL_CONTRACT = 1 as const
const APP = 'gather' as const

/** Rows a key counts at most; one more says "1,000 or more". */
export const COUNT_LIMIT = 1000

/**
 * What `summary` counts, in display order: one key per kind of data, the
 * person's Groups' rows of its exported tables, summed under one cap. The
 * portal owns the labels. Grocery items are tasks in a grocery list, so
 * `tasks` counts them too. `energyPrices` is reference
 * data, so no key counts it.
 */
export const COUNTED = [
  { key: 'recipes', tables: ['recipes'] },
  { key: 'meals', tables: ['mealEntries'] },
  { key: 'plannedMeals', tables: ['plannedDinners'] },
  { key: 'taskLists', tables: ['taskLists'] },
  { key: 'tasks', tables: ['tasks'] },
  { key: 'notes', tables: ['notes'] },
  { key: 'calendarEvents', tables: ['calendarEvents'] },
  { key: 'babyEvents', tables: ['babyEvents'] },
  { key: 'tastings', tables: ['tastings'] },
  { key: 'loyaltyCards', tables: ['loyaltyCards'] },
  {
    key: 'houseRecords',
    tables: ['houses', 'mortgageCalculations', 'loanParts', 'homeBuyingCosts'],
  },
  {
    key: 'financeRecords',
    tables: [
      'recurringCosts',
      'savingsGoals',
      'splitScenarios',
      'holdings',
      'holdingTransactions',
      'financeSettings',
      'netWorthEntries',
      'netWorthSnapshots',
    ],
  },
  {
    key: 'energyRecords',
    tables: [
      'energySites',
      'energyContracts',
      'energySources',
      'energyAssets',
      'energyChannels',
      'energyReadings',
      'energyIntervals',
      'energyPriceFeeds',
    ],
  },
] as const satisfies readonly {
  key: string
  tables: readonly TableNames[]
}[]

/**
 * Bytes left that one more row needs: a document is at most 1 MiB, and the
 * rest is margin for what the query reads around it.
 */
export const ROW_BYTES = 1024 * 1024 + 64 * 1024

/**
 * Keeps the whole query inside Convex's read limits: 32,000 documents, 4,096
 * index ranges (each `db.get` and `db.query`) and 16 MiB. It is asked before
 * every range and every row, so no number or size of rows makes `summary`
 * throw; a key it cuts short says `more` with what was read.
 *
 * Documents, every key capped: 1 caller + 1,001 memberships + 1,001 Groups +
 * 13 keys x 1,001 rows = 15,016, which leaves 16,984 for the parents (task
 * lists, calendars, babies) that their children are counted under.
 *
 * Index ranges: 1 for the caller, 1 for the memberships, 1 `get` per Group,
 * then up to 30 tables + 3 parents per Group and 1 per parent row. That is 34
 * per Group before parent rows, past 4,096 at 121 Groups.
 *
 * Bytes: the 13,013 capped rows fit up to about 1.2 KiB each.
 */
function readGuard(ctx: QueryCtx) {
  const guard = {
    stopped: false,
    allow: async (ranges: number) => {
      if (guard.stopped) return false
      const left = await ctx.meta.getTransactionMetrics()
      guard.stopped =
        left.databaseQueries.remaining < ranges ||
        left.documentsRead.remaining < 1 ||
        left.bytesRead.remaining < ROW_BYTES
      return !guard.stopped
    },
    mayOpen: () => guard.allow(1),
    mayReadRow: () => guard.allow(0),
  }
  return guard
}

function capped(key: string, read: number, cut: boolean): PortalCount {
  return {
    key,
    count: Math.min(read, COUNT_LIMIT),
    more: cut || read > COUNT_LIMIT,
  }
}

export interface PortalCount {
  key: string
  count: number
  more: boolean
}

export interface PortalSummary {
  contract: typeof PORTAL_CONTRACT
  lastActiveAt: number | null
  counts: PortalCount[]
}

export interface PortalBlocker {
  code: string
  params: Record<string, string | number>
}

export interface PortalExportPage {
  contract: typeof PORTAL_CONTRACT
  app: typeof APP
  tables: Record<string, unknown[]>
  next: string | null
}

const countValidator = v.object({
  key: v.string(),
  count: v.number(),
  more: v.boolean(),
})
const summaryValidator = v.union(
  v.null(),
  v.object({
    contract: v.literal(PORTAL_CONTRACT),
    lastActiveAt: v.union(v.number(), v.null()),
    counts: v.array(countValidator),
  }),
)
const blockerValidator = v.union(
  v.null(),
  v.object({
    code: v.string(),
    params: v.record(v.string(), v.union(v.string(), v.number())),
  }),
)
const exportPageValidator = v.object({
  contract: v.literal(PORTAL_CONTRACT),
  app: v.literal(APP),
  tables: v.record(v.string(), v.array(v.any())),
  next: v.union(v.string(), v.null()),
})

/**
 * The caller's `users` row, or null when they never used Gather. Only a
 * missing token is a refusal: a portal whose token Gather does not accept
 * must see an error, not "no data here".
 */
async function portalCaller(ctx: QueryCtx): Promise<Doc<'users'> | null> {
  await rejectConnectedApps(ctx)
  const identity = await getGatedIdentity(ctx)
  // Bare on purpose, unlike every other sign-in refusal (APP-620): the account
  // portal's `isUnauthenticated` (AppElent/appelent-site, convex-client.ts)
  // matches `error.data === 'Not authenticated'` to retry with a fresh token,
  // and does not read a keyed refusal. Key this once the portal reads
  // `groups:not-signed-in`.
  if (!identity) throw new ConvexError(NOT_SIGNED_IN)
  return await getUserByClerkId(ctx, identity.subject)
}

/**
 * The person whose data is shown. An account mid-deletion has asked for its
 * data to go, so it reads as gone, as the in-app export's manifest does;
 * `deletionBlocker` says why.
 */
async function activeCaller(ctx: QueryCtx): Promise<Doc<'users'> | null> {
  const user = await portalCaller(ctx)
  return user && !user.deletedAt ? user : null
}

export const summary = query({
  args: {},
  returns: summaryValidator,
  handler: async (ctx): Promise<PortalSummary | null> => {
    const me = await activeCaller(ctx)
    if (!me) return null

    const groupGuard = readGuard(ctx)
    const memberships: Doc<'memberships'>[] = []
    const range = () =>
      ctx.db
        .query('memberships')
        .withIndex('by_user', (q) => q.eq('userId', me._id))
    for await (const membership of guardedRows(range, groupGuard)) {
      memberships.push(membership)
      if (memberships.length > COUNT_LIMIT) break
    }
    const groups: Doc<'groups'>[] = []
    for (const membership of memberships) {
      if (!(await groupGuard.mayOpen())) break
      const group = await ctx.db.get(membership.groupId)
      if (group) groups.push(group)
    }

    const counts = [capped('groups', groups.length, groupGuard.stopped)]
    for (const { key, tables } of COUNTED) {
      const guard = readGuard(ctx)
      let read = 0
      for (const table of tables) {
        for (const group of groups) {
          if (read > COUNT_LIMIT || guard.stopped) break
          const limit = COUNT_LIMIT + 1 - read
          read += await countGroupRows(ctx, { table, me, group, limit, guard })
        }
      }
      // Groups left unread hold rows no key has counted.
      counts.push(capped(key, read, guard.stopped || groupGuard.stopped))
    }
    // Gather does not record when somebody last wrote.
    return { contract: PORTAL_CONTRACT, lastActiveAt: null, counts }
  },
})

export const deletionBlocker = query({
  args: {},
  returns: blockerValidator,
  handler: async (ctx): Promise<PortalBlocker | null> => {
    const user = await portalCaller(ctx)
    // The purge is already running (`accounts.purgeSubject`); deleting Gather
    // data only lets go of the subject, so a later sign-in finds nothing here.
    if (user?.deletedAt) return { code: DELETION_IN_PROGRESS, params: {} }
    return null
  },
})

// -- Export ------------------------------------------------------------------

/**
 * Where an export is. The Groups are the person's on the first page, by id and
 * the slug they had then, so a Group joined, renamed or replaced by another
 * with its old slug mid-export does not move the steps under the cursor. Each
 * page loads its Group by that id and checks the membership again, so a
 * cursor names nothing the caller cannot already read. The portal never
 * parses it.
 */
interface CursorGroup {
  id: string
  slug: string
}

interface PortalCursor {
  groups: CursorGroup[]
  table: string
  /** Index into `groups`; null for an account table. */
  group: number | null
  page: string | null
}

interface Step {
  table: string
  group: number | null
}

/** Longer than any cursor this server hands out. */
const MAX_CURSOR_LENGTH = 64 * 1024

/** Account tables first, then each Group's, as the in-app file is ordered. */
function stepsOf(layout: ExportManifest, groups: CursorGroup[]): Step[] {
  const steps: Step[] = layout.account.map((table) => ({ table, group: null }))
  groups.forEach((_, group) => {
    for (const table of layout.group) steps.push({ table, group })
  })
  return steps
}

/** A Group's table under its slug, so two Groups' rows never share a key. */
function keyOf(step: Step, groups: CursorGroup[]): string {
  if (step.group === null) return step.table
  return `groups/${groups[step.group]?.slug}/${step.table}`
}

function parseCursor(cursor: string): PortalCursor {
  if (cursor.length > MAX_CURSOR_LENGTH) {
    throw new ConvexError(INVALID_EXPORT_CURSOR)
  }
  let at: unknown
  try {
    at = JSON.parse(cursor)
  } catch {
    throw new ConvexError(INVALID_EXPORT_CURSOR)
  }
  const c = at as Partial<PortalCursor> | null
  const isGroup = (g: unknown) =>
    !!g &&
    typeof g === 'object' &&
    typeof (g as CursorGroup).id === 'string' &&
    typeof (g as CursorGroup).slug === 'string'
  if (
    !c ||
    typeof c !== 'object' ||
    !Array.isArray(c.groups) ||
    !c.groups.every(isGroup) ||
    typeof c.table !== 'string' ||
    !(c.group === null || Number.isInteger(c.group)) ||
    !(c.page === null || typeof c.page === 'string')
  ) {
    throw new ConvexError(INVALID_EXPORT_CURSOR)
  }
  return c as PortalCursor
}

/**
 * The Group a step names, if the caller is still in it. Gone, or left, is the
 * Group refusal every other read gives, rather than a Group missing silently
 * from the file.
 */
async function stepGroup(
  ctx: QueryCtx,
  me: Doc<'users'>,
  ref: CursorGroup,
): Promise<Doc<'groups'>> {
  const id = ctx.db.normalizeId('groups', ref.id)
  if (!id) throw new ConvexError(INVALID_EXPORT_CURSOR)
  const group = await ctx.db.get(id)
  if (!group) throw groupRefusalError('unknown-slug')
  if (!(await getMembership(ctx, id, me._id))) {
    throw groupRefusalError('not-a-member')
  }
  return group
}

/** The in-app file's header, so a portal export reads like the in-app one. */
function header(manifest: ExportManifest) {
  return {
    format: EXPORT_FORMAT,
    version: manifest.version,
    conventions: EXPORT_CONVENTIONS,
    notIncluded: EXPORT_NOT_INCLUDED,
    excludedTables: manifest.excluded,
    omittedFields: manifest.omittedFields,
    groups: manifest.groups,
  }
}

/**
 * One page of the export: at most one `dataExport.page` worth of one table
 * (Convex allows one `paginate` per query, and a page stops at `PAGE_BYTES`),
 * keyed by table — `groups/<slug>/<table>` for a Group's, with the slug it had
 * when the export started — and the file's header under `export` on the first.
 */
export const exportPage = query({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: exportPageValidator,
  handler: async (ctx, { cursor }): Promise<PortalExportPage> => {
    const me = await activeCaller(ctx)
    const empty: PortalExportPage = {
      contract: PORTAL_CONTRACT,
      app: APP,
      tables: {},
      next: null,
    }
    if (!me) return empty

    const at = cursor === null ? null : parseCursor(cursor)
    const layout = exportLayout()
    const groups: CursorGroup[] = at
      ? at.groups
      : (await exportGroups(ctx, me)).map((g) => ({ id: g._id, slug: g.slug }))
    const steps = stepsOf({ version: 0, ...layout, groups: [] }, groups)
    const index = at
      ? steps.findIndex((s) => s.table === at.table && s.group === at.group)
      : 0
    if (index < 0) throw new ConvexError(INVALID_EXPORT_CURSOR)
    const step = steps[index]

    const tables: Record<string, unknown[]> = {}
    if (!at) tables.export = [header(await exportManifest(ctx, me))]
    if (!step) return { ...empty, tables }

    const ref = step.group === null ? null : groups[step.group]
    const group = ref ? await stepGroup(ctx, me, ref) : null
    const page = await readExportPage(ctx, {
      table: step.table,
      me,
      group,
      cursor: at?.page ?? null,
    })
    tables[keyOf(step, groups)] = page.rows

    const following = steps[index + 1]
    const next: PortalCursor | null = !page.isDone
      ? { groups, ...step, page: page.cursor }
      : following
        ? { groups, ...following, page: null }
        : null
    return {
      contract: PORTAL_CONTRACT,
      app: APP,
      tables,
      next: next && JSON.stringify(next),
    }
  },
})
