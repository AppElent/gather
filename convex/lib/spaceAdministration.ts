import { ConvexError } from 'convex/values'

export type SpaceMembership = {
  id: string
  userId: string
  role: 'admin' | 'member'
}

export type ClerkMembership = {
  id: string
  publicUserData?: { userId?: string | null } | null
  role: string
}

export type MembershipPage = { data: ClerkMembership[] }

export async function collectPaginatedMemberships(
  fetchPage: (args: { limit: number; offset: number }) => Promise<MembershipPage>,
  pageSize = 500,
): Promise<ClerkMembership[]> {
  const memberships: ClerkMembership[] = []
  for (let offset = 0; ; offset += pageSize) {
    const page = await fetchPage({ limit: pageSize, offset })
    memberships.push(...page.data)
    if (page.data.length < pageSize) return memberships
  }
}

export function normalizeClerkMemberships(
  memberships: ClerkMembership[],
): SpaceMembership[] {
  return memberships.map((membership) => {
    const userId = membership.publicUserData?.userId
    if (!userId) throw new ConvexError('Clerk membership user is required')
    return {
      id: membership.id,
      userId,
      role:
        membership.role === 'org:admin' || membership.role === 'admin'
          ? 'admin'
          : 'member',
    }
  })
}

export function assertAdminCanLeave(
  memberships: SpaceMembership[],
  targetMembershipId: string,
): void {
  const target = memberships.find((membership) => membership.id === targetMembershipId)
  if (target?.role !== 'admin') return
  if (memberships.filter((membership) => membership.role === 'admin').length < 2) {
    throw new ConvexError('A Space must have at least one admin')
  }
}

export function clerkRoleFor(role: 'admin' | 'member'): 'org:admin' | 'org:member' {
  return role === 'admin' ? 'org:admin' : 'org:member'
}

export function membershipUserId(
  memberships: SpaceMembership[],
  clerkMembershipId: string,
): string {
  const membership = memberships.find((entry) => entry.id === clerkMembershipId)
  if (!membership) throw new ConvexError('Clerk membership not found')
  return membership.userId
}

export function reconciliationSnapshot(memberships: ClerkMembership[]) {
  return normalizeClerkMemberships(memberships).map((membership) => ({
    clerkMembershipId: membership.id,
    clerkUserId: membership.userId,
    role: membership.role,
  }))
}
