import { ConvexError, v } from 'convex/values'
import { action } from './_generated/server'
import { internal } from './_generated/api'
import { createClerkClient } from '@clerk/backend'
import { GATHER_ORGANIZATION_MARKER } from '../shared/gatherOrganizations'
import type {
  ClerkOrganizationGateway,
  ClerkOrganizationRecord,
} from './lib/clerkOrganizationGateway'
import { findOrCreateGatherOrganization } from './lib/gatherOrganizationCreation'

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

