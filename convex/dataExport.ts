/**
 * "Export your data": the person's account and every Group they are in, as
 * one JSON file assembled on the client (GDPR access and portability).
 *
 * Two queries. `manifest` names the tables and the Groups; `page` reads one
 * bounded page of one table. `collectExport` in `@gather/core/data-export`
 * drains them in order, so the web download and the phone's share sheet
 * write the same file. What each table contributes, and what it holds back,
 * is `convex/lib/dataExport.ts` — see docs/contracts/data-export.md.
 *
 * Both are ordinary authenticated reads. Neither takes a user id: the person
 * is whoever the token says, and a Group is named by slug and resolved
 * through the same membership check as every other Group read (ADR-0002).
 */

import type { ExportManifest, ExportPage } from '@gather/core/data-export'
import { v } from 'convex/values'
import { query } from './_generated/server'
import { exportManifest, readExportPage } from './lib/dataExport'
import { requireGroupBySlug } from './lib/groupAccess'
import { getCurrentUser } from './lib/sharing'

export const manifest = query({
  args: {},
  handler: async (ctx): Promise<ExportManifest | null> => {
    const user = await getCurrentUser(ctx)
    if (!user || user.deletedAt) return null
    return exportManifest(ctx, user)
  },
})

export const page = query({
  args: {
    table: v.string(),
    groupSlug: v.optional(v.string()),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args): Promise<ExportPage> => {
    if (args.groupSlug !== undefined) {
      const { user, group } = await requireGroupBySlug(ctx, args.groupSlug)
      return readExportPage(ctx, { ...args, me: user, group })
    }
    const user = await getCurrentUser(ctx)
    if (!user || user.deletedAt) throw new Error('Not authenticated')
    return readExportPage(ctx, { ...args, me: user, group: null })
  },
})
