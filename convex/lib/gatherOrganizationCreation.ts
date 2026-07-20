import {
  GATHER_ORGANIZATION_MARKER,
  gatherClerkSlug,
  isGatherOrganizationMetadata,
} from '../../shared/gatherOrganizations'
import type {
  ClerkOrganizationGateway,
  ClerkOrganizationRecord,
} from './clerkOrganizationGateway'

export async function findOrCreateGatherOrganization(
  gateway: ClerkOrganizationGateway,
  input: {
    name: string
    requestId: string
    creatorClerkUserId: string
  },
): Promise<ClerkOrganizationRecord> {
  const slug = gatherClerkSlug(input.requestId)
  const existing = await gateway.getBySlug(slug)

  if (existing) {
    if (
      isGatherOrganizationMetadata(existing.publicMetadata) &&
      existing.createdBy === input.creatorClerkUserId
    ) {
      return existing
    }

    throw new Error('Space creation request is already owned by another user')
  }

  return gateway.create({
    name: input.name,
    slug,
    createdBy: input.creatorClerkUserId,
    publicMetadata: GATHER_ORGANIZATION_MARKER,
  })
}
