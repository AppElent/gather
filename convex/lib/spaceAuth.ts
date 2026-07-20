import { ConvexError } from 'convex/values'
import type { ActionCtx, MutationCtx, QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import type { SpaceRole } from '../../src/lib/modules'

type IdentityClaims = {
  subject?: string
  org_id?: unknown
  org_role?: unknown
  [key: string]: unknown
}

export interface SpaceClaims {
  clerkOrganizationId: string
  role: SpaceRole
}

export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError('Authentication required')

  const user = await ctx.db
    .query('users')
    .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
    .unique()
  if (!user) throw new ConvexError('User projection required')
  return user
}

export function readSpaceClaims(
  identity: IdentityClaims | null | undefined,
  requireAdmin = false,
): SpaceClaims {
  const clerkOrganizationId = identity?.org_id
  if (typeof clerkOrganizationId !== 'string' || clerkOrganizationId.length === 0) {
    throw new ConvexError('Active organization required')
  }

  const rawRole = identity?.org_role
  let role: SpaceRole
  if (rawRole === 'org:admin' || rawRole === 'admin') {
    role = 'admin'
  } else if (rawRole === 'org:member' || rawRole === 'member') {
    role = 'member'
  } else {
    throw new ConvexError('Unsupported Gather Space role')
  }

  if (requireAdmin && role !== 'admin') {
    throw new ConvexError('Space admin required')
  }

  return { clerkOrganizationId, role }
}

export async function requireActionSpaceClaims(
  ctx: ActionCtx,
  requireAdmin = false,
) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError('Authentication required')
  return readSpaceClaims(identity as IdentityClaims, requireAdmin)
}

export async function requireActiveSpace(
  ctx: QueryCtx | MutationCtx,
  args: { spaceSlug: string; requireAdmin?: boolean },
): Promise<{ user: Doc<'users'>; space: Doc<'spaces'>; role: SpaceRole }> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError('Authentication required')
  const claims = readSpaceClaims(identity as IdentityClaims, args.requireAdmin)
  const space = await ctx.db
    .query('spaces')
    .withIndex('by_slug', (q) => q.eq('slug', args.spaceSlug))
    .unique()
  if (!space) throw new ConvexError('Space not found')
  if (space.clerkOrganizationId !== claims.clerkOrganizationId) {
    throw new ConvexError('Active organization does not match Space')
  }
  if (space.status !== 'active') throw new ConvexError('Space is being deleted')
  const user = await requireUser(ctx)
  return { user, space, role: claims.role }
}
