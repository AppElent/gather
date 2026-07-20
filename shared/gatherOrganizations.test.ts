import { describe, expect, it } from 'vitest'
import {
  GATHER_INVITATION_MARKER,
  GATHER_ORGANIZATION_MARKER,
  gatherClerkSlug,
  isGatherInvitationMetadata,
  isGatherOrganizationMetadata,
} from './gatherOrganizations'

describe('Gather Clerk resource markers', () => {
  it('recognizes a Gather Organization while allowing unrelated metadata', () => {
    expect(
      isGatherOrganizationMetadata({
        ...GATHER_ORGANIZATION_MARKER,
        billing: { tier: 'free' },
      }),
    ).toBe(true)
  })

  it.each([
    undefined,
    {},
    { gather: { kind: 'spaceInvitation', schemaVersion: 1 } },
    { gather: { kind: 'space', schemaVersion: 2 } },
    { gather: { kind: 'space', schemaVersion: '1' } },
  ])('rejects non-Gather Organization metadata: %j', (metadata) => {
    expect(isGatherOrganizationMetadata(metadata)).toBe(false)
  })

  it('recognizes only marked Gather invitations', () => {
    expect(isGatherInvitationMetadata(GATHER_INVITATION_MARKER)).toBe(true)
    expect(isGatherInvitationMetadata(GATHER_ORGANIZATION_MARKER)).toBe(false)
  })

  it('derives a stable Clerk slug from a UUID', () => {
    expect(gatherClerkSlug('88A58CD8-9C7D-4C93-A713-7B17384FE681')).toBe(
      'gather-88a58cd8-9c7d-4c93-a713-7b17384fe681',
    )
  })
})
