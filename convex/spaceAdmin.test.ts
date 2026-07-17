import { ConvexError } from 'convex/values'
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { GATHER_INVITATION_MARKER, GATHER_ORGANIZATION_MARKER } from '../shared/gatherOrganizations'
import { internal } from './_generated/api'
import type { ClerkOrganizationGateway } from './lib/clerkOrganizationGateway'
import {
  changeGatherMemberRole,
  createGatherSpace,
  deleteGatherSpaceLifecycle,
  deleteClerkOrganizationForSpace,
  gatherInvitationOptions,
  inviteGatherMember,
  normalizeSpaceName,
  requireEnv,
  requireGatherOrganization,
  removeGatherMember,
  runChangeRoleAction,
  runDeleteSpaceAction,
  runRemoveMemberAction,
} from './spaceAdmin'
import schema from './schema'
import { modules } from './test.setup'

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

  test('rejects administrative work for an unmarked Organization', () => {
    expect(() => requireGatherOrganization({ publicMetadata: {} })).toThrow('Gather Space marker mismatch')
  })

  test('prepares Gather-marked invitation metadata', () => {
    expect(gatherInvitationOptions()).toEqual({ publicMetadata: GATHER_INVITATION_MARKER })
  })


  test('builds a Gather-marked Clerk invitation request', async () => {
    const calls: unknown[] = []
    const clerk = {
      organizations: {
        async createOrganizationInvitation(input: unknown) {
          calls.push(input)
          return { id: 'inv_1' }
        },
      },
    }

    await expect(
      inviteGatherMember({
        clerk: clerk as never,
        organizationId: 'org_wine',
        inviterUserId: 'user_admin',
        emailAddress: 'member@example.com',
        publicAppOrigin: 'https://gather.test',
      }),
    ).resolves.toEqual({ id: 'inv_1' })

    expect(calls).toEqual([
      {
        organizationId: 'org_wine',
        inviterUserId: 'user_admin',
        emailAddress: 'member@example.com',
        role: 'org:member',
        publicMetadata: GATHER_INVITATION_MARKER,
        redirectUrl: 'https://gather.test/onboarding',
      },
    ])
  })

  test('treats an already-deleted Clerk Organization as deletion retry success', async () => {
    const clerk = {
      organizations: {
        async deleteOrganization() {
          throw { status: 404 }
        },
      },
    }

    await expect(
      deleteClerkOrganizationForSpace({
        clerk: clerk as never,
        clerkOrganizationId: 'org_wine',
      }),
    ).resolves.toBeUndefined()
  })

  test('surfaces non-not-found Clerk deletion failures', async () => {
    const clerk = {
      organizations: {
        async deleteOrganization() {
          throw { status: 500 }
        },
      },
    }

    await expect(
      deleteClerkOrganizationForSpace({
        clerk: clerk as never,
        clerkOrganizationId: 'org_wine',
      }),
    ).rejects.toMatchObject({ status: 500 })
  })

  test('changes a member role in Clerk and updates its projection', async () => {
    const clerkCalls: unknown[] = []
    const projectionEvents: unknown[] = []
    const clerk = {
      organizations: {
        async updateOrganizationMembership(input: unknown) {
          clerkCalls.push(input)
        },
      },
    }

    await changeGatherMemberRole({
      clerk: clerk as never,
      organizationId: 'org_wine',
      memberships: [
        { id: 'mem_admin', userId: 'user_admin', role: 'admin' },
        { id: 'mem_member', userId: 'user_member', role: 'member' },
      ],
      clerkMembershipId: 'mem_member',
      role: 'admin',
      applyProjection: async (event) => projectionEvents.push(event),
    })

    expect(clerkCalls).toEqual([
      { organizationId: 'org_wine', userId: 'user_member', role: 'org:admin' },
    ])
    expect(projectionEvents).toEqual([
      {
        kind: 'membership.upsert',
        clerkMembershipId: 'mem_member',
        clerkOrganizationId: 'org_wine',
        clerkUserId: 'user_member',
        role: 'admin',
      },
    ])
  })

  test('rejects demoting the only admin before touching Clerk or projections', async () => {
    const clerkCalls: unknown[] = []
    const projectionEvents: unknown[] = []
    const clerk = {
      organizations: {
        async updateOrganizationMembership(input: unknown) {
          clerkCalls.push(input)
        },
      },
    }

    await expect(
      changeGatherMemberRole({
        clerk: clerk as never,
        organizationId: 'org_wine',
        memberships: [{ id: 'mem_admin', userId: 'user_admin', role: 'admin' }],
        clerkMembershipId: 'mem_admin',
        role: 'member',
        applyProjection: async (event) => projectionEvents.push(event),
      }),
    ).rejects.toThrow('A Space must have at least one admin')

    expect(clerkCalls).toEqual([])
    expect(projectionEvents).toEqual([])
  })

  test('removes a member in Clerk and deletes its projection', async () => {
    const clerkCalls: unknown[] = []
    const projectionEvents: unknown[] = []
    const clerk = {
      organizations: {
        async deleteOrganizationMembership(input: unknown) {
          clerkCalls.push(input)
        },
      },
    }

    await removeGatherMember({
      clerk: clerk as never,
      organizationId: 'org_wine',
      memberships: [
        { id: 'mem_admin', userId: 'user_admin', role: 'admin' },
        { id: 'mem_member', userId: 'user_member', role: 'member' },
      ],
      clerkMembershipId: 'mem_member',
      applyProjection: async (event) => projectionEvents.push(event),
    })

    expect(clerkCalls).toEqual([
      { organizationId: 'org_wine', userId: 'user_member' },
    ])
    expect(projectionEvents).toEqual([
      { kind: 'membership.delete', clerkMembershipId: 'mem_member' },
    ])
  })

  test('rejects removing the only admin before touching Clerk or projections', async () => {
    const clerkCalls: unknown[] = []
    const projectionEvents: unknown[] = []
    const clerk = {
      organizations: {
        async deleteOrganizationMembership(input: unknown) {
          clerkCalls.push(input)
        },
      },
    }

    await expect(
      removeGatherMember({
        clerk: clerk as never,
        organizationId: 'org_wine',
        memberships: [{ id: 'mem_admin', userId: 'user_admin', role: 'admin' }],
        clerkMembershipId: 'mem_admin',
        applyProjection: async (event) => projectionEvents.push(event),
      }),
    ).rejects.toThrow('A Space must have at least one admin')

    expect(clerkCalls).toEqual([])
    expect(projectionEvents).toEqual([])
  })

  test('runs Space deletion lifecycle in its durable order', async () => {
    const calls: string[] = []
    const clerk = {
      organizations: {
        async deleteOrganization() {
          calls.push('clerk')
        },
      },
    }

    await deleteGatherSpaceLifecycle({
      clerk: clerk as never,
      clerkOrganizationId: 'org_wine',
      spaceId: 'space_wine',
      markDeleting: async () => calls.push('mark'),
      runModuleCleanup: async () => calls.push('modules'),
      cleanup: async () => calls.push('cleanup'),
      finalizeDeleted: async () => calls.push('finalize'),
    })

    expect(calls).toEqual(['mark', 'modules', 'cleanup', 'clerk', 'finalize'])
  })

  test('finishes a deletion retry after Clerk reports the Organization already absent', async () => {
    const calls: string[] = []
    const clerk = {
      organizations: {
        async deleteOrganization() {
          calls.push('clerk')
          throw { status: 404 }
        },
      },
    }

    await deleteGatherSpaceLifecycle({
      clerk: clerk as never,
      clerkOrganizationId: 'org_wine',
      spaceId: 'space_wine',
      markDeleting: async () => calls.push('mark'),
      runModuleCleanup: async () => calls.push('modules'),
      cleanup: async () => calls.push('cleanup'),
      finalizeDeleted: async () => calls.push('finalize'),
    })

    expect(calls).toEqual(['mark', 'modules', 'cleanup', 'clerk', 'finalize'])
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


describe('spaceAdmin public action orchestration', () => {
  test('stops a role change when the Gather marker gate rejects the active Organization', async () => {
    let listed = false

    await expect(
      runChangeRoleAction({
        clerkMembershipId: 'mem_member',
        role: 'admin',
        requireAdminContext: async () => {
          throw new ConvexError('Gather Space marker mismatch')
        },
        listMemberships: async () => {
          listed = true
          return []
        },
        applyProjection: async () => undefined,
      }),
    ).rejects.toThrow('Gather Space marker mismatch')

    expect(listed).toBe(false)
  })

  test('changes a role through the action orchestration and writes its projection', async () => {
    const clerkCalls: unknown[] = []
    const mutationCalls: unknown[] = []
    const clerk = {
      organizations: {
        async updateOrganizationMembership(input: unknown) {
          clerkCalls.push(input)
        },
      },
    }

    await runChangeRoleAction({
      clerkMembershipId: 'mem_member',
      role: 'admin',
      requireAdminContext: async () => ({
        clerk: clerk as never,
        space: { _id: 'space_wine', clerkOrganizationId: 'org_wine', name: 'Wine Club', status: 'active' },
      }),
      listMemberships: async () => [
        { id: 'mem_admin', userId: 'user_admin', role: 'admin' as const },
        { id: 'mem_member', userId: 'user_member', role: 'member' as const },
      ],
      applyProjection: async (event) => mutationCalls.push({ event }),
    })

    expect(clerkCalls).toEqual([
      { organizationId: 'org_wine', userId: 'user_member', role: 'org:admin' },
    ])
    expect(mutationCalls).toEqual([
      {
        event: {
          kind: 'membership.upsert',
          clerkMembershipId: 'mem_member',
          clerkOrganizationId: 'org_wine',
          clerkUserId: 'user_member',
          role: 'admin',
        },
      },
    ])
  })

  test('stops member removal when the signed admin context gate rejects the caller', async () => {
    let listed = false

    await expect(
      runRemoveMemberAction({
        clerkMembershipId: 'mem_member',
        requireAdminContext: async () => {
          throw new ConvexError('Active Organization role must be admin')
        },
        listMemberships: async () => {
          listed = true
          return []
        },
        applyProjection: async () => undefined,
      }),
    ).rejects.toThrow('Active Organization role must be admin')

    expect(listed).toBe(false)
  })

  test('removes a member through the action orchestration and deletes its projection', async () => {
    const clerkCalls: unknown[] = []
    const mutationCalls: unknown[] = []
    const clerk = {
      organizations: {
        async deleteOrganizationMembership(input: unknown) {
          clerkCalls.push(input)
        },
      },
    }

    await runRemoveMemberAction({
      clerkMembershipId: 'mem_member',
      requireAdminContext: async () => ({
        clerk: clerk as never,
        space: { _id: 'space_wine', clerkOrganizationId: 'org_wine', name: 'Wine Club', status: 'active' },
      }),
      listMemberships: async () => [
        { id: 'mem_admin', userId: 'user_admin', role: 'admin' as const },
        { id: 'mem_member', userId: 'user_member', role: 'member' as const },
      ],
      applyProjection: async (event) => mutationCalls.push({ event }),
    })

    expect(clerkCalls).toEqual([{ organizationId: 'org_wine', userId: 'user_member' }])
    expect(mutationCalls).toEqual([
      { event: { kind: 'membership.delete', clerkMembershipId: 'mem_member' } },
    ])
  })

  test('finishes the public deletion orchestration after a Clerk 404 retry', async () => {
    const calls: string[] = []
    const clerk = {
      organizations: {
        async deleteOrganization() {
          calls.push('clerk')
          throw { status: 404 }
        },
      },
    }

    await runDeleteSpaceAction({
      confirmation: 'DELETE Wine Club',
      requireAdminContext: async () => ({
        clerk: clerk as never,
        space: { _id: 'space_wine', clerkOrganizationId: 'org_wine', name: 'Wine Club', status: 'active' },
      }),
      markDeleting: async () => calls.push('mark'),
      runModuleCleanup: async () => calls.push('modules'),
      cleanup: async () => calls.push('cleanup'),
      finalizeDeleted: async () => calls.push('finalize'),
    })

    expect(calls).toEqual(['mark', 'modules', 'cleanup', 'clerk', 'finalize'])
  })
})
describe('Space membership projection administration', () => {
  test('reconciliation replaces stale projection rows with Clerk memberships', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      const spaceId = await ctx.db.insert('spaces', {
        clerkOrganizationId: 'org_wine', slug: 'wine-club', name: 'Wine Club', status: 'active',
        defaultPinnedModuleIds: [], defaultDashboard: [], createdAt: 1, updatedAt: 1,
      })
      const staleUserId = await ctx.db.insert('users', {
        clerkId: 'user_stale', name: 'Stale', email: 'stale@example.com',
      })
      await ctx.db.insert('spaceMemberships', {
        spaceId, userId: staleUserId, clerkMembershipId: 'mem_stale', clerkUserId: 'user_stale',
        role: 'member', createdAt: 1, updatedAt: 1,
      })
    })

    await t.mutation((internal as any).spaces.reconcileMemberships, {
      clerkOrganizationId: 'org_wine',
      memberships: [
        { clerkMembershipId: 'mem_admin', clerkUserId: 'user_admin', role: 'admin' },
        { clerkMembershipId: 'mem_member', clerkUserId: 'user_member', role: 'member' },
      ],
    })

    expect(await t.run((ctx) => ctx.db.query('spaceMemberships').collect())).toMatchObject([
      { clerkMembershipId: 'mem_admin', clerkUserId: 'user_admin', role: 'admin' },
      { clerkMembershipId: 'mem_member', clerkUserId: 'user_member', role: 'member' },
    ])
  })
})