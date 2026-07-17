import { describe, expect, test, vi } from 'vitest'
import {
  classifyClerkEvent,
  handleClerkWebhook,
  type ClerkWebhookDependencies,
} from './clerkWebhook'

function dependencies(
  overrides: Partial<ClerkWebhookDependencies> = {},
): ClerkWebhookDependencies {
  return {
    verify: vi.fn(),
    classify: vi.fn(),
    apply: vi.fn(),
    ...overrides,
  }
}

describe('Clerk webhook boundary', () => {
  test('invalid webhook signature returns 400 and performs no reads or writes', async () => {
    const verify = vi.fn().mockRejectedValue(new Error('invalid signature'))
    const deps = dependencies({ verify })

    const response = await handleClerkWebhook(
      new Request('https://gather.test/clerk-webhook'),
      deps,
    )

    expect(response.status).toBe(400)
    expect(deps.classify).not.toHaveBeenCalled()
    expect(deps.apply).not.toHaveBeenCalled()
  })

  test('verified processing failures return 500 so Clerk can retry delivery', async () => {
    const event = { type: 'organizationMembership.created', data: {} }
    const deps = dependencies({
      verify: vi.fn().mockResolvedValue(event),
      classify: vi.fn().mockRejectedValue(new Error('Clerk lookup unavailable')),
    })

    const response = await handleClerkWebhook(
      new Request('https://gather.test/clerk-webhook'),
      deps,
    )

    expect(response.status).toBe(500)
    expect(deps.apply).not.toHaveBeenCalled()
  })


  test('passes verified membership payload context to projection sync', async () => {
    const event = {
      type: 'organizationMembership.created',
      data: {
        id: 'mem_gather',
        organization: { id: 'org_gather', name: 'Wine Club' },
        public_user_data: {
          user_id: 'user_gather',
          first_name: 'Ada',
          last_name: 'Lovelace',
          identifier: 'ada@example.com',
          image_url: 'https://example.com/ada.png',
        },
        role: 'org:member',
      },
    }
    const projection = {
      kind: 'membership.upsert' as const,
      clerkMembershipId: 'mem_gather',
      clerkOrganizationId: 'org_gather',
      clerkUserId: 'user_gather',
      role: 'member' as const,
    }
    const apply = vi.fn().mockResolvedValue(undefined)
    const deps = dependencies({
      verify: vi.fn().mockResolvedValue(event),
      classify: vi.fn().mockResolvedValue(projection),
      apply,
    })

    const response = await handleClerkWebhook(
      new Request('https://gather.test/clerk-webhook'),
      deps,
    )

    expect(response.status).toBe(200)
    expect(apply).toHaveBeenCalledWith(projection, {
      membership: {
        clerkOrganizationName: 'Wine Club',
        userName: 'Ada Lovelace',
        userEmail: 'ada@example.com',
        userImageUrl: 'https://example.com/ada.png',
      },
    })
  })
  test('verified unmarked Organization event returns 200 without a projection mutation', async () => {
    const event = {
      type: 'organization.created',
      data: { id: 'org_other_product', name: 'Other', public_metadata: {} },
    }
    const classify = vi.fn().mockResolvedValue(null)
    const deps = dependencies({ verify: vi.fn().mockResolvedValue(event), classify })

    const response = await handleClerkWebhook(
      new Request('https://gather.test/clerk-webhook'),
      deps,
    )

    expect(response.status).toBe(200)
    expect(classify).toHaveBeenCalledWith(event)
    expect(deps.apply).not.toHaveBeenCalled()
  })

  test('ignores a membership for an unknown unmarked Organization', async () => {
    await expect(
      classifyClerkEvent(
        {
          hasSpace: async () => false,
          hasMembership: async () => false,
          userHasMembership: async () => false,
          getOrganization: async () => ({ publicMetadata: {} }),
        },
        {
          type: 'organizationMembership.created',
          data: {
            id: 'mem_other',
            organization: { id: 'org_other_product', name: 'Other' },
            public_user_data: { user_id: 'user_other' },
            role: 'org:member',
          },
        },
      ),
    ).resolves.toBeNull()
  })

  test('propagates marked-Organization lookup failures instead of dropping membership events', async () => {
    await expect(
      classifyClerkEvent(
        {
          hasSpace: async () => false,
          hasMembership: async () => false,
          userHasMembership: async () => false,
          getOrganization: async () => {
            throw new Error('Clerk unavailable')
          },
        },
        {
          type: 'organizationMembership.created',
          data: {
            id: 'mem_gather',
            organization: { id: 'org_gather', name: 'Gather' },
            public_user_data: { user_id: 'user_gather' },
            role: 'org:member',
          },
        },
      ),
    ).rejects.toThrow('Clerk unavailable')
  })
})
