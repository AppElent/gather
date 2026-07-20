import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'

async function moduleRows(t: ReturnType<typeof convexTest>, spaceId: unknown) {
  return t.run((ctx) =>
    (ctx.db as any)
      .query('spaceModules')
      .withIndex('by_space', (q: any) => q.eq('spaceId', spaceId))
      .collect(),
  )
}

async function membershipRows(t: ReturnType<typeof convexTest>) {
  return t.run((ctx) => ctx.db.query('spaceMemberships').collect())
}

describe('Space provisioning', () => {
  test('provisions one Space per marked Clerk Organization and initializes defaults once', async () => {
    const t = convexTest(schema, modules)

    const first = await t.mutation((internal as any).spaces.provisionTagged, {
      clerkOrganizationId: 'org_wine',
      clerkOrganizationName: 'Wine Club',
      creatorClerkUserId: 'user_eric',
    })
    const second = await t.mutation((internal as any).spaces.provisionTagged, {
      clerkOrganizationId: 'org_wine',
      clerkOrganizationName: 'Renamed in Clerk',
      creatorClerkUserId: 'user_eric',
    })

    expect(second.spaceId).toEqual(first.spaceId)
    expect(second.spaceSlug).toBe(first.spaceSlug)
    expect(await moduleRows(t, first.spaceId)).toMatchObject([
      { moduleId: 'tasks', state: 'preEnabled' },
      { moduleId: 'notes', state: 'preEnabled' },
      { moduleId: 'calendar', state: 'preEnabled' },
    ])

    const space = await t.run((ctx) => ctx.db.get(first.spaceId))
    expect(space).toMatchObject({
      defaultPinnedModuleIds: ['tasks', 'notes', 'calendar'],
      defaultDashboard: [],
    })
  })

  test('repairs membership projection only for an existing Gather Space mapping', async () => {
    const t = convexTest(schema, modules)
    const projection = await t.mutation((internal as any).spaces.provisionTagged, {
      clerkOrganizationId: 'org_wine',
      clerkOrganizationName: 'Wine Club',
      creatorClerkUserId: 'user_eric',
    })

    const member = t.withIdentity({
      subject: 'user_eric',
      org_id: 'org_wine',
      org_role: 'org:member',
    })
    await member.mutation((api as any).spaces.ensureMembershipProjection, {
      spaceSlug: projection.spaceSlug,
    })

    expect(await membershipRows(t)).toHaveLength(1)
    expect((await membershipRows(t))[0]).toMatchObject({ role: 'member' })
  })

  test('does not claim an active unmarked or other-product Organization', async () => {
    const t = convexTest(schema, modules)
    const member = t.withIdentity({
      subject: 'user_other',
      org_id: 'org_other_product',
      org_role: 'org:admin',
    })

    await expect(
      member.mutation((api as any).spaces.ensureMembershipProjection, {
        spaceSlug: 'other-product',
      }),
    ).rejects.toThrow('Active organization is not a Gather Space')
  })

  test('rejects a mismatched active Organization for an existing Gather Space', async () => {
    const t = convexTest(schema, modules)
    const projection = await t.mutation((internal as any).spaces.provisionTagged, {
      clerkOrganizationId: 'org_wine',
      clerkOrganizationName: 'Wine Club',
      creatorClerkUserId: 'user_eric',
    })

    const otherProduct = t.withIdentity({
      subject: 'user_eric',
      org_id: 'org_other_product',
      org_role: 'org:admin',
    })

    await expect(
      otherProduct.mutation((api as any).spaces.ensureMembershipProjection, {
        spaceSlug: projection.spaceSlug,
      }),
    ).rejects.toThrow('Active organization is not a Gather Space')
  })

  test('context distinguishes inherited defaults from intentional empty snapshots', async () => {
    const t = convexTest(schema, modules)
    const projection = await t.mutation((internal as any).spaces.provisionTagged, {
      clerkOrganizationId: 'org_wine',
      clerkOrganizationName: 'Wine Club',
      creatorClerkUserId: 'user_eric',
    })

    const member = t.withIdentity({
      subject: 'user_eric',
      org_id: 'org_wine',
      org_role: 'org:admin',
    })
    const inherited = await member.query((api as any).spaces.context, {
      spaceSlug: projection.spaceSlug,
    })
    expect(inherited.navigation.source).toBe('space')

    await t.run(async (ctx) => {
      await ctx.db.insert('spacePreferences', {
        spaceId: inherited.space._id,
        userId: inherited.user._id,
        pinnedModuleIds: [],
        dashboard: [],
        updatedAt: 2,
      })
    })

    await expect(
      member.query((api as any).spaces.context, { spaceSlug: projection.spaceSlug }),
    ).resolves.toMatchObject({
      navigation: { source: 'personal', pinnedModuleIds: [] },
      dashboard: { source: 'personal', widgets: [] },
    })
  })
  test('lets admins save a validated shared dashboard without changing a personal snapshot', async () => {
    const t = convexTest(schema, modules)
    const projection = await t.mutation((internal as any).spaces.provisionTagged, {
      clerkOrganizationId: 'org_wine',
      clerkOrganizationName: 'Wine Club',
      creatorClerkUserId: 'user_admin',
    })
    const admin = t.withIdentity({ subject: 'user_admin', org_id: 'org_wine', org_role: 'org:admin' })
    const member = t.withIdentity({ subject: 'user_member', org_id: 'org_wine', org_role: 'org:member' })
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
        clerkId: 'user_member',
        name: 'Member',
        email: 'member@example.com',
      })
      await ctx.db.insert('spaceMemberships', {
        spaceId: projection.spaceId,
        userId,
        clerkUserId: 'user_member',
        role: 'member',
        createdAt: 1,
        updatedAt: 1,
      })
    })

    await admin.mutation((api as any).spaceModules.setState, {
      spaceSlug: projection.spaceSlug,
      moduleId: 'recipes',
      state: 'enabled',
    })
    await member.mutation((api as any).spacePreferences.saveDashboard, {
      spaceSlug: projection.spaceSlug,
      dashboard: [],
    })
    await admin.mutation((api as any).spaces.saveDefaultDashboard, {
      spaceSlug: projection.spaceSlug,
      dashboard: [{ instanceId: 'shared-recipes', widgetDefinitionId: 'recipes.bookmarks', size: 'wide' }],
    })

    await expect(member.query((api as any).spaces.context, {
      spaceSlug: projection.spaceSlug,
    })).resolves.toMatchObject({ dashboard: { source: 'personal', widgets: [] } })
    await expect(member.mutation((api as any).spaces.saveDefaultDashboard, {
      spaceSlug: projection.spaceSlug,
      dashboard: [],
    })).rejects.toThrow('Space admin required')
  })
})
