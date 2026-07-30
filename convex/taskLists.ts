import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { action, internalQuery, mutation, query } from './_generated/server'
import { getAdapter } from './lib/taskProviders'
import {
  ProviderAuthError,
  type UnifiedTask,
} from './lib/taskProviders/types'
import { groupIdFromSlugOrDefault } from './lib/groupAccess'
import { requireListAccess } from './lib/taskAccess'

const providerConfigValidator = v.object({
  connectionId: v.id('integrationConnections'),
  sourceId: v.string(),
  propertyMapping: v.optional(
    v.object({
      title: v.string(),
      done: v.string(),
      dueDate: v.optional(v.string()),
      priority: v.optional(v.string()),
      labels: v.optional(v.string()),
    }),
  ),
})

/** Lists in the given Group, or the viewer's default one; null = no default. */
export const list = query({
  args: { groupSlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const groupId = await groupIdFromSlugOrDefault(ctx, args.groupSlug)
    if (!groupId) return null
    const lists = await ctx.db
      .query('taskLists')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect()
    return lists
      .sort((a, b) => a.order - b.order)
      .map((l) => ({ _id: l._id, name: l.name, provider: l.provider }))
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    provider: v.union(
      v.literal('local'),
      v.literal('notion'),
      v.literal('todoist'),
    ),
    providerConfig: v.optional(providerConfigValidator),
    groupSlug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // A list added from a Group page belongs to that Group, and the connection
    // it links to has to belong there too - the check below reads the same
    // groupId either way, so a slug cannot be used to borrow another Group's
    // Notion token.
    const groupId = await groupIdFromSlugOrDefault(ctx, args.groupSlug)
    if (!groupId) {
      throw new ConvexError('Set a default group on the Groups page first')
    }

    if (args.provider === 'local') {
      if (args.providerConfig) {
        throw new ConvexError('Local lists take no provider config')
      }
    } else {
      if (!args.providerConfig) {
        throw new ConvexError('External lists need a provider config')
      }
      if (args.provider === 'notion' && !args.providerConfig.propertyMapping) {
        throw new ConvexError('Notion lists need a property mapping')
      }
      const conn = await ctx.db.get(args.providerConfig.connectionId)
      if (!conn || conn.groupId !== groupId || conn.provider !== args.provider) {
        throw new ConvexError('That connection does not belong to this group')
      }
    }

    const existing = await ctx.db
      .query('taskLists')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect()
    // existing.length collides with a sibling's order once any list has
    // been deleted, so derive the next order from the current max instead.
    const nextOrder =
      existing.reduce((max, l) => Math.max(max, l.order), -1) + 1
    return await ctx.db.insert('taskLists', {
      groupId,
      name: args.name,
      provider: args.provider,
      providerConfig: args.providerConfig,
      order: nextOrder,
    })
  },
})

export const rename = mutation({
  args: { listId: v.id('taskLists'), name: v.string() },
  handler: async (ctx, args) => {
    await requireListAccess(ctx, args.listId)
    await ctx.db.patch(args.listId, { name: args.name })
  },
})

export const remove = mutation({
  args: { listId: v.id('taskLists') },
  handler: async (ctx, args) => {
    await requireListAccess(ctx, args.listId)
    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_list', (q) => q.eq('listId', args.listId))
      .collect()
    await Promise.all(tasks.map((t) => ctx.db.delete(t._id)))
    await ctx.db.delete(args.listId)
  },
})

export const getList = internalQuery({
  args: { listId: v.id('taskLists') },
  handler: async (ctx, args) => {
    const { list } = await requireListAccess(ctx, args.listId)
    return list
  },
})

export type GetTasksResult =
  | { status: 'ok'; tasks: UnifiedTask[] }
  | { status: 'reconnect'; provider: 'notion' | 'todoist' }
  | { status: 'error'; message: string }

/** Unified entry point: returns UnifiedTask[] for any list, dispatching by
 * provider (spec §3). Local lists resolve from the tasks table; external
 * lists go through the matching adapter with the stored token. */
export const getTasks = action({
  args: { listId: v.id('taskLists') },
  handler: async (ctx, args): Promise<GetTasksResult> => {
    const list = await ctx.runQuery(internal.taskLists.getList, {
      listId: args.listId,
    })

    if (list.provider === 'local') {
      const rows = await ctx.runQuery(internal.tasks.listByListInternal, {
        listId: args.listId,
      })
      return {
        status: 'ok',
        tasks: rows.map((t) => ({
          externalId: t._id,
          title: t.title,
          done: t.done,
          dueDate: t.dueDate,
          priority: t.priority,
          labels: t.labels,
        })),
      }
    }

    const config = list.providerConfig
    if (!config) {
      return {
        status: 'error',
        message: 'This list is missing its provider configuration',
      }
    }
    const conn = await ctx.runQuery(internal.integrations.getConnection, {
      connectionId: config.connectionId,
    })
    if (!conn) return { status: 'reconnect', provider: list.provider }
    try {
      const tasks = await getAdapter(list.provider).fetchTasks(
        conn.accessToken,
        config,
      )
      return { status: 'ok', tasks }
    } catch (error) {
      if (error instanceof ProviderAuthError) {
        return { status: 'reconnect', provider: list.provider }
      }
      return {
        status: 'error',
        message: `Could not load tasks from ${list.provider} — try refreshing`,
      }
    }
  },
})
