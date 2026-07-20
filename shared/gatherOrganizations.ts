export const GATHER_ORGANIZATION_MARKER = {
  gather: { kind: 'space', schemaVersion: 1 },
} as const

export const GATHER_INVITATION_MARKER = {
  gather: { kind: 'spaceInvitation', schemaVersion: 1 },
} as const

function hasGatherMarker(
  metadata: unknown,
  kind: 'space' | 'spaceInvitation',
): boolean {
  if (!metadata || typeof metadata !== 'object') return false
  const gather = (metadata as Record<string, unknown>).gather
  if (!gather || typeof gather !== 'object') return false
  const value = gather as Record<string, unknown>
  return value.kind === kind && value.schemaVersion === 1
}

export function isGatherOrganizationMetadata(metadata: unknown): boolean {
  return hasGatherMarker(metadata, 'space')
}

export function isGatherInvitationMetadata(metadata: unknown): boolean {
  return hasGatherMarker(metadata, 'spaceInvitation')
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function assertGatherRequestId(requestId: string): void {
  if (!UUID_PATTERN.test(requestId)) {
    throw new Error('A valid Space creation request ID is required')
  }
}

export function gatherClerkSlug(requestId: string): string {
  assertGatherRequestId(requestId)
  return `gather-${requestId.toLowerCase()}`
}
