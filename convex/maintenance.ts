import { v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { internalMutation } from './_generated/server'
import { pickCanonicalUser } from './lib/sharing'

/**
 * One-off cleanup for `users` documents carrying stray fields left over from
 * removed experiments (e.g. `nutritionTargets`), which fail schema
 * validation and block `convex dev`/deploy from pushing any new functions.
 * Safe to re-run — replacing an already-clean document is a no-op.
 */
export const cleanUserDocuments = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').collect()
    let cleaned = 0
    for (const user of users) {
      const { clerkId, name, email, imageUrl, defaultGroupId } = user
      await ctx.db.replace(user._id, {
        clerkId,
        name,
        email,
        imageUrl,
        defaultGroupId,
      })
      cleaned++
    }
    return { cleaned }
  },
})

/**
 * Collapse duplicate `users` rows — several rows sharing one `clerkId` — onto
 * the oldest row for that subject.
 *
 * A duplicate row took prod down outright: `getCurrentUser` resolved the viewer
 * with `.unique()`, which throws on a second match, so every viewer-scoped
 * query 500'd rather than just that one account misbehaving.
 * `pickCanonicalUser` now tolerates duplicates, but the account's records stay
 * split across the rows until they are actually merged — that is this.
 *
 * Keeps the *oldest* row, matching `pickCanonicalUser`, so the row this leaves
 * behind is the same one the running app resolves to.
 *
 * Dry run by default — pass `{ apply: true }` to write. Re-running once every
 * clerkId holds a single row is a no-op.
 */
export const mergeDuplicateUsers = internalMutation({
  args: { apply: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const apply = args.apply ?? false
    const users = await ctx.db.query('users').collect()

    const byClerkId = new Map<string, Doc<'users'>[]>()
    for (const user of users) {
      const rows = byClerkId.get(user.clerkId)
      if (rows) rows.push(user)
      else byClerkId.set(user.clerkId, [user])
    }

    const plans = []
    for (const [clerkId, rows] of byClerkId) {
      if (rows.length < 2) continue
      const keep = pickCanonicalUser(rows)
      if (!keep) continue
      const drop = rows.filter((r) => r._id !== keep._id)
      plans.push(await mergeUserInto(ctx, clerkId, keep, drop, apply))
    }

    return { apply, duplicateSubjects: plans.length, plans }
  },
})

/** Repoint every `v.id('users')` reference from `drop` onto `keep`. */
async function mergeUserInto(
  ctx: MutationCtx,
  clerkId: string,
  keep: Doc<'users'>,
  drop: Doc<'users'>[],
  apply: boolean,
) {
  const repointed: Record<string, number> = {}
  const bump = (table: string) => {
    repointed[table] = (repointed[table] ?? 0) + 1
  }
  let membershipsDropped = 0
  let adoptedDefaultGroup = false
  let defaultGroupId = keep.defaultGroupId

  const keepGroupIds = new Set(
    (
      await ctx.db
        .query('memberships')
        .withIndex('by_user', (q) => q.eq('userId', keep._id))
        .collect()
    ).map((m) => m.groupId),
  )

  // `tasks`, `foods`, `integrationConnections` and `babyEvents` carry a user
  // reference but no index on it. This is a one-off repair over a
  // household-sized dataset, so scanning beats carrying four indexes that
  // nothing in the app itself would ever query.
  const tasks = await ctx.db.query('tasks').collect()
  const foods = await ctx.db.query('foods').collect()
  const connections = await ctx.db.query('integrationConnections').collect()
  const babyEvents = await ctx.db.query('babyEvents').collect()

  for (const dupe of drop) {
    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', dupe._id))
      .collect()
    for (const m of memberships) {
      // Repointing into a group `keep` already belongs to would leave two rows
      // for one (group, user) pair, and the group would show up twice.
      if (keepGroupIds.has(m.groupId)) {
        membershipsDropped++
        if (apply) await ctx.db.delete(m._id)
        continue
      }
      keepGroupIds.add(m.groupId)
      bump('memberships')
      if (apply) await ctx.db.patch(m._id, { userId: keep._id })
    }

    const recipes = await ctx.db
      .query('recipes')
      .withIndex('by_owner', (q) => q.eq('ownerId', dupe._id))
      .collect()
    for (const r of recipes) {
      bump('recipes')
      if (apply) await ctx.db.patch(r._id, { ownerId: keep._id })
    }

    const entries = await ctx.db
      .query('consumptionEntries')
      .withIndex('by_user_date', (q) => q.eq('userId', dupe._id))
      .collect()
    for (const e of entries) {
      bump('consumptionEntries')
      if (apply) await ctx.db.patch(e._id, { userId: keep._id })
    }

    for (const t of tasks) {
      if (t.createdBy !== dupe._id) continue
      bump('tasks')
      if (apply) await ctx.db.patch(t._id, { createdBy: keep._id })
    }
    for (const f of foods) {
      if (f.createdBy !== dupe._id) continue
      bump('foods')
      if (apply) await ctx.db.patch(f._id, { createdBy: keep._id })
    }
    for (const c of connections) {
      if (c.connectedBy !== dupe._id) continue
      bump('integrationConnections')
      if (apply) await ctx.db.patch(c._id, { connectedBy: keep._id })
    }
    for (const e of babyEvents) {
      if (e.loggedBy !== dupe._id) continue
      bump('babyEvents')
      if (apply) await ctx.db.patch(e._id, { loggedBy: keep._id })
    }

    // Only fills a gap — a surviving row that already picked a default group
    // keeps it, so the merge never silently moves the user somewhere else.
    if (!defaultGroupId && dupe.defaultGroupId) {
      defaultGroupId = dupe.defaultGroupId
      adoptedDefaultGroup = true
      if (apply) await ctx.db.patch(keep._id, { defaultGroupId })
    }

    if (apply) await ctx.db.delete(dupe._id)
  }

  return {
    clerkId,
    keep: keep._id,
    drop: drop.map((d) => d._id),
    repointed,
    membershipsDropped,
    adoptedDefaultGroup,
    groupIdsAfterMerge: [...keepGroupIds],
  }
}
