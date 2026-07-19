import { internalMutation } from './_generated/server'

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
