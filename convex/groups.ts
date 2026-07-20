import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getCurrentUser, getMyGroupIds } from './lib/sharing'

export const myGroups = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []
    const ids = await getMyGroupIds(ctx, user._id)
    const groups = await Promise.all(ids.map((id) => ctx.db.get(id)))
    return groups
      .filter((g): g is NonNullable<typeof g> => g !== null)
      .map((g) => ({ ...g, isDefault: g._id === user.defaultGroupId }))
  },
})

export const createGroup = mutation({
  args: { name: v.string(), type: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const groupId = await ctx.db.insert('groups', {
      name: args.name,
      type: args.type,
      inviteCode: crypto.randomUUID().slice(0, 8),
    })
    await ctx.db.insert('memberships', {
      groupId,
      userId: user._id,
      role: 'owner',
    })
    return groupId
  },
})

export const joinByInvite = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const group = await ctx.db
      .query('groups')
      .withIndex('by_inviteCode', (q) => q.eq('inviteCode', args.inviteCode))
      .unique()
    if (!group) throw new Error('Invalid invite code')

    const already = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .filter((q) => q.eq(q.field('groupId'), group._id))
      .unique()
    if (!already) {
      await ctx.db.insert('memberships', {
        groupId: group._id,
        userId: user._id,
        role: 'member',
      })
    }
    return group._id
  },
})

export const setDefaultGroup = mutation({
  args: { groupId: v.id('groups') },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const member = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .filter((q) => q.eq(q.field('groupId'), args.groupId))
      .unique()
    if (!member) throw new Error('Not a member of that group')
    await ctx.db.patch(user._id, { defaultGroupId: args.groupId })
  },
})
