import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from '../_generated/api'
import schema from '../schema'
import { modules } from '../test.setup'
import { readSpaceClaims } from './spaceAuth'

describe('Space auth', () => {
  test('rejects a URL Space that is not the signed active organization', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert('spaces', {
        clerkOrganizationId: 'org_wine',
        slug: 'wine',
        name: 'Wine',
        status: 'active',
        defaultPinnedModuleIds: [],
        defaultDashboard: [],
        createdAt: 1,
        updatedAt: 1,
      })
      await ctx.db.insert('users', {
        clerkId: 'user_a',
        name: 'A',
        email: 'a@example.com',
      })
    })

    const member = t.withIdentity({
      subject: 'user_a',
      org_id: 'org_home',
      org_role: 'org:member',
    })

    await expect(member.query((api as any).spaces.context, { spaceSlug: 'wine' })).rejects.toThrow(
      'Active organization does not match Space',
    )
  })

  test('requires the admin role for admin operations', () => {
    expect(() =>
      readSpaceClaims(
        { org_id: 'org_a', org_role: 'org:member' } as never,
        true,
      ),
    ).toThrow('Space admin required')
  })

  test('rejects shared Clerk roles outside Gather admin and member', () => {
    expect(() =>
      readSpaceClaims({ org_id: 'org_a', org_role: 'org:editor' } as never),
    ).toThrow('Unsupported Gather Space role')
  })
})
