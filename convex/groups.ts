import { groupTimeZoneRefusal } from '@gather/core/refusals'
import { isTimeZoneName } from '@gather/core/task-reminders'
import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { internalQuery, mutation, query } from './_generated/server'
import { rejectConnectedApps } from './lib/connectedApps'
import {
  getMembership,
  groupRefusalError,
  groupRoleValidator,
  requireGroupBySlug,
  resolveGroupBySlug,
} from './lib/groupAccess'
import { destroyGroup, detachFromGroup } from './lib/groupCascade'
import { allocateGroupSlug } from './lib/groupSlugs'
import { getCurrentUser, requireCurrentUser } from './lib/sharing'
import { replaceStoredFile, signedInUploadUrl } from './lib/storedFiles'

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
  const user = await requireCurrentUser(ctx)
  const group = await ctx.db.get(groupId)
  if (!group) throw groupRefusalError('unknown-group')
  const membership = await getMembership(ctx, groupId, user._id)
  if (!membership) throw groupRefusalError('not-a-member')
  return { user, group, membership }
}

/** Admins can change a Group and its membership; plain members cannot. */
function isAdmin(membership: Doc<'memberships'>): boolean {
  return membership.role === 'admin'
}

/**
 * A Group as `myGroups` lists it: the row without its invite code, plus the
 * caller's role and the icon's URL. The validator is the boundary: connected
 * apps (MCP, the TV) read this query too, and the code is a capability they
 * never get. Screens that show it ask `groups.inviteCode`, which refuses
 * connected apps (ADR-0046).
 */
const listedGroupValidator = v.object({
  _id: v.id('groups'),
  _creationTime: v.number(),
  name: v.string(),
  slug: v.string(),
  isPersonal: v.optional(v.boolean()),
  icon: v.optional(v.string()),
  imageId: v.optional(v.id('_storage')),
  timeZone: v.optional(v.string()),
  groceryListId: v.optional(v.id('taskLists')),
  imageUrl: v.union(v.string(), v.null()),
  role: groupRoleValidator,
})

export const myGroups = query({
  args: {},
  returns: v.array(listedGroupValidator),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []
    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
    const groups = await Promise.all(
      memberships.map(async (membership) => ({
        group: await ctx.db.get(membership.groupId),
        role: membership.role,
      })),
    )
    const visible = await Promise.all(
      groups
        .filter(
          (
            row,
          ): row is {
            group: NonNullable<typeof row.group>
            role: 'admin' | 'member'
          } => row.group !== null,
        )
        // Field by field, never the whole row: see `listedGroupValidator`.
        .map(async ({ group, role }) => ({
          _id: group._id,
          _creationTime: group._creationTime,
          name: group.name,
          slug: group.slug,
          isPersonal: group.isPersonal,
          icon: group.icon,
          imageId: group.imageId,
          timeZone: group.timeZone,
          groceryListId: group.groceryListId,
          imageUrl: group.imageId
            ? await ctx.storage.getUrl(group.imageId)
            : null,
          role,
        })),
    )
    return visible.sort(
      (a, b) => a._creationTime - b._creationTime || a._id.localeCompare(b._id),
    )
  },
})

/**
 * The Group a slug addresses, together with the caller's standing in it — or why
 * they cannot have it. For actions, which have no `ctx.db` to call
 * `resolveGroupBySlug` with.
 *
 * There is deliberately no fallback: a caller who asks for a Group they are not
 * in is refused, never quietly handed one they are in.
 */
export const bySlug = internalQuery({
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
    // Group administration stays in the app (ADR-0046).
    await rejectConnectedApps(ctx)
    const { group } = await requireGroupBySlug(ctx, args.slug)
    return group.inviteCode
  },
})

export const createGroup = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    // Group administration stays in the app (ADR-0046).
    await rejectConnectedApps(ctx)
    const user = await requireCurrentUser(ctx)
    const groupId = await ctx.db.insert('groups', {
      name: args.name,
      slug: await allocateGroupSlug(ctx, {
        name: args.name,
      }),
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
  returns: v.null(),
  handler: async (ctx, args) => {
    const { group, membership } = await requireMembership(ctx, args.groupId)
    if (!isAdmin(membership)) {
      throw new ConvexError('Only an admin can rename a group')
    }
    // The slug follows the name, and the old slug stops resolving.
    const slug = await allocateGroupSlug(ctx, {
      name: args.name,
      excludeGroupId: group._id,
    })
    await ctx.db.patch(group._id, { name: args.name, slug })
    return null
  },
})

/**
 * The zone the Group's "today" is in (APP-475); null goes back to each
 * device's own. Whoever may rename the Group may set it.
 */
export const setTimeZone = mutation({
  args: {
    groupId: v.id('groups'),
    timeZone: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { group, membership } = await requireMembership(ctx, args.groupId)
    if (!isAdmin(membership)) {
      throw new ConvexError(groupTimeZoneRefusal('admin-only'))
    }
    if (args.timeZone !== null && !isTimeZoneName(args.timeZone)) {
      throw new ConvexError(groupTimeZoneRefusal('unknown-zone'))
    }
    await ctx.db.patch(group._id, { timeZone: args.timeZone ?? undefined })
    return null
  },
})

export const generateImageUploadUrl = mutation({
  args: {},
  handler: signedInUploadUrl,
})

export const updateAppearance = mutation({
  args: {
    groupId: v.id('groups'),
    icon: v.optional(v.union(v.string(), v.null())),
    imageId: v.optional(v.union(v.id('_storage'), v.null())),
  },
  handler: async (ctx, args) => {
    const { group, membership } = await requireMembership(ctx, args.groupId)
    if (!isAdmin(membership)) throw new ConvexError('Only an admin can edit a group')
    const imageId = args.imageId
    await ctx.db.patch(group._id, {
      ...(args.icon === undefined ? {} : { icon: args.icon ?? undefined }),
      ...(imageId === undefined ? {} : { imageId: imageId ?? undefined }),
    })
    await replaceStoredFile(ctx, group.imageId, imageId)
  },
})

export const joinByInvite = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    // Group administration stays in the app (ADR-0046).
    await rejectConnectedApps(ctx)
    const user = await requireCurrentUser(ctx)
    const group = await ctx.db
      .query('groups')
      .withIndex('by_inviteCode', (q) => q.eq('inviteCode', args.inviteCode))
      .unique()
    if (!group) throw new ConvexError('Invalid invite code')

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
 */
export const setMemberRole = mutation({
  args: {
    groupId: v.id('groups'),
    userId: v.id('users'),
    role: groupRoleValidator,
  },
  handler: async (ctx, args) => {
    // Group administration stays in the app (ADR-0046).
    await rejectConnectedApps(ctx)
    const { group, membership } = await requireMembership(ctx, args.groupId)
    if (!isAdmin(membership)) {
      throw new ConvexError('Only an admin can change roles')
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

/**
 * Whether the caller may leave a Group, and why not.
 *
 * - `last-member`: nobody else is in it. Leaving would leave a Group with no
 *   Members that nobody can reach again, so they delete it instead.
 * - `only-admin`: others remain and none of them is an admin. Nobody left
 *   could rename, delete or hand the Group on.
 * - `allowed`: anything else.
 */
export type LeaveStatus = 'allowed' | 'only-admin' | 'last-member'

const leaveStatusValidator = v.union(
  v.literal('allowed'),
  v.literal('only-admin'),
  v.literal('last-member'),
)

/** The refusals `leaveGroup` and `deleteGroup` give for the rule below. */
const LAST_MEMBER = 'You are the last member. Delete the group instead.'
const ONLY_ADMIN =
  'You are the only admin. Make somebody else an admin before you leave.'

/**
 * The caller's ways out of a Group, read from its memberships: one rule for
 * `leaveGroup`, `deleteGroup` and `leaveStatus`, so what the apps offer and
 * what the server allows cannot drift apart.
 *
 * A membership whose user record is gone is nobody: it has no name on the
 * Members list, it cannot be made an admin, and it cannot leave. Counting it
 * would hold the door for a person who is not there, with no way to satisfy
 * the refusal (APP-362).
 *
 * Deleting is open to the last Member whatever their role: once everyone else
 * is gone, it takes nobody else's content with it. That is how a Member is
 * not stranded in a Group whose admin deleted their account.
 */
async function exitsFor(
  ctx: QueryCtx,
  membership: Doc<'memberships'>,
): Promise<{ leave: LeaveStatus; canDelete: boolean }> {
  const memberships = await ctx.db
    .query('memberships')
    .withIndex('by_group', (q) => q.eq('groupId', membership.groupId))
    .collect()
  const others: Doc<'memberships'>[] = []
  for (const other of memberships) {
    if (other._id === membership._id) continue
    if ((await ctx.db.get(other.userId)) === null) continue
    others.push(other)
  }
  if (others.length === 0) return { leave: 'last-member', canDelete: true }
  const leave =
    isAdmin(membership) && !others.some(isAdmin) ? 'only-admin' : 'allowed'
  return { leave, canDelete: false }
}

/**
 * The caller's ways out of the Group the URL names, so the apps offer Leave
 * or Delete by the server's rule instead of counting Members themselves.
 */
export const leaveStatus = query({
  args: { slug: v.string() },
  returns: v.object({ leave: leaveStatusValidator, canDelete: v.boolean() }),
  handler: async (ctx, args) => {
    // Group administration stays in the app (ADR-0046).
    await rejectConnectedApps(ctx)
    const { membership } = await requireGroupBySlug(ctx, args.slug)
    return await exitsFor(ctx, membership)
  },
})

export const leaveGroup = mutation({
  args: { groupId: v.id('groups') },
  handler: async (ctx, args) => {
    // Group administration stays in the app (ADR-0046).
    await rejectConnectedApps(ctx)
    const { group, membership } = await requireMembership(ctx, args.groupId)
    // A Group whose last admin walks out cannot be renamed or deleted by
    // anyone left in it, and nothing short of database repair can put that
    // right — there is no self-service way back into a room nobody administers.
    // So the door is held rather than the damage repaired afterwards, which is
    // the same call `deleteGroup` below makes about its own other Members.
    // The last Member is held too: walking out would leave a Group with no
    // Members, so they delete it instead. Not here, silently: deleting
    // everything in a Group is a decision the reader confirms.
    const { leave } = await exitsFor(ctx, membership)
    if (leave === 'last-member') throw new ConvexError(LAST_MEMBER)
    if (leave === 'only-admin') throw new ConvexError(ONLY_ADMIN)

    await detachFromGroup(ctx, membership.userId, group._id)
    await ctx.db.delete(membership._id)
  },
})

export const deleteGroup = mutation({
  args: { groupId: v.id('groups') },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Group administration stays in the app (ADR-0046).
    await rejectConnectedApps(ctx)
    const { group, membership } = await requireMembership(ctx, args.groupId)
    const { canDelete } = await exitsFor(ctx, membership)
    if (!canDelete && !isAdmin(membership)) {
      throw new ConvexError('Only an admin can delete a group')
    }
    // Deleting a Group out from under its other Members would silently take
    // their content with it; removing them first is a decision for a person,
    // not for this mutation.
    if (!canDelete) {
      throw new ConvexError('Remove the other members before deleting this group')
    }

    await destroyGroup(ctx, group._id)
    return null
  },
})
