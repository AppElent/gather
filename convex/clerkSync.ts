import { v } from 'convex/values'
import { internalMutation, internalQuery } from './_generated/server'
import { createNewSpaceDefaults } from './lib/spaceDefaults'

const projectionEvent = v.union(
  v.object({
    kind: v.literal('user.upsert'),
    clerkUserId: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
  }),
  v.object({
    kind: v.literal('space.upsert'),
    clerkOrganizationId: v.string(),
    name: v.string(),
  }),
  v.object({ kind: v.literal('space.delete'), clerkOrganizationId: v.string() }),
  v.object({
    kind: v.literal('membership.upsert'),
    clerkMembershipId: v.string(),
    clerkOrganizationId: v.string(),
    clerkUserId: v.string(),
    role: v.union(v.literal('admin'), v.literal('member')),
  }),
  v.object({ kind: v.literal('membership.delete'), clerkMembershipId: v.string() }),
)

const projectionContext = v.optional(
  v.object({
    membership: v.optional(
      v.object({
        clerkOrganizationName: v.string(),
        userName: v.string(),
        userEmail: v.string(),
        userImageUrl: v.optional(v.string()),
      }),
    ),
  }),
)

export const apply = internalMutation({
  args: { event: projectionEvent, context: projectionContext },
  handler: async (ctx, { event, context }) => {
    if (event.kind === 'user.upsert') return await updateKnownUser(ctx, event)
    if (event.kind === 'space.upsert') {
      return await upsertSpace(ctx, event.clerkOrganizationId, event.name)
    }
    if (event.kind === 'space.delete') {
      return await removeSpace(ctx, event.clerkOrganizationId)
    }
    if (event.kind === 'membership.delete') {
      return await removeMembership(ctx, event.clerkMembershipId)
    }

    const membershipContext = context?.membership
    const space = await ensureSpaceForMembership(
      ctx,
      event.clerkOrganizationId,
      membershipContext?.clerkOrganizationName ?? 'Space',
    )
    const user = await ensureUserFromMembership(ctx, event.clerkUserId, {
      name: membershipContext?.userName ?? 'Member',
      email: membershipContext?.userEmail ?? '',
      imageUrl: membershipContext?.userImageUrl,
    })
    const now = Date.now()

    const existing = await ctx.db
      .query('spaceMemberships')
      .withIndex('by_clerk_membership', (q) =>
        q.eq('clerkMembershipId', event.clerkMembershipId),
      )
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, {
        spaceId: space._id,
        userId: user._id,
        clerkUserId: event.clerkUserId,
        role: event.role,
        updatedAt: now,
      })
      return
    }

    const bySpaceUser = await ctx.db
      .query('spaceMemberships')
      .withIndex('by_space_user', (q) =>
        q.eq('spaceId', space._id).eq('userId', user._id),
      )
      .unique()
    if (bySpaceUser) {
      await ctx.db.patch(bySpaceUser._id, {
        clerkMembershipId: event.clerkMembershipId,
        clerkUserId: event.clerkUserId,
        role: event.role,
        updatedAt: now,
      })
      return
    }

    await ctx.db.insert('spaceMemberships', {
      spaceId: space._id,
      userId: user._id,
      clerkMembershipId: event.clerkMembershipId,
      clerkUserId: event.clerkUserId,
      role: event.role,
      createdAt: now,
      updatedAt: now,
    })
  },
})

async function upsertSpace(ctx: any, clerkOrganizationId: string, name: string) {
  const existing = await findSpace(ctx, clerkOrganizationId)
  if (existing) {
    await ctx.db.patch(existing._id, { name, updatedAt: Date.now() })
    return { ...existing, name }
  }
  return await insertSpace(ctx, clerkOrganizationId, name)
}

async function ensureSpaceForMembership(
  ctx: any,
  clerkOrganizationId: string,
  name: string,
) {
  return (await findSpace(ctx, clerkOrganizationId)) ?? (await insertSpace(ctx, clerkOrganizationId, name))
}

async function findSpace(ctx: any, clerkOrganizationId: string) {
  return await ctx.db
    .query('spaces')
    .withIndex('by_clerk_organization', (q: any) =>
      q.eq('clerkOrganizationId', clerkOrganizationId),
    )
    .unique()
}

async function insertSpace(ctx: any, clerkOrganizationId: string, name: string) {
  const now = Date.now()
  const defaults = createNewSpaceDefaults()
  const spaceId = await ctx.db.insert('spaces', {
    clerkOrganizationId,
    slug: `clerk-${clerkOrganizationId}`,
    name,
    status: 'active',
    defaultPinnedModuleIds: defaults.pinnedModuleIds,
    defaultDashboard: defaults.dashboard,
    createdAt: now,
    updatedAt: now,
  })

  for (const moduleState of defaults.moduleStates) {
    await ctx.db.insert('spaceModules', {
      spaceId,
      moduleId: moduleState.moduleId,
      state: moduleState.state,
      createdAt: now,
      updatedAt: now,
    })
  }

  return await ctx.db.get(spaceId)
}

async function ensureUserFromMembership(
  ctx: any,
  clerkUserId: string,
  profile: { name: string; email: string; imageUrl?: string },
) {
  const existing = await ctx.db
    .query('users')
    .withIndex('by_clerkId', (q: any) => q.eq('clerkId', clerkUserId))
    .unique()
  if (existing) {
    await ctx.db.patch(existing._id, {
      name: profile.name,
      email: profile.email,
      imageUrl: profile.imageUrl,
    })
    return { ...existing, ...profile }
  }

  const userId = await ctx.db.insert('users', {
    clerkId: clerkUserId,
    name: profile.name,
    email: profile.email,
    imageUrl: profile.imageUrl,
  })
  return await ctx.db.get(userId)
}

async function updateKnownUser(
  ctx: any,
  event: {
    clerkUserId: string
    name: string
    email: string
    imageUrl?: string
  },
) {
  const user = await ctx.db
    .query('users')
    .withIndex('by_clerkId', (q: any) => q.eq('clerkId', event.clerkUserId))
    .unique()
  if (!user) return

  const membership = await ctx.db
    .query('spaceMemberships')
    .withIndex('by_user', (q: any) => q.eq('userId', user._id))
    .first()
  if (!membership) return

  await ctx.db.patch(user._id, {
    name: event.name,
    email: event.email,
    imageUrl: event.imageUrl,
  })
}

async function removeMembership(ctx: any, clerkMembershipId: string) {
  const membership = await ctx.db
    .query('spaceMemberships')
    .withIndex('by_clerk_membership', (q: any) =>
      q.eq('clerkMembershipId', clerkMembershipId),
    )
    .unique()
  if (membership) await ctx.db.delete(membership._id)
}

async function removeSpace(ctx: any, clerkOrganizationId: string) {
  const space = await findSpace(ctx, clerkOrganizationId)
  if (!space) return

  for (const membership of await ctx.db
    .query('spaceMemberships')
    .withIndex('by_space', (q: any) => q.eq('spaceId', space._id))
    .collect()) {
    await ctx.db.delete(membership._id)
  }
  for (const module of await ctx.db
    .query('spaceModules')
    .withIndex('by_space', (q: any) => q.eq('spaceId', space._id))
    .collect()) {
    await ctx.db.delete(module._id)
  }
  for (const preference of await ctx.db
    .query('spacePreferences')
    .withIndex('by_space_user', (q: any) => q.eq('spaceId', space._id))
    .collect()) {
    await ctx.db.delete(preference._id)
  }
  await ctx.db.delete(space._id)
}

export const hasSpace = internalQuery({
  args: { clerkOrganizationId: v.string() },
  handler: async (ctx, args) =>
    !!(await ctx.db
      .query('spaces')
      .withIndex('by_clerk_organization', (q) =>
        q.eq('clerkOrganizationId', args.clerkOrganizationId),
      )
      .unique()),
})

export const hasMembership = internalQuery({
  args: { clerkMembershipId: v.string() },
  handler: async (ctx, args) =>
    !!(await ctx.db
      .query('spaceMemberships')
      .withIndex('by_clerk_membership', (q) =>
        q.eq('clerkMembershipId', args.clerkMembershipId),
      )
      .unique()),
})

export const userHasMembership = internalQuery({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkUserId))
      .unique()
    if (!user) return false
    return !!(await ctx.db
      .query('spaceMemberships')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .first())
  },
})
