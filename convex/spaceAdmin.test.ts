import { ConvexError } from 'convex/values'
import { describe, expect, test } from 'vitest'
import { GATHER_ORGANIZATION_MARKER } from '../shared/gatherOrganizations'
import type { ClerkOrganizationGateway } from './lib/clerkOrganizationGateway'
import { createGatherSpace, normalizeSpaceName, requireEnv } from './spaceAdmin'

describe('spaceAdmin helpers', () => {
  test('normalizes a Space name for backend creation', () => {
    expect(normalizeSpaceName('  Wine Club  ')).toBe('Wine Club')
  })

  test('rejects an empty Space name', () => {
    expect(() => normalizeSpaceName('   ')).toThrow('Space name is required')
  })

  test('requires configured server environment variables', () => {
    expect(() => requireEnv('__GATHER_MISSING_TEST_ENV__')).toThrow(ConvexError)
  })

  test('creates a marked Organization and provisions its Space projection', async () => {
    const gateway: ClerkOrganizationGateway = {
      async getBySlug() {
        return null
      },
      async getById() {
        return null
      },
      async create(input) {
        expect(input).toMatchObject({
          name: 'Wine Club',
          slug: 'gather-88a58cd8-9c7d-4c93-a713-7b17384fe681',
          createdBy: 'user_eric',
          publicMetadata: GATHER_ORGANIZATION_MARKER,
        })
        return {
          id: 'org_wine',
          name: input.name,
          slug: input.slug,
          createdBy: input.createdBy,
          publicMetadata: input.publicMetadata,
        }
      },
    }

    const result = await createGatherSpace({
      gateway,
      name: ' Wine Club ',
      requestId: '88a58cd8-9c7d-4c93-a713-7b17384fe681',
      creatorClerkUserId: 'user_eric',
      provision: async (organization) => {
        expect(organization.id).toBe('org_wine')
        return { spaceSlug: 'wine-club' }
      },
    })

    expect(result).toEqual({
      clerkOrganizationId: 'org_wine',
      spaceSlug: 'wine-club',
    })
  })
})
