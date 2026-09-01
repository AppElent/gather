import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import {
  getMembership,
  requireGroupBySlug,
  resolveGroupBySlug,
} from './lib/groupAccess'
import { deleteGroupContent } from './lib/groupCascade'
import { allocateGroupSlug } from './lib/groupSlugs'
import { getCurrentUser, getMyGroupIds } from './lib/sharing'

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

/**
 * The Group a `/g/<slug>/…` route is addressing, together with the caller's
 * standing in it — or why they cannot have it.
 *
 * The route gate renders one of the refusals rather than erroring, so the three
 * come back as data. There is deliberately no fallback: a caller who asks for a
 * Group they are not in is refused, never quietly handed one they are in.
 */
export const bySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const resolution = await resolveGroupBySlug(ctx, args.slug)
    if (!resolution.ok) return { ok: false as const, reason: resolution.reason }

    const { group, role } = resolution
    return {
      ok: true as const,
      // Deliberately not the whole row: inviteCode is a capability, and the
      // gate has no use for it.
      group: {
        _id: group._id,
        name: group.name,
        slug: group.slug,
        isPersonal: group.isPersonal,
      },
      role,
    }
  },
})

/**
 * Who is in the Group the URL names.
 *
 * Home shows this whether or not anything has happened yet: it is what makes a
 * Group worth opening on day one, and it is what gives the names in the
 * activity stream faces to belong to. Authorised through the same resolution as
 * everything else — the membership list of a Group you are not in is not
 * public.
 *
 * A name and a standing, and nothing else. No email, because a Member list is
 * not a reason to hand out addresses; no `inviteCode`, for the reason `bySlug`
 * does not return one either — it is a capability, and a query that answers
 * "who is here" has no business also answering "how do I let someone else in".
 * Asking for the code is its own request, and `inviteCode` below is it.
 */
export const members = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.slug)
    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    const users = await Promise.all(
      memberships.map(async (m) => ({ m, user: await ctx.db.get(m.userId) })),
    )
    return users
      .filter(
        (row): row is { m: Doc<'memberships'>; user: Doc<'users'> } =>
          row.user !== null,
      )
      .map(({ m, user }) => ({
        userId: user._id,
        name: user.name,
        role: m.role,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  },
})

/**
 * The code that lets somebody else into the Group the URL names.
 *
 * Deliberately its own query rather than a field on `bySlug` or `members`. The
 * code is a capability — anyone holding it can join — so handing it out is a
 * request a caller has to make on purpose, for one named Group, and not
 * something that rides along with every gate check on every page.
 *
 * Any Member may read it. Inviting a housemate is not an administrative act,
 * and a Group whose only admin is on holiday is still a household.
 */
export const inviteCode = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.slug)
    return group.inviteCode
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
    const slug = await allocateGroupSlug(ctx, {
      name: args.name,
      isPersonal: false,
      excludeGroupId: group._id,
    })
    await ctx.db.patch(group._id, { name: args.name, slug })
    // Returned because the caller is standing on `/g/<old-slug>/settings` and
    // has just made that address stop existing. It cannot work the new slug out
    // for itself — `allocateGroupSlug` resolves collisions — so it is told.
    return slug
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

/**
 * Hand somebody else the admin role, or take it back.
 *
 * Exists because `leaveGroup` refuses the last admin's departure, and a refusal
 * with no way to satisfy it is just a different trap. Admins only: deciding who
 * else may rename or delete the Group is exactly the thing the role is for.
 *
 * A Personal group has one Member and no second role to give.
 */
export const setMemberRole = mutation({
  args: {
    groupId: v.id('groups'),
    userId: v.id('users'),
    role: v.union(v.literal('admin'), v.literal('member')),
  },
  handler: async (ctx, args) => {
    const { group, membership } = await requireMembership(ctx, args.groupId)
    if (!isAdmin(membership)) {
      throw new ConvexError('Only an admin can change roles')
    }
    if (group.isPersonal) {
      throw new ConvexError('A personal group has only you in it')
    }

    const target = await getMembership(ctx, group._id, args.userId)
    if (!target) throw new ConvexError('That person is not in this group')

    // Demoting the last admin leaves the Group with nobody who can undo it —
    // the same hole `leaveGroup` refuses, reached by standing still instead of
    // walking out.
    if (isAdmin(target) && args.role === 'member') {
      const admins = await adminsOf(ctx, group._id)
      if (admins.length <= 1) {
        throw new ConvexError(
          'Make somebody else an admin first — a group cannot be left without one',
        )
      }
    }

    await ctx.db.patch(target._id, { role: args.role })
  },
})

/** Every membership in a Group that carries admin rights. */
async function adminsOf(ctx: QueryCtx, groupId: Id<'groups'>) {
  const memberships = await ctx.db
    .query('memberships')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .collect()
  return memberships.filter(isAdmin)
}

export const leaveGroup = mutation({
  args: { groupId: v.id('groups') },
  handler: async (ctx, args) => {
    const { group, membership } = await requireMembership(ctx, args.groupId)
    // Everyone keeps somewhere private, always.
    if (group.isPersonal)
      throw new Error('You cannot leave your personal group')

    // A Group whose last admin walks out cannot be renamed or deleted by
    // anyone left in it, and nothing short of database repair can put that
    // right — there is no self-service way back into a room nobody administers.
    // So the door is held rather than the damage repaired afterwards, which is
    // the same call `deleteGroup` below makes about its own other Members.
    if (isAdmin(membership)) {
      const others = await ctx.db
        .query('memberships')
        .withIndex('by_group', (q) => q.eq('groupId', group._id))
        .collect()
        .then((all) => all.filter((m) => m._id !== membership._id))

      if (others.length > 0 && !others.some(isAdmin)) {
        throw new ConvexError(
          'You are the only admin. Make somebody else an admin before you leave.',
        )
      }
    }

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

    // The membership goes with everything else the Group contained — this
    // used to delete the two rows and leave every recipe, list, baby and
    // holding in it unreachable, with their photos leaked in storage.
    const files = await deleteGroupContent(ctx, group._id)
    if (files.length) {
      await ctx.scheduler.runAfter(0, internal.cascade.releaseFiles, {
        storageIds: files,
      })
    }
  },
})
