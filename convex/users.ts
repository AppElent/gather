import { mutation, query } from './_generated/server'
import { getCurrentUser } from './lib/sharing'
import { nutritionValidator } from './lib/nutrition'

/** Returns the current gather user row, or null if not signed in / not yet provisioned. */
export const me = query({
  args: {},
  handler: async (ctx) => getCurrentUser(ctx),
})

/**
 * Idempotently provision the signed-in Clerk user as a gather user.
 * On first call, also creates a personal default group + membership so that
 * "shared by default" has a target.
 */
export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()

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

    const userId = await ctx.db.insert('users', {
      clerkId: identity.subject,
      name: identity.name ?? 'Member',
      email: identity.email ?? '',
      imageUrl: identity.pictureUrl ?? undefined,
    })

    const inviteCode = crypto.randomUUID().slice(0, 8)
    const groupId = await ctx.db.insert('groups', {
      name: 'Home',
      inviteCode,
      type: 'home',
    })
    await ctx.db.insert('memberships', {
      groupId,
      userId,
      role: 'owner',
    })
    await ctx.db.patch(userId, { defaultGroupId: groupId })
    return userId
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
