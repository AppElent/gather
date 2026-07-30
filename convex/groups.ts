import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { allocateGroupSlug } from './lib/groupSlugs'
import { getCurrentUser, getMyGroupIds } from './lib/sharing'

/** The caller's membership of a Group, or null when they are not in it. */
async function getMembership(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  userId: Id<'users'>,
) {
  return await ctx.db
    .query('memberships')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .filter((q) => q.eq(q.field('groupId'), groupId))
    .unique()
}

/**
 * Resolve the caller and their standing in a Group, or refuse.
 *
 * Every Group mutation authorises through the caller's own membership; none
 * takes a user id from the client.
 */
async function requireMembership(
  ctx: MutationCtx,
  groupId: Id<'groups'>,
): Promise<{
  user: Doc<'users'>
  group: Doc<'groups'>
  membership: Doc<'memberships'>
}> {
  const user = await getCurrentUser(ctx)
  if (!user) throw new Error('Not authenticated')
  const group = await ctx.db.get(groupId)
  if (!group) throw new Error('Group not found')
  const membership = await getMembership(ctx, groupId, user._id)
  if (!membership) throw new Error('Not a member of that group')
  return { user, group, membership }
}

/**
 * Admins can change a Group and its membership; plain members cannot.
 * Written as "not a member" so that rows still carrying the old `owner` role
 * keep their privileges until the backfill has renamed them.
 */
function isAdmin(membership: Doc<'memberships'>): boolean {
  return membership.role !== 'member'
}

export const myGroups = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []
    const ids = await getMyGroupIds(ctx, user._id)
    const groups = await Promise.all(ids.map((id) => ctx.db.get(id)))
    return groups
      .filter((g): g is NonNullable<typeof g> => g !== null)
      .map((g) => ({ ...g, isPersonal: g.isPersonal === true }))
  },
})

export const createGroup = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const groupId = await ctx.db.insert('groups', {
      name: args.name,
      slug: await allocateGroupSlug(ctx, {
        name: args.name,
        isPersonal: false,
      }),
      isPersonal: false,
      inviteCode: crypto.randomUUID().slice(0, 8),
    })
    await ctx.db.insert('memberships', {
      groupId,
      userId: user._id,
      role: 'admin',
    })
    return groupId
  },
})

export const renameGroup = mutation({
  args: { groupId: v.id('groups'), name: v.string() },
  handler: async (ctx, args) => {
    const { group, membership } = await requireMembership(ctx, args.groupId)
    if (!isAdmin(membership)) {
      throw new Error('Only an admin can rename a group')
    }
    if (group.isPersonal) {
      throw new Error('A personal group cannot be renamed')
    }
    // The slug follows the name, so the URL keeps telling you which Group you
    // are in. Existing links to the old slug break — accepted in ADR-0002.
    await ctx.db.patch(group._id, {
      name: args.name,
      slug: await allocateGroupSlug(ctx, {
        name: args.name,
        isPersonal: false,
        excludeGroupId: group._id,
      }),
    })
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

    const already = await getMembership(ctx, group._id, user._id)
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

export const leaveGroup = mutation({
  args: { groupId: v.id('groups') },
  handler: async (ctx, args) => {
    const { group, membership } = await requireMembership(ctx, args.groupId)
    // Everyone keeps somewhere private, always.
    if (group.isPersonal) throw new Error('You cannot leave your personal group')
    await ctx.db.delete(membership._id)
  },
})

export const deleteGroup = mutation({
  args: { groupId: v.id('groups') },
  handler: async (ctx, args) => {
    const { group, membership } = await requireMembership(ctx, args.groupId)
    if (!isAdmin(membership)) {
      throw new Error('Only an admin can delete a group')
    }
    if (group.isPersonal) {
      throw new Error('You cannot delete your personal group')
    }

    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    // Deleting a Group out from under its other Members would silently take
    // their content with it; removing them first is a decision for a person,
    // not for this mutation.
    if (memberships.some((m) => m._id !== membership._id)) {
      throw new Error('Remove the other members before deleting this group')
    }

    await ctx.db.delete(membership._id)
    await ctx.db.delete(group._id)
  },
})
