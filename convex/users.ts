import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import { requireGroupBySlug } from './lib/groupAccess'
import { allocateGroupSlug } from './lib/groupSlugs'
import { nutritionValidator } from './lib/nutrition'
import { getCurrentUser, getUserByClerkId } from './lib/sharing'

/** Returns the current gather user row, or null if not signed in / not yet provisioned. */
export const me = query({
  args: {},
  handler: async (ctx) => getCurrentUser(ctx),
})

/**
 * Create a person's Personal group: an ordinary Group with a single Member,
 * where their private content lives (ADR-0003). Because it always exists,
 * signing in always has somewhere to land and there is no "create your first
 * Group" wall.
 *
 * Its slug takes the reserved `me-` namespace, so a household naming itself
 * after someone can never take it.
 */
export async function createPersonalGroup(
  ctx: MutationCtx,
  user: { _id: Id<'users'>; name: string },
  // Allocated by the caller so the backfill can walk the same ladder without
  // writing anything on a dry run.
  slug: string,
): Promise<Id<'groups'>> {
  const groupId = await ctx.db.insert('groups', {
    name: `${user.name}'s things`,
    slug,
    isPersonal: true,
    inviteCode: crypto.randomUUID().slice(0, 8),
  })
  await ctx.db.insert('memberships', {
    groupId,
    userId: user._id,
    role: 'admin',
  })
  await ctx.db.patch(user._id, { defaultGroupId: groupId })
  return groupId
}

/**
 * Idempotently provision the signed-in Clerk user as a gather user, with the
 * Personal group every person has exactly one of.
 */
export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    // Runs on every app mount, and is the only thing that inserts into
    // `users` — so it must never insert a second row for a subject that
    // already has one. Resolving through getUserByClerkId keeps that true
    // even when the table is already dirty.
    const existing = await getUserByClerkId(ctx, identity.subject)

    if (existing) {
      const patch: Record<string, string> = {}
      const name = identity.name ?? existing.name
      const email = identity.email ?? existing.email
      if (name !== existing.name) patch.name = name
      if (email !== existing.email) patch.email = email
      if (identity.pictureUrl && identity.pictureUrl !== existing.imageUrl) {
        patch.imageUrl = identity.pictureUrl
      }
      if (Object.keys(patch).length) await ctx.db.patch(existing._id, patch)
      return existing._id
    }

    const name = identity.name ?? 'Member'
    const userId = await ctx.db.insert('users', {
      clerkId: identity.subject,
      name,
      email: identity.email ?? '',
      imageUrl: identity.pictureUrl ?? undefined,
    })

    const slug = await allocateGroupSlug(ctx, { name, isPersonal: true })
    await createPersonalGroup(ctx, { _id: userId, name }, slug)
    return userId
  },
})

/**
 * How many Pins one person may keep. An abuse guard rather than a product
 * limit — it sits well above the number of Modules that exist, so nobody
 * pinning every Module can reach it.
 */
export const MAX_PINNED_MODULES = 32

/**
 * The caller's Pins in one Group, or null if they have never chosen any.
 *
 * Null rather than the default list, because "has not chosen" and "chose these"
 * are different answers and only the client knows the Module catalog the
 * default is written in. `pinnedModuleIds` in `src/lib/pins.ts` turns the
 * former into the latter.
 *
 * The fallback to the person's pre-ADR-0004 list is what makes a Group they
 * have not touched since the change open with the pins they are used to,
 * rather than with a default that would read as having lost them.
 */
export const myPins = query({
  args: { groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { user, membership } = await requireGroupBySlug(ctx, args.groupSlug)
    return membership.pinnedModuleIds ?? user.pinnedModuleIds ?? null
  },
})

/**
 * Replace the caller's Pins in one Group with the whole ordered list.
 *
 * One ordered array covers adding, removing and reordering in a single shape,
 * so there is no way for three mutations to disagree about what the order is.
 *
 * The ids are opaque here on purpose. The Module catalog lives in the client
 * and this backend must not import it, so validating against it is not
 * something the server can honestly do; an id nothing declares is dropped
 * where the catalog is known, when the list is read. All this does is refuse
 * duplicates and refuse an unbounded list.
 *
 * Pins are still personal: this writes to the caller's own membership, reached
 * through the Group in the URL and their own identity, so it can touch no other
 * person's row and one Member's choices stay invisible to the rest of their
 * Group by construction. What ADR-0004 changed is only which Group the choice
 * is about.
 */
export const setPins = mutation({
  args: { groupSlug: v.string(), moduleIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const { membership } = await requireGroupBySlug(ctx, args.groupSlug)

    const pinnedModuleIds: string[] = []
    for (const id of args.moduleIds) {
      if (pinnedModuleIds.length >= MAX_PINNED_MODULES) break
      if (!pinnedModuleIds.includes(id)) pinnedModuleIds.push(id)
    }

    await ctx.db.patch(membership._id, { pinnedModuleIds })
  },
})

export const setNutritionTargets = mutation({
  args: { targets: nutritionValidator },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    await ctx.db.patch(user._id, { nutritionTargets: args.targets })
  },
})
