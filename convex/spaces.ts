import { ConvexError, v } from 'convex/values'
import { internalMutation, internalQuery, mutation, query } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { resolvePinnedModuleIds } from '../src/lib/spaceNavigation'
import { resolveDashboard } from '../src/lib/widgets'
import { createNewSpaceDefaults } from './lib/spaceDefaults'
import { readSpaceClaims, requireActiveSpace } from './lib/spaceAuth'
import { validatePinnedModules } from './spacePreferences'

type DbCtx = { db: any }

type MembershipRole = 'admin' | 'member'

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()
    if (!user) return []

    const memberships = await ctx.db
      .query('spaceMemberships')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
    const spaces = await Promise.all(
      memberships.map((membership) => ctx.db.get(membership.spaceId)),
    )
    return spaces.filter((space): space is Doc<'spaces'> => space !== null)
  },
})

export const activeSpace = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError('Authentication required')
    const claims = readSpaceClaims(identity)
    const space = await ctx.db.query('spaces').withIndex('by_clerk_organization', (q) => q.eq('clerkOrganizationId', claims.clerkOrganizationId)).unique()
    if (!space || space.status !== 'active') throw new ConvexError('Gather Space not found')
    return { spaceSlug: space.slug, clerkOrganizationId: space.clerkOrganizationId }
  },
})
export const context = query({
  args: { spaceSlug: v.string() },
  handler: async (ctx, args) => {
    const { space, role, user } = await requireActiveSpace(ctx, args)
    const [moduleStates, preference] = await Promise.all([
      ctx.db
        .query('spaceModules')
        .withIndex('by_space', (q) => q.eq('spaceId', space._id))
        .collect(),
      ctx.db
        .query('spacePreferences')
        .withIndex('by_space_user', (q: any) =>
          q.eq('spaceId', space._id).eq('userId', user._id),
        )
        .unique(),
    ])

    const personalPins = preference?.pinnedModuleIds
    const personalDashboard = preference?.dashboard

    return {
      space,
      user,
      role,
      modules: moduleStates,
      navigation: {
        source: personalPins === undefined ? 'space' : 'personal',
        pinnedModuleIds: resolvePinnedModuleIds(
          space.defaultPinnedModuleIds,
          personalPins,
        ),
        spaceDefaultPinnedModuleIds: space.defaultPinnedModuleIds,
        personalPinnedModuleIds: personalPins,
      },
      dashboard: {
        source: personalDashboard === undefined ? 'space' : 'personal',
        widgets: resolveDashboard(space.defaultDashboard, personalDashboard),
        spaceDefaultDashboard: space.defaultDashboard,
        personalDashboard,
      },
    }
  },
})

export const ensureMembershipProjection = mutation({
  args: { spaceSlug: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError('Authentication required')
    const claims = readSpaceClaims(identity)
    const space = await findSpaceBySlug(ctx, args.spaceSlug)
    if (!space || space.clerkOrganizationId !== claims.clerkOrganizationId) {
      throw new ConvexError('Active organization is not a Gather Space')
    }
    const user = await ensureUserProjection(ctx, {
      clerkUserId: identity.subject,
      name: identity.name ?? 'Member',
      email: identity.email ?? '',
      imageUrl: identity.pictureUrl ?? undefined,
    })
    await upsertMembershipProjection(ctx, {
      spaceId: space._id,
      userId: user._id,
      clerkUserId: identity.subject,
      role: claims.role,
      now: Date.now(),
    })
    return { spaceId: space._id }
  },
})

export const provisionTagged = internalMutation({
  args: {
    clerkOrganizationId: v.string(),
    clerkOrganizationName: v.string(),
    creatorClerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('spaces')
      .withIndex('by_clerk_organization', (q) =>
        q.eq('clerkOrganizationId', args.clerkOrganizationId),
      )
      .unique()
    const now = Date.now()
    const user = await ensureUserProjection(ctx, {
      clerkUserId: args.creatorClerkUserId,
      name: 'Member',
      email: '',
    })

    if (existing) {
      await upsertMembershipProjection(ctx, {
        spaceId: existing._id,
        userId: user._id,
        clerkUserId: args.creatorClerkUserId,
        role: 'admin',
        now,
      })
      return { spaceId: existing._id, spaceSlug: existing.slug }
    }

    const defaults = createNewSpaceDefaults()
    const slug = await allocateSpaceSlug(ctx, args.clerkOrganizationName)
    const spaceId = await ctx.db.insert('spaces', {
      clerkOrganizationId: args.clerkOrganizationId,
      slug,
      name: args.clerkOrganizationName,
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

    await upsertMembershipProjection(ctx, {
      spaceId,
      userId: user._id,
      clerkUserId: args.creatorClerkUserId,
      role: 'admin',
      now,
    })

    return { spaceId, spaceSlug: slug }
  },
})

export const saveDefaultNavigation = mutation({
  args: { spaceSlug: v.string(), pinnedModuleIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const { space } = await requireActiveSpace(ctx, {
      spaceSlug: args.spaceSlug,
      requireAdmin: true,
    })
    await validatePinnedModules(ctx, space._id, args.pinnedModuleIds)
    await ctx.db.patch(space._id, {
      defaultPinnedModuleIds: [...args.pinnedModuleIds],
      updatedAt: Date.now(),
    })
  },
})
export const resolveActionContext = internalQuery({
  args: {
    spaceSlug: v.string(),
    expectedClerkOrganizationId: v.string(),
    requireAdmin: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError('Authentication required')
    readSpaceClaims(identity, args.requireAdmin)
    const space = await findSpaceBySlug(ctx, args.spaceSlug)
    if (!space) throw new ConvexError('Space not found')
    if (space.clerkOrganizationId !== args.expectedClerkOrganizationId) {
      throw new ConvexError('Active organization does not match Space')
    }
    return { space }
  },
})

const projectedMembership = v.object({
  clerkMembershipId: v.string(),
  clerkUserId: v.string(),
  role: v.union(v.literal('admin'), v.literal('member')),
})

export const reconcileMemberships = internalMutation({
  args: { clerkOrganizationId: v.string(), memberships: v.array(projectedMembership) },
  handler: async (ctx, args) => {
    const space = await ctx.db
      .query('spaces')
      .withIndex('by_clerk_organization', (q) =>
        q.eq('clerkOrganizationId', args.clerkOrganizationId),
      )
      .unique()
    if (!space) throw new ConvexError('Space not found')

    const now = Date.now()
    const current = await ctx.db
      .query('spaceMemberships')
      .withIndex('by_space', (q) => q.eq('spaceId', space._id))
      .collect()
    for (const membership of current) await ctx.db.delete(membership._id)

    for (const membership of args.memberships) {
      const user = await ensureUserProjection(ctx, {
        clerkUserId: membership.clerkUserId,
        name: 'Member',
        email: '',
      })
      await ctx.db.insert('spaceMemberships', {
        spaceId: space._id,
        userId: user._id,
        clerkMembershipId: membership.clerkMembershipId,
        clerkUserId: membership.clerkUserId,
        role: membership.role,
        createdAt: now,
        updatedAt: now,
      })
    }
  },
})

export const cleanupForDeletion = internalMutation({
  args: { spaceId: v.id('spaces') },
  handler: async (ctx, args) => {
    for (const membership of await ctx.db
      .query('spaceMemberships')
      .withIndex('by_space', (q) => q.eq('spaceId', args.spaceId))
      .collect()) {
      await ctx.db.delete(membership._id)
    }
    for (const module of await ctx.db
      .query('spaceModules')
      .withIndex('by_space', (q) => q.eq('spaceId', args.spaceId))
      .collect()) {
      await ctx.db.delete(module._id)
    }
    for (const preference of await ctx.db
      .query('spacePreferences')
      .withIndex('by_space_user', (q) => q.eq('spaceId', args.spaceId))
      .collect()) {
      await ctx.db.delete(preference._id)
    }
  },
})

export const markDeleting = internalMutation({
  args: { spaceId: v.id('spaces') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.spaceId, { status: 'deleting', updatedAt: Date.now() })
  },
})

export const finalizeDeleted = internalMutation({
  args: { spaceId: v.id('spaces') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.spaceId)
  },
})

async function findSpaceBySlug(ctx: DbCtx, slug: string) {
  return await ctx.db
    .query('spaces')
    .withIndex('by_slug', (q: any) => q.eq('slug', slug))
    .unique()
}

async function allocateSpaceSlug(
  ctx: DbCtx,
  name: string,
) {
  const base = slugifySpaceName(name)
  for (let attempt = 1; ; attempt += 1) {
    const slug = attempt === 1 ? base : `${base}-${attempt}`
    const existing = await findSpaceBySlug(ctx, slug)
    if (!existing) return slug
  }
}

function slugifySpaceName(name: string) {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'space'
}

async function ensureUserProjection(
  ctx: DbCtx,
  input: {
    clerkUserId: string
    name: string
    email: string
    imageUrl?: string
  },
) {
  const existing = await ctx.db
    .query('users')
    .withIndex('by_clerkId', (q: any) => q.eq('clerkId', input.clerkUserId))
    .unique()
  if (existing) return existing

  const userId = await ctx.db.insert('users', {
    clerkId: input.clerkUserId,
    name: input.name,
    email: input.email,
    imageUrl: input.imageUrl,
  })
  const user = await ctx.db.get(userId)
  if (!user) throw new ConvexError('User projection required')
  return user
}

async function upsertMembershipProjection(
  ctx: DbCtx,
  input: {
    spaceId: Id<'spaces'>
    userId: Id<'users'>
    clerkUserId: string
    role: MembershipRole
    now: number
    clerkMembershipId?: string
  },
) {
  const existing = await ctx.db
    .query('spaceMemberships')
    .withIndex('by_space_user', (q: any) =>
      q.eq('spaceId', input.spaceId).eq('userId', input.userId),
    )
    .unique()

  if (existing) {
    await ctx.db.patch(existing._id, {
      clerkMembershipId: input.clerkMembershipId,
      clerkUserId: input.clerkUserId,
      role: input.role,
      updatedAt: input.now,
    })
    return existing._id
  }

  return await ctx.db.insert('spaceMemberships', {
    spaceId: input.spaceId,
    userId: input.userId,
    clerkMembershipId: input.clerkMembershipId,
    clerkUserId: input.clerkUserId,
    role: input.role,
    createdAt: input.now,
    updatedAt: input.now,
  })
}


