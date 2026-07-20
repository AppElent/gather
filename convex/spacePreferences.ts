import { ConvexError, v } from 'convex/values'
import { mutation } from './_generated/server'
import { MODULES, type ModuleDefinition, type WidgetInstance } from '../src/lib/modules'
import { validateWidgetInstances } from '../src/lib/widgets'
import { requireActiveSpace } from './lib/spaceAuth'

const widgetInstance = v.object({
  instanceId: v.string(),
  widgetDefinitionId: v.string(),
  size: v.union(v.literal('compact'), v.literal('standard'), v.literal('wide')),
  config: v.optional(v.any()),
})

async function findPreference(ctx: any, spaceId: any, userId: any) {
  return await ctx.db
    .query('spacePreferences')
    .withIndex('by_space_user', (q: any) => q.eq('spaceId', spaceId).eq('userId', userId))
    .unique()
}

async function visibleModules(ctx: any, spaceId: any): Promise<ModuleDefinition[]> {
  const states = await ctx.db
    .query('spaceModules')
    .withIndex('by_space', (q: any) => q.eq('spaceId', spaceId))
    .collect()
  const stateByModule = new Map(states.map((state: any) => [state.moduleId, state.state]))
  return MODULES.filter((definition) => {
    const state = stateByModule.get(definition.id)
    return definition.availability === 'live' && (state === 'enabled' || state === 'preEnabled')
  })
}

export async function validatePinnedModules(ctx: any, spaceId: any, pinnedModuleIds: string[]) {
  const visible = new Map((await visibleModules(ctx, spaceId)).map((module) => [module.id, module]))
  const seen = new Set<string>()
  for (const moduleId of pinnedModuleIds) {
    const definition = MODULES.find((module) => module.id === moduleId)
    if (!definition) throw new ConvexError(`Unknown module ${moduleId}`)
    if (definition.availability !== 'live') {
      throw new ConvexError(`${definition.label} is coming soon`)
    }
    if (!visible.has(moduleId)) throw new ConvexError(`${definition.label} is not enabled`)
    if (seen.has(moduleId)) throw new ConvexError(`${definition.label} is pinned more than once`)
    seen.add(moduleId)
  }
}

async function validateDashboard(ctx: any, spaceId: any, dashboard: WidgetInstance[]) {
  const visible = await visibleModules(ctx, spaceId)
  const definitions = visible.flatMap((module) => module.widgets)
  const instanceIds = new Set<string>()
  for (const widget of dashboard) {
    if (instanceIds.has(widget.instanceId)) {
      throw new ConvexError('Widget instance IDs must be unique')
    }
    instanceIds.add(widget.instanceId)
  }
  try {
    return validateWidgetInstances(dashboard, definitions)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid dashboard'
    const widgetId = dashboard.find((widget) => !definitions.some((definition) => definition.id === widget.widgetDefinitionId))?.widgetDefinitionId
    if (widgetId) {
      const definition = MODULES.flatMap((module) => module.widgets).find((widget) => widget.id === widgetId)
      if (definition) {
        const module = MODULES.find((item) => item.id === definition.moduleId)!
        if (module.availability !== 'live') throw new ConvexError(`${module.label} is coming soon`)
        throw new ConvexError(`${module.label} is not enabled`)
      }
    }
    throw new ConvexError(message)
  }
}

async function savePreference(
  ctx: any,
  input: { spaceId: any; userId: any; patch: Record<string, unknown> },
) {
  const existing = await findPreference(ctx, input.spaceId, input.userId)
  const updatedAt = Date.now()
  if (existing) {
    await ctx.db.patch(existing._id, { ...input.patch, updatedAt })
    return
  }
  await ctx.db.insert('spacePreferences', {
    spaceId: input.spaceId,
    userId: input.userId,
    ...input.patch,
    updatedAt,
  })
}

export const saveNavigation = mutation({
  args: { spaceSlug: v.string(), pinnedModuleIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const { space, user } = await requireActiveSpace(ctx, { spaceSlug: args.spaceSlug })
    await validatePinnedModules(ctx, space._id, args.pinnedModuleIds)
    await savePreference(ctx, {
      spaceId: space._id,
      userId: user._id,
      patch: { pinnedModuleIds: [...args.pinnedModuleIds] },
    })
  },
})

export const resetNavigation = mutation({
  args: { spaceSlug: v.string() },
  handler: async (ctx, args) => {
    const { user, space } = await requireActiveSpace(ctx, args)
    const row = await findPreference(ctx, space._id, user._id)
    if (!row) return
    if (row.dashboard === undefined) await ctx.db.delete(row._id)
    else await ctx.db.patch(row._id, { pinnedModuleIds: undefined, updatedAt: Date.now() })
  },
})

export const saveDashboard = mutation({
  args: { spaceSlug: v.string(), dashboard: v.array(widgetInstance) },
  handler: async (ctx, args) => {
    const { space, user } = await requireActiveSpace(ctx, { spaceSlug: args.spaceSlug })
    const dashboard = await validateDashboard(ctx, space._id, args.dashboard)
    await savePreference(ctx, {
      spaceId: space._id,
      userId: user._id,
      patch: { dashboard },
    })
  },
})

export const resetDashboard = mutation({
  args: { spaceSlug: v.string() },
  handler: async (ctx, args) => {
    const { user, space } = await requireActiveSpace(ctx, args)
    const row = await findPreference(ctx, space._id, user._id)
    if (!row) return
    if (row.pinnedModuleIds === undefined) await ctx.db.delete(row._id)
    else await ctx.db.patch(row._id, { dashboard: undefined, updatedAt: Date.now() })
  },
})
