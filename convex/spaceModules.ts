import { ConvexError, v } from 'convex/values'
import { action, internalMutation, mutation } from './_generated/server'
import { internal } from './_generated/api'
import { getModuleDefinition } from '../src/lib/modules'
import { moduleCleanupRegistry, runModuleCleanup } from './lib/moduleLifecycle'
import { readSpaceClaims, requireActiveSpace } from './lib/spaceAuth'

const moduleState = v.union(
  v.literal('preEnabled'),
  v.literal('enabled'),
  v.literal('archived'),
)

function requireCatalogModule(moduleId: string) {
  const definition = getModuleDefinition(moduleId)
  if (!definition) throw new ConvexError(`Unknown module ${moduleId}`)
  return definition
}

function validateModuleState(moduleId: string, state: 'preEnabled' | 'enabled' | 'archived') {
  const definition = requireCatalogModule(moduleId)
  if (state === 'enabled' && definition.availability !== 'live') {
    throw new ConvexError(`${definition.label} is coming soon`)
  }
  if (state === 'preEnabled' && definition.availability !== 'comingSoon') {
    throw new ConvexError('Only coming-soon modules can be pre-enabled')
  }
}

export const setState = mutation({
  args: { spaceSlug: v.string(), moduleId: v.string(), state: moduleState },
  handler: async (ctx, args) => {
    const { space } = await requireActiveSpace(ctx, {
      spaceSlug: args.spaceSlug,
      requireAdmin: true,
    })
    validateModuleState(args.moduleId, args.state)
    const existing = await ctx.db
      .query('spaceModules')
      .withIndex('by_space_module', (q) =>
        q.eq('spaceId', space._id).eq('moduleId', args.moduleId),
      )
      .unique()
    const now = Date.now()
    if (existing) {
      if (existing.deletionStatus) {
        throw new ConvexError('Module data deletion requires retry')
      }
      await ctx.db.patch(existing._id, {
        state: args.state,
        updatedAt: now,
      })
      return
    }
    await ctx.db.insert('spaceModules', {
      spaceId: space._id,
      moduleId: args.moduleId,
      state: args.state,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const deleteData = action({
  args: { spaceSlug: v.string(), moduleId: v.string(), confirmation: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError('Authentication required')
    const claims = readSpaceClaims(identity, true)
    const definition = requireCatalogModule(args.moduleId)
    if (args.confirmation !== `DELETE ${definition.label}`) {
      throw new ConvexError(`Type DELETE ${definition.label} to confirm`)
    }
    const { space } = await ctx.runQuery((internal as any).spaces.resolveActionContext, {
      spaceSlug: args.spaceSlug,
      expectedClerkOrganizationId: claims.clerkOrganizationId,
      requireAdmin: true,
    })
    await ctx.runMutation((internal as any).spaceModules.markDeletionPending, {
      spaceId: space._id,
      moduleId: args.moduleId,
    })
    try {
      await ctx.runMutation((internal as any).spaceModules.runDeletionCleanup, {
        spaceId: space._id,
        moduleId: args.moduleId,
      })
      await ctx.runMutation((internal as any).spaceModules.completeDeletion, {
        spaceId: space._id,
        moduleId: args.moduleId,
      })
    } catch (error) {
      await ctx.runMutation((internal as any).spaceModules.failDeletion, {
        spaceId: space._id,
        moduleId: args.moduleId,
      })
      throw error
    }
  },
})

async function requireModuleRow(ctx: any, spaceId: any, moduleId: string) {
  const row = await ctx.db
    .query('spaceModules')
    .withIndex('by_space_module', (q: any) =>
      q.eq('spaceId', spaceId).eq('moduleId', moduleId),
    )
    .unique()
  if (!row) throw new ConvexError('Module state required')
  return row
}

export const markDeletionPending = internalMutation({
  args: { spaceId: v.id('spaces'), moduleId: v.string() },
  handler: async (ctx, args) => {
    requireCatalogModule(args.moduleId)
    const existing = await ctx.db
      .query('spaceModules')
      .withIndex('by_space_module', (q) =>
        q.eq('spaceId', args.spaceId).eq('moduleId', args.moduleId),
      )
      .unique()
    const now = Date.now()
    const moduleRecordId = existing?._id ?? await ctx.db.insert('spaceModules', {
      spaceId: args.spaceId,
      moduleId: args.moduleId,
      state: 'archived',
      deletionStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(moduleRecordId, {
      state: 'archived',
      deletionStatus: 'pending',
      updatedAt: now,
    })
  },
})

export const runDeletionCleanup = internalMutation({
  args: { spaceId: v.id('spaces'), moduleId: v.string() },
  handler: async (ctx, args) => {
    await requireModuleRow(ctx, args.spaceId, args.moduleId)
    await runModuleCleanup(ctx, args.moduleId, args.spaceId)
  },
})

export const runAllDeletionCleanup = internalMutation({
  args: { spaceId: v.id('spaces') },
  handler: async (ctx, args) => {
    for (const moduleId of Object.keys(moduleCleanupRegistry)) {
      await runModuleCleanup(ctx, moduleId, args.spaceId)
    }
  },
})

async function removeDeletedModuleReferences(ctx: any, spaceId: any, moduleId: string) {
  const definition = requireCatalogModule(moduleId)
  const widgetIds = new Set(definition.widgets.map((widget) => widget.id))
  const space = await ctx.db.get(spaceId)
  if (!space) throw new ConvexError('Space not found')

  const defaultPinnedModuleIds = space.defaultPinnedModuleIds.filter((id: string) => id !== moduleId)
  const defaultDashboard = space.defaultDashboard.filter(
    (widget: { widgetDefinitionId: string }) => !widgetIds.has(widget.widgetDefinitionId),
  )
  if (
    defaultPinnedModuleIds.length !== space.defaultPinnedModuleIds.length ||
    defaultDashboard.length !== space.defaultDashboard.length
  ) {
    await ctx.db.patch(space._id, {
      defaultPinnedModuleIds,
      defaultDashboard,
      updatedAt: Date.now(),
    })
  }

  const preferences = await ctx.db
    .query('spacePreferences')
    .withIndex('by_space_user', (q: any) => q.eq('spaceId', spaceId))
    .collect()
  for (const preference of preferences) {
    const patch: Record<string, unknown> = {}
    if (preference.pinnedModuleIds !== undefined) {
      const pinnedModuleIds = preference.pinnedModuleIds.filter((id: string) => id !== moduleId)
      if (pinnedModuleIds.length !== preference.pinnedModuleIds.length) {
        patch.pinnedModuleIds = pinnedModuleIds
      }
    }
    if (preference.dashboard !== undefined) {
      const dashboard = preference.dashboard.filter(
        (widget: { widgetDefinitionId: string }) => !widgetIds.has(widget.widgetDefinitionId),
      )
      if (dashboard.length !== preference.dashboard.length) patch.dashboard = dashboard
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(preference._id, { ...patch, updatedAt: Date.now() })
    }
  }
}
export const completeDeletion = internalMutation({
  args: { spaceId: v.id('spaces'), moduleId: v.string() },
  handler: async (ctx, args) => {
    const row = await requireModuleRow(ctx, args.spaceId, args.moduleId)
    await removeDeletedModuleReferences(ctx, args.spaceId, args.moduleId)
    await ctx.db.patch(row._id, { deletionStatus: undefined, updatedAt: Date.now() })
  },
})

export const failDeletion = internalMutation({
  args: { spaceId: v.id('spaces'), moduleId: v.string() },
  handler: async (ctx, args) => {
    const row = await requireModuleRow(ctx, args.spaceId, args.moduleId)
    await ctx.db.patch(row._id, {
      state: 'archived',
      deletionStatus: 'failed',
      updatedAt: Date.now(),
    })
  },
})