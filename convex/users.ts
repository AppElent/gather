import { mutation, query } from './_generated/server'

/** Returns the current Gather user row, or null if not signed in / not yet provisioned. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    return await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()
  },
})

/** Idempotently provision the signed-in Clerk user as a Gather user projection. */
export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')
    const existing = await ctx.db.query('users').withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject)).unique()
    if (existing) {
      const patch: Record<string, string> = {}
      const name = identity.name ?? existing.name
      const email = identity.email ?? existing.email
      if (name !== existing.name) patch.name = name
      if (email !== existing.email) patch.email = email
      if (identity.pictureUrl && identity.pictureUrl !== existing.imageUrl) patch.imageUrl = identity.pictureUrl
      if (Object.keys(patch).length) await ctx.db.patch(existing._id, patch)
      return existing._id
    }
    return await ctx.db.insert('users', { clerkId: identity.subject, name: identity.name ?? 'Member', email: identity.email ?? '', imageUrl: identity.pictureUrl ?? undefined })
  },
})