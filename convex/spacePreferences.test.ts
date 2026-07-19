import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'

async function createSpace() {
  const t = convexTest(schema, modules)
  const projection = await t.mutation((internal as any).spaces.provisionTagged, {
    clerkOrganizationId: 'org_wine',
    clerkOrganizationName: 'Wine Club',
    creatorClerkUserId: 'user_admin',
  })
  const admin = t.withIdentity({
    subject: 'user_admin',
    org_id: 'org_wine',
    org_role: 'org:admin',
  })
  const member = t.withIdentity({
    subject: 'user_member',
    org_id: 'org_wine',
    org_role: 'org:member',
  })
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
  return { t, spaceSlug: projection.spaceSlug, admin, member }
}

async function preference(t: ReturnType<typeof convexTest>, spaceId: unknown, userId: unknown): Promise<any> {
  return await t.run((ctx) =>
    (ctx.db as any)
      .query('spacePreferences')
      .withIndex('by_space_user', (q: any) => q.eq('spaceId', spaceId).eq('userId', userId))
      .unique(),
  )
}

describe('personal Space snapshots', () => {
  test('saves an ordered empty navigation snapshot intentionally', async () => {
    const { member, spaceSlug } = await createSpace()

    await member.mutation((api as any).spacePreferences.saveNavigation, {
      spaceSlug,
      pinnedModuleIds: [],
    })

    await expect(member.query((api as any).spaces.context, { spaceSlug })).resolves.toMatchObject({
      navigation: { source: 'personal', pinnedModuleIds: [] },
    })
  })

  test('rejects pins that are unknown, archived, or coming soon', async () => {
    const { admin, member, spaceSlug } = await createSpace()
    await admin.mutation((api as any).spaceModules.setState, {
      spaceSlug,
      moduleId: 'recipes',
      state: 'enabled',
    })
    await admin.mutation((api as any).spaceModules.setState, {
      spaceSlug,
      moduleId: 'recipes',
      state: 'archived',
    })

    await expect(
      member.mutation((api as any).spacePreferences.saveNavigation, {
        spaceSlug,
        pinnedModuleIds: ['unknown'],
      }),
    ).rejects.toThrow('Unknown module unknown')
    await expect(
      member.mutation((api as any).spacePreferences.saveNavigation, {
        spaceSlug,
        pinnedModuleIds: ['recipes'],
      }),
    ).rejects.toThrow('Recipes is not enabled')
    await expect(
      member.mutation((api as any).spacePreferences.saveNavigation, {
        spaceSlug,
        pinnedModuleIds: ['calendar'],
      }),
    ).rejects.toThrow('Calendar is coming soon')

  })

  test('validates dashboard widgets against visible module definitions', async () => {
    const { admin, member, spaceSlug } = await createSpace()
    await admin.mutation((api as any).spaceModules.setState, {
      spaceSlug,
      moduleId: 'recipes',
      state: 'enabled',
    })

    await member.mutation((api as any).spacePreferences.saveDashboard, {
      spaceSlug,
      dashboard: [
        {
          instanceId: 'second',
          widgetDefinitionId: 'recipes.bookmarks',
          size: 'wide',
        },
        {
          instanceId: 'first',
          widgetDefinitionId: 'recipes.bookmarks',
          size: 'standard',
        },
      ],
    })
    await expect(member.query((api as any).spaces.context, { spaceSlug })).resolves.toMatchObject({
      dashboard: {
        source: 'personal',
        widgets: [
          { instanceId: 'second', widgetDefinitionId: 'recipes.bookmarks' },
          { instanceId: 'first', widgetDefinitionId: 'recipes.bookmarks' },
        ],
      },
    })
    await expect(
      member.mutation((api as any).spacePreferences.saveDashboard, {
        spaceSlug,
        dashboard: [
          { instanceId: 'calendar', widgetDefinitionId: 'calendar.upcoming', size: 'wide' },
        ],
      }),
    ).rejects.toThrow('Calendar is coming soon')
    await expect(
      member.mutation((api as any).spacePreferences.saveDashboard, {
        spaceSlug,
        dashboard: [
          { instanceId: 'duplicate', widgetDefinitionId: 'recipes.bookmarks', size: 'wide' },
          { instanceId: 'duplicate', widgetDefinitionId: 'recipes.bookmarks', size: 'standard' },
        ],
      }),
    ).rejects.toThrow('Widget instance IDs must be unique')
  })

  test('reset deletes only the selected override', async () => {
    const { member, spaceSlug, t } = await createSpace()
    await member.mutation((api as any).spacePreferences.saveNavigation, {
      spaceSlug,
      pinnedModuleIds: [],
    })
    await member.mutation((api as any).spacePreferences.saveDashboard, {
      spaceSlug,
      dashboard: [],
    })

    const context = await member.query((api as any).spaces.context, { spaceSlug })
    await member.mutation((api as any).spacePreferences.resetNavigation, { spaceSlug })
    const row = await preference(t, context.space._id, context.user._id)
    expect(row?.pinnedModuleIds).toBeUndefined()
    expect(row?.dashboard).toEqual([])

    await member.mutation((api as any).spacePreferences.resetDashboard, { spaceSlug })
    expect(await preference(t, context.space._id, context.user._id)).toBeNull()
  })
})
