import { isGatherOrganizationMetadata } from '../../shared/gatherOrganizations'
import type { SpaceRole } from '../../src/lib/modules'

export type ClerkProjectionEvent =
  | {
      kind: 'user.upsert'
      clerkUserId: string
      name: string
      email: string
      imageUrl?: string
    }
  | { kind: 'space.upsert'; clerkOrganizationId: string; name: string }
  | { kind: 'space.delete'; clerkOrganizationId: string }
  | {
      kind: 'membership.upsert'
      clerkMembershipId: string
      clerkOrganizationId: string
      clerkUserId: string
      role: SpaceRole
    }
  | { kind: 'membership.delete'; clerkMembershipId: string }

export type ClerkProjectionContext = {
  membership?: {
    clerkOrganizationName: string
    userName: string
    userEmail: string
    userImageUrl?: string
  }
}

type ClerkData = Record<string, any>

function role(value: unknown): SpaceRole | null {
  if (value === 'org:admin' || value === 'admin') return 'admin'
  if (value === 'org:member' || value === 'member') return 'member'
  return null
}

function userName(data: ClerkData) {
  return [data.first_name, data.last_name].filter(Boolean).join(' ') || data.username || 'Member'
}

function publicUserName(data: ClerkData) {
  return [data.first_name, data.last_name].filter(Boolean).join(' ') || data.identifier || 'Member'
}

function userEmail(data: ClerkData) {
  return (
    data.email_addresses?.find(
      (entry: any) => entry.id === data.primary_email_address_id,
    )?.email_address ?? ''
  )
}

export function normalizeClerkEvent(event: {
  type?: unknown
  data?: unknown
}): ClerkProjectionEvent | null {
  const type = event.type
  const data = event.data as ClerkData | undefined
  if (!data || typeof data !== 'object') return null

  if (type === 'organization.created' || type === 'organization.updated') {
    if (!data.id || !data.name || !isGatherOrganizationMetadata(data.public_metadata)) {
      return null
    }
    return {
      kind: 'space.upsert',
      clerkOrganizationId: data.id,
      name: data.name,
    }
  }

  if (type === 'organization.deleted') {
    return data.id ? { kind: 'space.delete', clerkOrganizationId: data.id } : null
  }

  if (type === 'user.created' || type === 'user.updated') {
    if (!data.id) return null
    return {
      kind: 'user.upsert',
      clerkUserId: data.id,
      name: userName(data),
      email: userEmail(data),
      imageUrl: data.image_url,
    }
  }

  if (
    type === 'organizationMembership.created' ||
    type === 'organizationMembership.updated'
  ) {
    const memberRole = role(data.role)
    const organization = data.organization ?? {}
    const user = data.public_user_data ?? {}
    if (!memberRole || !data.id || !organization.id || !user.user_id) return null
    return {
      kind: 'membership.upsert',
      clerkMembershipId: data.id,
      clerkOrganizationId: organization.id,
      clerkUserId: user.user_id,
      role: memberRole,
    }
  }

  if (type === 'organizationMembership.deleted') {
    return data.id ? { kind: 'membership.delete', clerkMembershipId: data.id } : null
  }

  return null
}

export function extractClerkProjectionContext(event: {
  type?: unknown
  data?: unknown
}): ClerkProjectionContext | undefined {
  const type = event.type
  const data = event.data as ClerkData | undefined
  if (
    !data ||
    typeof data !== 'object' ||
    (type !== 'organizationMembership.created' &&
      type !== 'organizationMembership.updated')
  ) {
    return undefined
  }

  const organization = data.organization ?? {}
  const user = data.public_user_data ?? {}
  return {
    membership: {
      clerkOrganizationName: organization.name ?? 'Space',
      userName: publicUserName(user),
      userEmail: user.identifier ?? '',
      userImageUrl: user.image_url,
    },
  }
}
