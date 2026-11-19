import type { ExternalProviderId } from '@gather/core/domain'
import { aisleOrder, isDefaultAisleOrder } from '@gather/core/groceries'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { action, internalQuery, mutation, query } from './_generated/server'
import { getGatedIdentity } from './lib/connectedApps'
import { isGroceryList, recogniseGroceryTitle } from './lib/groceryCategories'
import { groceryAisleValidator } from './lib/groceryFields'
import { requireGroupBySlug, requireInGroup } from './lib/groupAccess'
import { deleteTaskList } from './lib/groupCascade'
import { createOnce, idempotencyKeyValidator } from './lib/idempotency'
import { nextOrder } from './lib/order'
import {
  providerConfigValidator,
  taskListColorValidator,
  taskListDisplayValidator,
  taskListIconValidator,
  taskListKindValidator,
  taskProviderValidator,
} from './lib/taskFields'
import { getAdapter } from './lib/taskProviders'
import { ProviderAuthError, type UnifiedTask } from './lib/taskProviders/types'

/** The lists of the named Group, and of no other. */
export const list = query({
  args: { groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const lists = await ctx.db
      .query('taskLists')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
    return lists
      .sort((a, b) => a.order - b.order)
      .map((l) => ({
        _id: l._id,
        name: l.name,
        provider: l.provider,
        order: l.order,
        display: l.display ?? { due: false, priority: false, labels: false },
        // APP-306. Absent on lists made before kinds: a plain list, drawn in
        // its kind's icon and colour (`taskListFace`).
        kind: l.kind ?? 'plain',
        icon: l.icon ?? null,
        color: l.color ?? null,
        // APP-309: whether its items are groceries, with an amount and an
        // aisle — the Group's grocery list, or any list made as one.
        grocery: isGroceryList(group, l),
        // APP-310: items checked before this left the Checked section of a
        // grocery list ("Clear checked") and are only in Recent now.
        checkedClearedAt: l.checkedClearedAt ?? null,
        // APP-313: a grocery list's own aisle order, or null for the default
        // walking order. Read through `aisleOrder` (`@gather/core/groceries`).
        aisleOrder: l.aisleOrder ?? null,
        // Whether this list can be added to from Gather: only a local list
        // has `tasks` rows, and no provider write path exists (ADR-0021).
        // Callers that offer a list as somewhere to write — the baby log's
        // checklist cards, for one — need this before the person picks, not
        // after they try.
        writable: l.provider === 'local',
      }))
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    provider: taskProviderValidator,
    providerConfig: v.optional(providerConfigValidator),
    groupSlug: v.string(),
    idempotencyKey: idempotencyKeyValidator,
    // APP-306, all optional so older phones and the web keep calling this as
    // before. `starterTasks` are a template's items in the creator's language,
    // written onto a local list in the same transaction as the list.
    kind: v.optional(taskListKindValidator),
    icon: v.optional(taskListIconValidator),
    color: v.optional(taskListColorValidator),
    starterTasks: v.optional(v.array(v.string())),
    // APP-313: sent by phones whose Groceries Module opens the list by id, so a
    // second store list does not re-point `groups.groceryListId`. Absent
    // (installed phones, the web, MCP), a new groceries list is the Group's
    // grocery list, which is where an installed phone goes next. Contract:
    // drop with `groceryListId` (docs/migrations/README.md).
    keepGroceryList: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // A list belongs to the Group in the URL, and the connection it links to
    // has to belong there too — both read the same groupId, so a slug cannot
    // be used to borrow another Group's Notion token.
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    const groupId = group._id

    const starterTasks = checkedStarterTasks(args.starterTasks)
    if (args.provider === 'local') {
      if (args.providerConfig) {
        throw new ConvexError('Local lists take no provider config')
      }
    } else {
      if (starterTasks.length > 0) {
        throw new ConvexError('Only a local list starts with tasks')
      }
      if (!args.providerConfig) {
        throw new ConvexError('External lists need a provider config')
      }
      if (args.provider === 'notion' && !args.providerConfig.propertyMapping) {
        throw new ConvexError('Notion lists need a property mapping')
      }
      const conn = await ctx.db.get(args.providerConfig.connectionId)
      if (
        !conn ||
        conn.groupId !== groupId ||
        conn.provider !== args.provider
      ) {
        throw new ConvexError('That connection does not belong to this group')
      }
    }

    return await createOnce(
      ctx,
      user._id,
      'taskLists',
      args.idempotencyKey,
      async () => {
        const existing = await ctx.db
          .query('taskLists')
          .withIndex('by_group', (q) => q.eq('groupId', groupId))
          .collect()
        const listId = await ctx.db.insert('taskLists', {
          groupId,
          name: args.name,
          provider: args.provider,
          providerConfig: args.providerConfig,
          order: nextOrder(existing),
          ...(args.kind ? { kind: args.kind } : {}),
          ...(args.icon ? { icon: args.icon } : {}),
          ...(args.color ? { color: args.color } : {}),
        })
        for (const [order, title] of starterTasks.entries()) {
          // A new grocery list's starter items get their aisles from what is
          // known (APP-353). They do not ask the model: a template holds up to
          // STARTER_TASKS_MAX items, and the daily budget is shared.
          const grocery =
            args.kind === 'groceries'
              ? await recogniseGroceryTitle(ctx, groupId, title, [])
              : null
          await ctx.db.insert('tasks', {
            listId,
            title,
            done: false,
            createdBy: user._id,
            order,
            ...(grocery ? { category: grocery.aisle } : {}),
          })
        }
        // A list made as the groceries becomes the Group's grocery list, the
        // one an installed phone's Groceries Module opens (ADR-0034,
        // `kitchen.groceries`); an installed phone opens it right after making
        // it. A newer phone making a second store list (APP-313) keeps the
        // named one, or every installed phone would move onto an empty list;
        // it names this one only when the Group names no list of its own.
        if (args.kind === 'groceries') {
          const named = (await ctx.db.get(groupId))?.groceryListId
          const current = named ? await ctx.db.get(named) : null
          const keeps =
            args.keepGroceryList === true &&
            current !== null &&
            current.groupId === groupId
          if (!keeps) await ctx.db.patch(groupId, { groceryListId: listId })
        }
        return listId
      },
    )
  },
})

/** The most starter items a template may bring, and the longest title. */
export const STARTER_TASKS_MAX = 50
export const STARTER_TITLE_MAX = 200

/** A template's items, trimmed, with the bounds a create may not exceed. */
function checkedStarterTasks(titles: readonly string[] | undefined): string[] {
  if (!titles) return []
  if (titles.length > STARTER_TASKS_MAX) {
    throw new ConvexError('Too many starter tasks')
  }
  return titles.map((title) => {
    const trimmed = title.trim()
    if (!trimmed || trimmed.length > STARTER_TITLE_MAX) {
      throw new ConvexError('A starter task needs a title')
    }
    return trimmed
  })
}

/** A list's tile: its colour, its icon, or both. */
export const setAppearance = mutation({
  args: {
    listId: v.id('taskLists'),
    groupSlug: v.string(),
    icon: v.optional(taskListIconValidator),
    color: v.optional(taskListColorValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireInGroup(ctx, args.groupSlug, args.listId, 'List not found')
    await ctx.db.patch(args.listId, {
      ...(args.icon ? { icon: args.icon } : {}),
      ...(args.color ? { color: args.color } : {}),
    })
    return null
  },
})

export const rename = mutation({
  args: {
    listId: v.id('taskLists'),
    groupSlug: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requireInGroup(ctx, args.groupSlug, args.listId, 'List not found')
    await ctx.db.patch(args.listId, { name: args.name })
  },
})

/**
 * "Clear checked" on a grocery list (APP-310): what is checked now leaves the
 * list's Checked section and stays in Recent. Nothing is deleted; the list
 * only remembers when. Answers the previous moment, which is what the undo
 * puts back through `restoreCheckedCleared`.
 */
export const clearChecked = mutation({
  args: { listId: v.id('taskLists'), groupSlug: v.string() },
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, args) => {
    const { group, doc: list } = await requireInGroup(
      ctx,
      args.groupSlug,
      args.listId,
      'List not found',
    )
    if (list.provider !== 'local' || !isGroceryList(group, list)) {
      throw new ConvexError('That is not a grocery list')
    }
    await ctx.db.patch(args.listId, { checkedClearedAt: Date.now() })
    return list.checkedClearedAt ?? null
  },
})

/**
 * A grocery list's aisle order, the way its store is walked (APP-313), or
 * `null` for the default walking order ("Restore default order"). The order
 * may leave out aisles a phone did not know; they are stored after it, so the
 * list always holds every aisle once.
 */
export const setAisleOrder = mutation({
  args: {
    listId: v.id('taskLists'),
    groupSlug: v.string(),
    order: v.union(v.array(groceryAisleValidator), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { group, doc: list } = await requireInGroup(
      ctx,
      args.groupSlug,
      args.listId,
      'List not found',
    )
    if (list.provider !== 'local' || !isGroceryList(group, list)) {
      throw new ConvexError('That is not a grocery list')
    }
    if (args.order && new Set(args.order).size !== args.order.length) {
      throw new ConvexError('An aisle order names each aisle once')
    }
    await ctx.db.patch(args.listId, {
      aisleOrder:
        args.order === null || isDefaultAisleOrder(args.order)
          ? undefined
          : aisleOrder(args.order),
    })
    return null
  },
})

/** The undo of `clearChecked`: the moment it answered, or none. */
export const restoreCheckedCleared = mutation({
  args: {
    listId: v.id('taskLists'),
    groupSlug: v.string(),
    checkedClearedAt: v.union(v.number(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireInGroup(ctx, args.groupSlug, args.listId, 'List not found')
    await ctx.db.patch(args.listId, {
      checkedClearedAt: args.checkedClearedAt ?? undefined,
    })
    return null
  },
})

export const updateDisplay = mutation({
  args: {
    listId: v.id('taskLists'),
    groupSlug: v.string(),
    display: taskListDisplayValidator,
  },
  handler: async (ctx, args) => {
    await requireInGroup(ctx, args.groupSlug, args.listId, 'List not found')
    await ctx.db.patch(args.listId, { display: args.display })
  },
})

export const remove = mutation({
  args: { listId: v.id('taskLists'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    await requireInGroup(ctx, args.groupSlug, args.listId, 'List not found')
    await deleteTaskList(ctx, args.listId)
  },
})

/**
 * The list behind `getTasks`, authorised for the caller. Internal because it
 * carries `providerConfig`, not because it is trusted: an action has no `ctx.db`
 * and the caller's identity reaches this query, so the Group is checked here.
 */
export const getList = internalQuery({
  args: { listId: v.id('taskLists'), groupSlug: v.string() },
  handler: async (ctx, args) => {
    const { doc: list } = await requireInGroup(
      ctx,
      args.groupSlug,
      args.listId,
      'List not found',
    )
    return list
  },
})

export type GetTasksResult =
  | { status: 'ok'; tasks: UnifiedTask[] }
  | { status: 'reconnect'; provider: ExternalProviderId }
  | { status: 'error'; message: string }

/** Unified entry point: returns UnifiedTask[] for any list, dispatching by
 * provider (spec §3). Local lists resolve from the tasks table; external
 * lists go through the matching adapter with the stored token. */
export const getTasks = action({
  args: { listId: v.id('taskLists'), groupSlug: v.string() },
  handler: async (ctx, args): Promise<GetTasksResult> => {
    // An action can write, so a read-only connected app is refused (ADR-0046).
    await getGatedIdentity(ctx)
    const list = await ctx.runQuery(internal.taskLists.getList, {
      listId: args.listId,
      groupSlug: args.groupSlug,
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
