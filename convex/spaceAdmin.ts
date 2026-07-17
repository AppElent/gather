import { ConvexError, v } from 'convex/values'
import { action } from './_generated/server'
import { internal } from './_generated/api'
import { createClerkClient } from '@clerk/backend'
import {
  GATHER_INVITATION_MARKER,
  GATHER_ORGANIZATION_MARKER,
  isGatherOrganizationMetadata,
} from '../shared/gatherOrganizations'
import type {
  ClerkOrganizationGateway,
  ClerkOrganizationRecord,
} from './lib/clerkOrganizationGateway'
import { findOrCreateGatherOrganization } from './lib/gatherOrganizationCreation'
import { readSpaceClaims } from './lib/spaceAuth'
import {
  assertAdminCanLeave,
  clerkRoleFor,
  collectPaginatedMemberships,
  normalizeClerkMemberships,
  reconciliationSnapshot,
  type SpaceMembership,
} from './lib/spaceAdministration'


export function requireGatherOrganization(organization: {
  publicMetadata: unknown
}): void {
  if (!isGatherOrganizationMetadata(organization.publicMetadata)) {
    throw new ConvexError('Gather Space marker mismatch')
  }
}

export function gatherInvitationOptions() {
  return { publicMetadata: GATHER_INVITATION_MARKER }
}
export function normalizeSpaceName(name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ')
  if (!normalized) throw new ConvexError('Space name is required')
  return normalized
}

export function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new ConvexError(`${name} is required`)
  return value
}

export function createRealClerkOrganizationGateway(
  secretKey: string,
): ClerkOrganizationGateway {
  const clerk = createClerkClient({ secretKey })

  function toRecord(organization: any): ClerkOrganizationRecord {
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      createdBy: organization.createdBy ?? null,
      publicMetadata: organization.publicMetadata,
    }
  }

  return {
    async getBySlug(slug) {
      try {
        const response = await clerk.organizations.getOrganization({ slug })
        return toRecord(response)
      } catch (error) {
        if (isClerkNotFound(error)) return null
        throw error
      }
    },
    async getById(id) {
      try {
        const response = await clerk.organizations.getOrganization({ organizationId: id })
        return toRecord(response)
      } catch (error) {
        if (isClerkNotFound(error)) return null
        throw error
      }
    },
    async create(input) {
      const response = await clerk.organizations.createOrganization({
        name: input.name,
        slug: input.slug,
        createdBy: input.createdBy,
        publicMetadata: input.publicMetadata,
      })
      return toRecord(response)
    },
  }
}

function isClerkNotFound(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const value = error as { status?: unknown; statusCode?: unknown; errors?: unknown }
  if (value.status === 404 || value.statusCode === 404) return true
  if (!Array.isArray(value.errors)) return false
  return value.errors.some((entry) => {
    if (!entry || typeof entry !== 'object') return false
    const code = (entry as { code?: unknown }).code
    return code === 'resource_not_found' || code === 'not_found'
  })
}

export async function createGatherSpace(input: {
  gateway: ClerkOrganizationGateway
  name: string
  requestId: string
  creatorClerkUserId: string
  provision: (organization: ClerkOrganizationRecord) => Promise<{ spaceSlug: string }>
}) {
  const name = normalizeSpaceName(input.name)
  const organization = await findOrCreateGatherOrganization(input.gateway, {
    name,
    requestId: input.requestId,
    creatorClerkUserId: input.creatorClerkUserId,
  })

  const projection = await input.provision(organization)
  return {
    clerkOrganizationId: organization.id,
    spaceSlug: projection.spaceSlug,
  }
}
export const create = action({
  args: { name: v.string(), requestId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError('Authentication required')

    return createGatherSpace({
      gateway: createRealClerkOrganizationGateway(requireEnv('CLERK_SECRET_KEY')),
      name: args.name,
      requestId: args.requestId,
      creatorClerkUserId: identity.subject,
      provision: async (organization) => {
        const projection = await ctx.runMutation((internal as any).spaces.provisionTagged, {
          clerkOrganizationId: organization.id,
          clerkOrganizationName: organization.name,
          creatorClerkUserId: identity.subject,
        })
        return { spaceSlug: projection.spaceSlug }
      },
    })
  },
})

export { GATHER_ORGANIZATION_MARKER }


type ClerkAdminClient = ReturnType<typeof createClerkClient>

export type AdminContext = {
  identity: { subject: string }
  space: { _id: any; clerkOrganizationId: string; name: string; status: 'active' | 'deleting' }
  clerk: ClerkAdminClient
}

async function requireAdminContext(
  ctx: any,
  spaceSlug: string,
  options: { allowMissingDeletingOrganization?: boolean } = {},
): Promise<AdminContext> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError('Authentication required')
  const claims = readSpaceClaims(identity, true)
  const { space } = await ctx.runQuery((internal as any).spaces.resolveActionContext, {
    spaceSlug,
    expectedClerkOrganizationId: claims.clerkOrganizationId,
    requireAdmin: true,
  })
  const clerk = createClerkClient({ secretKey: requireEnv('CLERK_SECRET_KEY') })
  try {
    const organization = await clerk.organizations.getOrganization({
      organizationId: space.clerkOrganizationId,
    })
    requireGatherOrganization(organization)
  } catch (error) {
    if (!(options.allowMissingDeletingOrganization && space.status === 'deleting' && isClerkNotFound(error))) {
      throw error
    }
  }
  return { identity, space, clerk }
}

async function listRawClerkMemberships(clerk: ClerkAdminClient, organizationId: string) {
  return await collectPaginatedMemberships((page) =>
    clerk.organizations.getOrganizationMembershipList({
      organizationId,
      limit: page.limit,
      offset: page.offset,
    }) as Promise<any>,
  )
}

async function listClerkMemberships(clerk: ClerkAdminClient, organizationId: string) {
  return normalizeClerkMemberships(
    (await listRawClerkMemberships(clerk, organizationId)) as any[],
  )
}

export const rename = action({
  args: { spaceSlug: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const { clerk, space } = await requireAdminContext(ctx, args.spaceSlug)
    const name = normalizeSpaceName(args.name)
    await clerk.organizations.updateOrganization(space.clerkOrganizationId, { name })
    await ctx.runMutation((internal as any).clerkSync.apply, {
      event: { kind: 'space.upsert', clerkOrganizationId: space.clerkOrganizationId, name },
    })
  },
})

export async function inviteGatherMember(input: {
  clerk: Pick<ClerkAdminClient, 'organizations'>
  organizationId: string
  inviterUserId: string
  emailAddress: string
  publicAppOrigin: string
}) {
  return await input.clerk.organizations.createOrganizationInvitation({
    organizationId: input.organizationId,
    inviterUserId: input.inviterUserId,
    emailAddress: input.emailAddress,
    role: 'org:member',
    publicMetadata: GATHER_INVITATION_MARKER,
    redirectUrl: `${input.publicAppOrigin}/onboarding`,
  })
}

export async function deleteClerkOrganizationForSpace(input: {
  clerk: Pick<ClerkAdminClient, 'organizations'>
  clerkOrganizationId: string
}) {
  try {
    await input.clerk.organizations.deleteOrganization(input.clerkOrganizationId)
  } catch (error) {
    if (!isClerkNotFound(error)) throw error
  }
}
export const invite = action({
  args: { spaceSlug: v.string(), emailAddress: v.string(), publicAppOrigin: v.string() },
  handler: async (ctx, args) => {
    const { clerk, space, identity } = await requireAdminContext(ctx, args.spaceSlug)
    return await inviteGatherMember({
      clerk,
      organizationId: space.clerkOrganizationId,
      inviterUserId: identity.subject,
      emailAddress: args.emailAddress,
      publicAppOrigin: args.publicAppOrigin,
    })
  },
})

export const revokeInvitation = action({
  args: { spaceSlug: v.string(), invitationId: v.string() },
  handler: async (ctx, args) => {
    const { clerk, space, identity } = await requireAdminContext(ctx, args.spaceSlug)
    await clerk.organizations.revokeOrganizationInvitation({
      organizationId: space.clerkOrganizationId,
      invitationId: args.invitationId,
      requestingUserId: identity.subject,
    })
  },
})


export type MembershipProjectionEvent =
  | {
      kind: 'membership.upsert'
      clerkMembershipId: string
      clerkOrganizationId: string
      clerkUserId: string
      role: 'admin' | 'member'
    }
  | { kind: 'membership.delete'; clerkMembershipId: string }

export async function changeGatherMemberRole(input: {
  clerk: Pick<ClerkAdminClient, 'organizations'>
  organizationId: string
  memberships: SpaceMembership[]
  clerkMembershipId: string
  role: 'admin' | 'member'
  applyProjection: (event: MembershipProjectionEvent) => Promise<unknown>
}) {
  const target = input.memberships.find((membership) => membership.id === input.clerkMembershipId)
  if (!target) throw new ConvexError('Clerk membership not found')
  if (target.role === 'admin' && input.role === 'member') {
    assertAdminCanLeave(input.memberships, input.clerkMembershipId)
  }
  await input.clerk.organizations.updateOrganizationMembership({
    organizationId: input.organizationId,
    userId: target.userId,
    role: clerkRoleFor(input.role),
  })
  await input.applyProjection({
    kind: 'membership.upsert',
    clerkMembershipId: target.id,
    clerkOrganizationId: input.organizationId,
    clerkUserId: target.userId,
    role: input.role,
  })
}

export async function removeGatherMember(input: {
  clerk: Pick<ClerkAdminClient, 'organizations'>
  organizationId: string
  memberships: SpaceMembership[]
  clerkMembershipId: string
  applyProjection: (event: MembershipProjectionEvent) => Promise<unknown>
}) {
  const target = input.memberships.find((membership) => membership.id === input.clerkMembershipId)
  if (!target) throw new ConvexError('Clerk membership not found')
  assertAdminCanLeave(input.memberships, input.clerkMembershipId)
  await input.clerk.organizations.deleteOrganizationMembership({
    organizationId: input.organizationId,
    userId: target.userId,
  })
  await input.applyProjection({ kind: 'membership.delete', clerkMembershipId: target.id })
}

export async function runChangeRoleAction(input: {
  clerkMembershipId: string
  role: 'admin' | 'member'
  requireAdminContext: () => Promise<Pick<AdminContext, 'clerk' | 'space'>>
  listMemberships: (clerk: ClerkAdminClient, organizationId: string) => Promise<SpaceMembership[]>
  applyProjection: (event: MembershipProjectionEvent) => Promise<unknown>
}) {
  const { clerk, space } = await input.requireAdminContext()
  const memberships = await input.listMemberships(clerk, space.clerkOrganizationId)
  await changeGatherMemberRole({
    clerk,
    organizationId: space.clerkOrganizationId,
    memberships,
    clerkMembershipId: input.clerkMembershipId,
    role: input.role,
    applyProjection: input.applyProjection,
  })
}

export async function runRemoveMemberAction(input: {
  clerkMembershipId: string
  requireAdminContext: () => Promise<Pick<AdminContext, 'clerk' | 'space'>>
  listMemberships: (clerk: ClerkAdminClient, organizationId: string) => Promise<SpaceMembership[]>
  applyProjection: (event: MembershipProjectionEvent) => Promise<unknown>
}) {
  const { clerk, space } = await input.requireAdminContext()
  const memberships = await input.listMemberships(clerk, space.clerkOrganizationId)
  await removeGatherMember({
    clerk,
    organizationId: space.clerkOrganizationId,
    memberships,
    clerkMembershipId: input.clerkMembershipId,
    applyProjection: input.applyProjection,
  })
}
export const changeRole = action({
  args: {
    spaceSlug: v.string(),
    clerkMembershipId: v.string(),
    role: v.union(v.literal('admin'), v.literal('member')),
  },
  handler: async (ctx, args) => {
    await runChangeRoleAction({
      clerkMembershipId: args.clerkMembershipId,
      role: args.role,
      requireAdminContext: async () => await requireAdminContext(ctx, args.spaceSlug),
      listMemberships: listClerkMemberships,
      applyProjection: async (event) => {
        await ctx.runMutation((internal as any).clerkSync.apply, { event })
      },
    })
  },
})

export const removeMember = action({
  args: { spaceSlug: v.string(), clerkMembershipId: v.string() },
  handler: async (ctx, args) => {
    await runRemoveMemberAction({
      clerkMembershipId: args.clerkMembershipId,
      requireAdminContext: async () => await requireAdminContext(ctx, args.spaceSlug),
      listMemberships: listClerkMemberships,
      applyProjection: async (event) => {
        await ctx.runMutation((internal as any).clerkSync.apply, { event })
      },
    })
  },
})

export const reconcile = action({
  args: { spaceSlug: v.string() },
  handler: async (ctx, args) => {
    const { clerk, space } = await requireAdminContext(ctx, args.spaceSlug)
    const memberships = await listRawClerkMemberships(clerk, space.clerkOrganizationId)
    await ctx.runMutation((internal as any).spaces.reconcileMemberships, {
      clerkOrganizationId: space.clerkOrganizationId,
      memberships: reconciliationSnapshot(memberships as any[]),
    })
  },
})

export function deleteConfirmation(name: string) {
  return `DELETE ${name}`
}

async function runModuleDeletionCleanup(_ctx: any, _spaceId: any) {
  // Task 7 has not registered module lifecycle hooks yet.
}


export async function deleteGatherSpaceLifecycle(input: {
  clerk: Pick<ClerkAdminClient, 'organizations'>
  clerkOrganizationId: string
  spaceId: any
  markDeleting: (spaceId: any) => Promise<unknown>
  runModuleCleanup: (spaceId: any) => Promise<unknown>
  cleanup: (spaceId: any) => Promise<unknown>
  finalizeDeleted: (spaceId: any) => Promise<unknown>
}) {
  await input.markDeleting(input.spaceId)
  await input.runModuleCleanup(input.spaceId)
  await input.cleanup(input.spaceId)
  await deleteClerkOrganizationForSpace({
    clerk: input.clerk,
    clerkOrganizationId: input.clerkOrganizationId,
  })
  await input.finalizeDeleted(input.spaceId)
}

export async function runDeleteSpaceAction(input: {
  confirmation: string
  requireAdminContext: () => Promise<Pick<AdminContext, 'clerk' | 'space'>>
  markDeleting: (spaceId: any) => Promise<unknown>
  runModuleCleanup: (spaceId: any) => Promise<unknown>
  cleanup: (spaceId: any) => Promise<unknown>
  finalizeDeleted: (spaceId: any) => Promise<unknown>
}) {
  const { clerk, space } = await input.requireAdminContext()
  if (input.confirmation !== deleteConfirmation(space.name)) {
    throw new ConvexError('Space deletion confirmation does not match')
  }
  await deleteGatherSpaceLifecycle({
    clerk,
    clerkOrganizationId: space.clerkOrganizationId,
    spaceId: space._id,
    markDeleting: input.markDeleting,
    runModuleCleanup: input.runModuleCleanup,
    cleanup: input.cleanup,
    finalizeDeleted: input.finalizeDeleted,
  })
}
export const deleteSpace = action({
  args: { spaceSlug: v.string(), confirmation: v.string() },
  handler: async (ctx, args) => {
    await runDeleteSpaceAction({
      confirmation: args.confirmation,
      requireAdminContext: async () => await requireAdminContext(ctx, args.spaceSlug, {
        allowMissingDeletingOrganization: true,
      }),
      markDeleting: async (spaceId) => {
        await ctx.runMutation((internal as any).spaces.markDeleting, { spaceId })
      },
      runModuleCleanup: async (spaceId) => await runModuleDeletionCleanup(ctx, spaceId),
      cleanup: async (spaceId) => {
        await ctx.runMutation((internal as any).spaces.cleanupForDeletion, { spaceId })
      },
      finalizeDeleted: async (spaceId) => {
        await ctx.runMutation((internal as any).spaces.finalizeDeleted, { spaceId })
      },
    })
  },
})