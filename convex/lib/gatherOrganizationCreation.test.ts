import { describe, expect, it } from 'vitest'
import { GATHER_ORGANIZATION_MARKER } from '../../shared/gatherOrganizations'
import type {
  ClerkOrganizationGateway,
  ClerkOrganizationRecord,
} from './clerkOrganizationGateway'
import { findOrCreateGatherOrganization } from './gatherOrganizationCreation'

class FakeClerkOrganizationGateway implements ClerkOrganizationGateway {
  createCalls: Array<Parameters<ClerkOrganizationGateway['create']>[0]> = []

  constructor(private records: ClerkOrganizationRecord[] = []) {}

  async getBySlug(slug: string) {
    return this.records.find((record) => record.slug === slug) ?? null
  }

  async getById(id: string) {
    return this.records.find((record) => record.id === id) ?? null
  }

  async create(input: Parameters<ClerkOrganizationGateway['create']>[0]) {
    this.createCalls.push(input)
    const record: ClerkOrganizationRecord = {
      id: `org_${this.createCalls.length}`,
      name: input.name,
      slug: input.slug,
      createdBy: input.createdBy,
      publicMetadata: input.publicMetadata,
    }
    this.records.push(record)
    return record
  }
}

function markedOrganization(
  overrides: Partial<ClerkOrganizationRecord>,
): ClerkOrganizationRecord {
  return {
    id: 'org_existing',
    name: 'Existing Space',
    slug: 'gather-88a58cd8-9c7d-4c93-a713-7b17384fe681',
    createdBy: 'user_eric',
    publicMetadata: GATHER_ORGANIZATION_MARKER,
    ...overrides,
  }
}

describe('findOrCreateGatherOrganization', () => {
  it('reuses the same marked Organization when a request is retried', async () => {
    const gateway = new FakeClerkOrganizationGateway()
    const input = {
      name: 'Wine Club',
      requestId: '88a58cd8-9c7d-4c93-a713-7b17384fe681',
      creatorClerkUserId: 'user_eric',
    }

    const first = await findOrCreateGatherOrganization(gateway, input)
    const second = await findOrCreateGatherOrganization(gateway, input)

    expect(second.id).toBe(first.id)
    expect(gateway.createCalls).toHaveLength(1)
    expect(gateway.createCalls[0]).toMatchObject({
      name: 'Wine Club',
      slug: 'gather-88a58cd8-9c7d-4c93-a713-7b17384fe681',
      createdBy: 'user_eric',
      publicMetadata: GATHER_ORGANIZATION_MARKER,
    })
  })

  it('rejects a deterministic slug owned by another user', async () => {
    const gateway = new FakeClerkOrganizationGateway([
      markedOrganization({ createdBy: 'user_other' }),
    ])

    await expect(
      findOrCreateGatherOrganization(gateway, {
        name: 'Wine Club',
        requestId: '88a58cd8-9c7d-4c93-a713-7b17384fe681',
        creatorClerkUserId: 'user_eric',
      }),
    ).rejects.toThrow('Space creation request is already owned by another user')
  })

  it('rejects an unmarked Organization at the deterministic slug', async () => {
    const gateway = new FakeClerkOrganizationGateway([
      markedOrganization({ publicMetadata: {} }),
    ])

    await expect(
      findOrCreateGatherOrganization(gateway, {
        name: 'Wine Club',
        requestId: '88a58cd8-9c7d-4c93-a713-7b17384FE681',
        creatorClerkUserId: 'user_eric',
      }),
    ).rejects.toThrow('Space creation request is already owned by another user')
  })
})
