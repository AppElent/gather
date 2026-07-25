import { ConvexError, v } from 'convex/values'
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

/**
 * Move a group's Baby log data onto a Space, for rows created before the
 * module was Space-scoped. Nothing in the data model maps a group to a Space,
 * so the pairing has to be supplied explicitly — run this once per group from
 * the Convex dashboard. Safe to re-run: babies already on the Space are
 * skipped, and the module row is left untouched (enable it in Space settings).
 */
export const adoptBabyLogIntoSpace = internalMutation({
  args: { groupId: v.id('groups'), spaceSlug: v.string() },
  handler: async (ctx, args) => {
    const space = await ctx.db
      .query('spaces')
      .withIndex('by_slug', (q) => q.eq('slug', args.spaceSlug))
      .unique()
    if (!space) throw new ConvexError(`No Space with slug ${args.spaceSlug}`)

    const babies = await ctx.db
      .query('babies')
      .withIndex('by_group', (q) => q.eq('groupId', args.groupId))
      .collect()

    let moved = 0
    for (const baby of babies) {
      if (baby.spaceId) continue
      await ctx.db.patch(baby._id, {
        spaceId: space._id,
        groupId: undefined,
      })
      // The checklist cards' backing lists have to follow the baby, or
      // requireListAccess stops resolving them.
      for (const listId of [baby.taskListId, baby.questionsListId]) {
        if (!listId) continue
        const list = await ctx.db.get(listId)
        if (!list || list.spaceId) continue
        await ctx.db.patch(listId, {
          spaceId: space._id,
          groupId: undefined,
        })
      }
      moved++
    }
    return { moved, skipped: babies.length - moved }
  },
})
