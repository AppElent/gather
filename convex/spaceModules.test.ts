import { convexTest } from 'convex-test'
import { afterEach, describe, expect, test } from 'vitest'
import { api, internal } from './_generated/api'
import { moduleCleanupRegistry } from './lib/moduleLifecycle'
import { cleanupRecipesForSpace } from './lib/recipesLifecycle'
import schema from './schema'
import { modules } from './test.setup'

async function createSpace() {
  const t = convexTest(schema, modules)
  const projection = await t.mutation((internal as any).spaces.provisionTagged, {
    clerkOrganizationId: 'org_wine',
    clerkOrganizationName: 'Wine Club',
    creatorClerkUserId: 'user_admin',
  })
  return {
    t,
    spaceSlug: projection.spaceSlug,
    admin: t.withIdentity({
      subject: 'user_admin',
      org_id: 'org_wine',
      org_role: 'org:admin',
    }),
    member: t.withIdentity({
      subject: 'user_member',
      org_id: 'org_wine',
      org_role: 'org:member',
    }),
  }
}

async function moduleRow(t: ReturnType<typeof convexTest>, spaceId: unknown, moduleId: string) {
  return await t.run((ctx) =>
    (ctx.db as any)
      .query('spaceModules')
      .withIndex('by_space_module', (q: any) =>
        q.eq('spaceId', spaceId).eq('moduleId', moduleId),
      )
      .unique(),
  )
}

afterEach(() => {
  moduleCleanupRegistry.recipes = cleanupRecipesForSpace
})

describe('Space module state', () => {
  test('a member cannot archive a module', async () => {
    const { member, spaceSlug } = await createSpace()

    await expect(
      member.mutation((api as any).spaceModules.setState, {
        spaceSlug,
        moduleId: 'recipes',
        state: 'archived',
      }),
    ).rejects.toThrow('Space admin required')
  })

  test('rejects catalog states that cannot be selected', async () => {
    const { admin, spaceSlug } = await createSpace()

    await expect(
      admin.mutation((api as any).spaceModules.setState, {
        spaceSlug,
        moduleId: 'unknown',
        state: 'archived',
      }),
    ).rejects.toThrow('Unknown module unknown')
    await expect(
      admin.mutation((api as any).spaceModules.setState, {
        spaceSlug,
        moduleId: 'calendar',
        state: 'enabled',
      }),
    ).rejects.toThrow('Calendar is coming soon')
    await expect(
      admin.mutation((api as any).spaceModules.setState, {
        spaceSlug,
        moduleId: 'recipes',
        state: 'preEnabled',
      }),
    ).rejects.toThrow('Only default modules can be pre-enabled')
  })

  test('archiving retains module data by not invoking cleanup', async () => {
    const { admin, spaceSlug } = await createSpace()
    let cleanupCalls = 0
    moduleCleanupRegistry.recipes = async () => {
      cleanupCalls += 1
    }

    await admin.mutation((api as any).spaceModules.setState, {
      spaceSlug,
      moduleId: 'recipes',
      state: 'archived',
    })

    expect(cleanupCalls).toBe(0)
  })

  test('permanent deletion removes shared and personal module references after cleanup', async () => {
    const { admin, spaceSlug, t } = await createSpace()
    await admin.mutation((api as any).spaceModules.setState, {
      spaceSlug,
      moduleId: 'recipes',
      state: 'enabled',
    })
    const context = await admin.query((api as any).spaces.context, { spaceSlug })
    await t.run(async (ctx) => {
      await ctx.db.patch(context.space._id, {
        defaultPinnedModuleIds: ['recipes'],
        defaultDashboard: [
          {
            instanceId: 'shared-recipe',
            widgetDefinitionId: 'recipes.bookmarks',
            size: 'standard',
          },
        ],
      })
      await ctx.db.insert('spacePreferences', {
        spaceId: context.space._id,
        userId: context.user._id,
        pinnedModuleIds: ['recipes'],
        dashboard: [
          {
            instanceId: 'personal-recipe',
            widgetDefinitionId: 'recipes.bookmarks',
            size: 'wide',
          },
        ],
        updatedAt: 1,
      })
    })
    moduleCleanupRegistry.recipes = async () => {}

    await admin.action((api as any).spaceModules.deleteData, {
      spaceSlug,
      moduleId: 'recipes',
      confirmation: 'DELETE Recipes',
    })

    const space = await t.run((ctx) => ctx.db.get(context.space._id))
    const snapshot = await t.run((ctx) =>
      (ctx.db as any)
        .query('spacePreferences')
        .withIndex('by_space_user', (q: any) =>
          q.eq('spaceId', context.space._id).eq('userId', context.user._id),
        )
        .unique(),
    )
    expect(space).toMatchObject({ defaultPinnedModuleIds: [], defaultDashboard: [] })
    expect(snapshot).toMatchObject({ pinnedModuleIds: [], dashboard: [] })
  })

  test('permanent Recipes deletion removes only this Space recipes and their stored images', async () => {
    const { admin, spaceSlug, t } = await createSpace()
    await admin.mutation((api as any).spaceModules.setState, {
      spaceSlug,
      moduleId: 'recipes',
      state: 'enabled',
    })
    const context = await admin.query((api as any).spaces.context, { spaceSlug })
    const imageId = await t.run((ctx) => ctx.storage.store(new Blob(['recipe image'])))
    const recipeId = await t.run((ctx) => ctx.db.insert('recipes', {
      spaceId: context.space._id,
      createdByUserId: context.user._id,
      title: 'Space recipe',
      imageId,
      ingredients: [],
      steps: [],
      tags: [],
      createdAt: 1,
      updatedAt: 1,
    }))
    const otherRecipeId = await t.run(async (ctx) => ctx.db.insert('recipes', {
      spaceId: await ctx.db.insert('spaces', {
        clerkOrganizationId: 'org_other',
        slug: 'other',
        name: 'Other',
        status: 'active',
        defaultPinnedModuleIds: [],
        defaultDashboard: [],
        createdAt: 1,
        updatedAt: 1,
      }),
      createdByUserId: context.user._id,
      title: 'Other Space recipe',
      ingredients: [],
      steps: [],
      tags: [],
      createdAt: 1,
      updatedAt: 1,
    }))

    await admin.action((api as any).spaceModules.deleteData, {
      spaceSlug,
      moduleId: 'recipes',
      confirmation: 'DELETE Recipes',
    })

    expect(await t.run((ctx) => ctx.db.get(recipeId))).toBeNull()
    expect(await t.run((ctx) => ctx.storage.get(imageId))).toBeNull()
    expect(await t.run((ctx) => ctx.db.get(otherRecipeId))).not.toBeNull()
  })
  test('permanent deletion fails without a registered cleanup handler', async () => {
    const { admin, spaceSlug } = await createSpace()

    await expect(
      admin.action((api as any).spaceModules.deleteData, {
        spaceSlug,
        moduleId: 'groceries',
        confirmation: 'DELETE Groceries',
      }),
    ).rejects.toThrow('No cleanup handler registered for groceries')
  })
  test('permanent deletion requires exact confirmation and leaves the module archived', async () => {
    const { admin, spaceSlug, t } = await createSpace()
    await admin.mutation((api as any).spaceModules.setState, {
      spaceSlug,
      moduleId: 'recipes',
      state: 'enabled',
    })
    moduleCleanupRegistry.recipes = async () => {}

    await expect(
      admin.action((api as any).spaceModules.deleteData, {
        spaceSlug,
        moduleId: 'recipes',
        confirmation: 'DELETE recipes',
      }),
    ).rejects.toThrow('Type DELETE Recipes to confirm')

    await admin.action((api as any).spaceModules.deleteData, {
      spaceSlug,
      moduleId: 'recipes',
      confirmation: 'DELETE Recipes',
    })
    const context = await admin.query((api as any).spaces.context, { spaceSlug })

    expect(await moduleRow(t, context.space._id, 'recipes')).not.toHaveProperty('deletionStatus')
  })

  test('failed permanent deletion stays archived and can be retried', async () => {
    const { admin, spaceSlug, t } = await createSpace()
    let attempts = 0
    moduleCleanupRegistry.recipes = async () => {
      attempts += 1
      if (attempts === 1) throw new Error('cleanup failed')
    }

    await expect(
      admin.action((api as any).spaceModules.deleteData, {
        spaceSlug,
        moduleId: 'recipes',
        confirmation: 'DELETE Recipes',
      }),
    ).rejects.toThrow('cleanup failed')

    const context = await admin.query((api as any).spaces.context, { spaceSlug })
    expect(await moduleRow(t, context.space._id, 'recipes')).toMatchObject({
      state: 'archived',
      deletionStatus: 'failed',
    })
    await expect(
      admin.mutation((api as any).spaceModules.setState, {
        spaceSlug,
        moduleId: 'recipes',
        state: 'enabled',
      }),
    ).rejects.toThrow('Module data deletion requires retry')

    await admin.action((api as any).spaceModules.deleteData, {
      spaceSlug,
      moduleId: 'recipes',
      confirmation: 'DELETE Recipes',
    })

    expect(await moduleRow(t, context.space._id, 'recipes')).not.toHaveProperty('deletionStatus')
  })
})
