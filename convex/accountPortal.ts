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
  INVALID_PORTAL_CURSOR,
} from '@gather/core/refusals'
import { ConvexError, v } from 'convex/values'
import type { Doc, TableNames } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { query } from './_generated/server'
import { getGatedIdentity, rejectConnectedApps } from './lib/connectedApps'
import {
  countGroupRows,
  exportManifest,
  readExportPage,
} from './lib/dataExport'
import { requireGroupBySlug } from './lib/groupAccess'
import { getUserByClerkId, NOT_SIGNED_IN } from './lib/sharing'

/** Bumped only for a breaking change to these shapes. */
export const PORTAL_CONTRACT = 1 as const
const APP = 'gather' as const

/** Rows a count reads at most; one more says "1,000 or more". */
export const COUNT_LIMIT = 1000

/**
 * What `summary` counts, in display order: one key per kind of data, each the
 * person's Groups' rows of one exported table. The portal owns the labels.
 * Grocery items are tasks in a grocery list, so `tasks` counts them too.
 */
const COUNTED = [
  { key: 'recipes', table: 'recipes' },
  { key: 'meals', table: 'mealEntries' },
  { key: 'plannedMeals', table: 'plannedDinners' },
  { key: 'taskLists', table: 'taskLists' },
  { key: 'tasks', table: 'tasks' },
  { key: 'notes', table: 'notes' },
  { key: 'calendarEvents', table: 'calendarEvents' },
  { key: 'babyEvents', table: 'babyEvents' },
  { key: 'tastings', table: 'tastings' },
  { key: 'loyaltyCards', table: 'loyaltyCards' },
] as const satisfies readonly { key: string; table: TableNames }[]

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

/**
 * The caller's `users` row, or null when they never used Gather. Only a
 * missing token is a refusal: a portal whose token Gather does not accept
 * must see an error, not "no data here".
 */
async function portalCaller(ctx: QueryCtx): Promise<Doc<'users'> | null> {
  await rejectConnectedApps(ctx)
  const identity = await getGatedIdentity(ctx)
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

function capped(key: string, read: number): PortalCount {
  return {
    key,
    count: Math.min(read, COUNT_LIMIT),
    more: read > COUNT_LIMIT,
  }
}

export const summary = query({
  args: {},
  handler: async (ctx): Promise<PortalSummary | null> => {
    const me = await activeCaller(ctx)
    if (!me) return null

    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', me._id))
      .take(COUNT_LIMIT + 1)
    const groups: Doc<'groups'>[] = []
    for (const membership of memberships) {
      const group = await ctx.db.get(membership.groupId)
      if (group) groups.push(group)
    }

    const counts = [capped('groups', groups.length)]
    for (const { key, table } of COUNTED) {
      let read = 0
      for (const group of groups) {
        if (read > COUNT_LIMIT) break
        read += await countGroupRows(ctx, {
          table,
          me,
          group,
          limit: COUNT_LIMIT + 1 - read,
        })
      }
      counts.push(capped(key, read))
    }
    // Gather does not record when somebody last wrote.
    return { contract: PORTAL_CONTRACT, lastActiveAt: null, counts }
  },
})

export const deletionBlocker = query({
  args: {},
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
 * Where an export is. The Groups are the manifest's, taken on the first page,
 * so a Group joined mid-export does not move the steps under the cursor; each
 * page still resolves its Group through the membership check, so a cursor
 * names nothing the caller cannot already read. The portal never parses it.
 */
interface PortalCursor {
  groups: string[]
  table: string
  group: string | null
  page: string | null
}

interface Step {
  table: string
  group: string | null
}

/** Account tables first, then each Group's, as the in-app file is ordered. */
function stepsOf(layout: ExportManifest, groups: string[]): Step[] {
  const steps: Step[] = layout.account.map((table) => ({ table, group: null }))
  for (const group of groups) {
    for (const table of layout.group) steps.push({ table, group })
  }
  return steps
}

/** A Group's table under its slug, so two Groups' rows never share a key. */
function keyOf(step: Step): string {
  return step.group === null ? step.table : `groups/${step.group}/${step.table}`
}

function parseCursor(cursor: string): PortalCursor {
  let at: unknown
  try {
    at = JSON.parse(cursor)
  } catch {
    throw new ConvexError(INVALID_PORTAL_CURSOR)
  }
  const c = at as Partial<PortalCursor> | null
  const nullableString = (x: unknown) => x === null || typeof x === 'string'
  if (
    !c ||
    typeof c !== 'object' ||
    !Array.isArray(c.groups) ||
    !c.groups.every((g) => typeof g === 'string') ||
    typeof c.table !== 'string' ||
    !nullableString(c.group) ||
    !nullableString(c.page)
  ) {
    throw new ConvexError(INVALID_PORTAL_CURSOR)
  }
  return c as PortalCursor
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
 * (Convex allows one `paginate` per query), keyed by table — `groups/<slug>/
 * <table>` for a Group's — with the file's header under `export` on the first.
 * A Group left, deleted or renamed mid-export is refused, as the in-app export
 * refuses it, rather than silently missing from the file.
 */
export const exportPage = query({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }): Promise<PortalExportPage> => {
    const me = await activeCaller(ctx)
    const empty: PortalExportPage = {
      contract: PORTAL_CONTRACT,
      app: APP,
      tables: {},
      next: null,
    }
    if (!me) return empty

    const manifest = await exportManifest(ctx, me)
    const at = cursor === null ? null : parseCursor(cursor)
    const groups = at ? at.groups : manifest.groups.map((g) => g.slug)
    const steps = stepsOf(manifest, groups)
    const index = at
      ? steps.findIndex((s) => s.table === at.table && s.group === at.group)
      : 0
    if (index < 0) throw new ConvexError(INVALID_PORTAL_CURSOR)
    const step = steps[index]

    const tables: Record<string, unknown[]> = {}
    if (!at) tables.export = [header(manifest)]
    if (!step) return { ...empty, tables }

    const group =
      step.group === null
        ? null
        : (await requireGroupBySlug(ctx, step.group)).group
    const page = await readExportPage(ctx, {
      table: step.table,
      me,
      group,
      cursor: at?.page ?? null,
    })
    tables[keyOf(step)] = page.rows

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
