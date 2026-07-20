import {
  isGatherInvitationMetadata,
  isGatherOrganizationMetadata,
} from '../../../shared/gatherOrganizations'

export type GatherMembership = {
  organization: { id: string; name: string; publicMetadata: unknown }
}

export type GatherInvitation = {
  id: string
  organization: { id: string; name: string }
  publicMetadata: unknown
  inviterName?: string
  accept: () => Promise<unknown>
}

export function filterGatherMemberships(
  memberships: readonly GatherMembership[],
) {
  return memberships.filter((membership) =>
    isGatherOrganizationMetadata(membership.organization.publicMetadata),
  )
}

export function filterGatherInvitations(
  invitations: readonly GatherInvitation[],
) {
  return invitations.filter((invitation) =>
    isGatherInvitationMetadata(invitation.publicMetadata),
  )
}
