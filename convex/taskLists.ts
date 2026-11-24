import { isIsoDate } from '@gather/core/civil-date'
import type { ExternalProviderId } from '@gather/core/domain'
import { aisleOrder, isDefaultAisleOrder } from '@gather/core/groceries'
import { taskRefusal } from '@gather/core/refusals'
import { ConvexError, type Infer, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { action, internalQuery, mutation, query } from './_generated/server'
import { getGatedIdentity, isConnectedApp } from './lib/connectedApps'
import {
  groceryTitleKey,
  isGroceryList,
  recogniseGroceryTitle,
  requireWritableGroceryList,
} from './lib/groceryCategories'
import { groceryAisleValidator } from './lib/groceryFields'
import { requireGroupBySlug, requireInGroup } from './lib/groupAccess'
import { deleteTaskList } from './lib/groupCascade'
import { createOnce, IDEMPOTENCY_KEY_REQUIRED, idempotencyKeyValidator } from './lib/idempotency'
import { nextOrder } from './lib/order'
import {
  linkedTaskWriteValidator,
  providerConfigValidator,
  taskListColorValidator,
  taskListDisplayValidator,
  taskListIconValidator,
  taskListKindValidator,
  taskProviderValidator,
} from './lib/taskFields'
import { getAdapter } from './lib/taskProviders'
import {
  ProviderAuthError,
  ProviderTaskNotFoundError,
  type SourceConfig,
  type TaskProviderWriter,
  type UnifiedTask,
  type WriteOutcome,
} from './lib/taskProviders/types'
import {
  checkedSectionName,
  checkSectionCount,
  newSectionId,
} from './lib/taskSections'

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
        // APP-357: its sections in order; none on a list made before them.
        sections: l.sections ?? [],
        // APP-309: whether its items are groceries, with an amount and an
        // aisle — the Group's grocery list, or any list made as one.
        grocery: isGroceryList(group, l),
        // APP-310: items checked before this left the Checked section of a
        // grocery list ("Clear checked") and are only in Recent now.
        checkedClearedAt: l.checkedClearedAt ?? null,
        // APP-313: a grocery list's own aisle order, or null for the default
        // walking order. Read through `aisleOrder` (`@gather/core/groceries`).
        aisleOrder: l.aisleOrder ?? null,
        // APP-311: whether the list's "Maybe needed" strip is switched off.
        suggestionsOff: l.suggestionsOff ?? false,
        // Whether this list's tasks are Gather's own rows, which the `tasks`
        // mutations write. Installed phones write to every `writable` list
        // through those, so a linked list stays false here whatever its
        // provider can do; `capabilities` says that.
        // Callers that offer a list as somewhere to write — the baby log's
        // checklist cards, for one — need this before the person picks, not
        // after they try.
        writable: l.provider === 'local',
        // APP-448: whether `taskLists.writeTask` can write to it (ADR-0021).
        capabilities: {
          write:
            l.provider !== 'local' && getAdapter(l.provider).capabilities.write,
        },
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
    // APP-357: a template's items already in their sections, in the
    // creator's language. Sent instead of `starterTasks`, never with it.
    starterSections: v.optional(
      v.array(v.object({ name: v.string(), tasks: v.array(v.string()) })),
    ),
  },
  handler: async (ctx, args) => {
    // A list belongs to the Group in the URL, and the connection it links to
    // has to belong there too — both read the same groupId, so a slug cannot
    // be used to borrow another Group's Notion token.
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    const groupId = group._id

    if (args.starterTasks && args.starterSections) {
      throw new ConvexError('Send starter tasks or starter sections, not both')
    }
    const starterSections = checkedStarterSections(args.starterSections)
    const starterTasks = [
      ...checkedStarterTasks(args.starterTasks).map((title) => ({
        title,
        sectionId: undefined as string | undefined,
      })),
      ...starterSections.flatMap((section) =>
        section.tasks.map((title) => ({ title, sectionId: section.id })),
      ),
    ]
    if (starterTasks.length > STARTER_TASKS_MAX) {
      throw new ConvexError('Too many starter tasks')
    }
    if (args.provider === 'local') {
      if (args.providerConfig) {
        throw new ConvexError('Local lists take no provider config')
      }
    } else {
      if (starterTasks.length > 0 || starterSections.length > 0) {
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
          ...(starterSections.length > 0
            ? {
                sections: starterSections.map(({ id, name }) => ({ id, name })),
              }
            : {}),
        })
        for (const [order, { title, sectionId }] of starterTasks.entries()) {
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
            ...(sectionId ? { sectionId } : {}),
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

/** A template's sections, each with a new id, checked like starter tasks. */
function checkedStarterSections(
  sections: readonly { name: string; tasks: readonly string[] }[] | undefined,
): { id: string; name: string; tasks: string[] }[] {
  if (!sections) return []
  checkSectionCount(sections.length)
  return sections.map((section) => ({
    id: newSectionId(),
    name: checkedSectionName(section.name),
    tasks: checkedStarterTasks(section.tasks),
  }))
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
 * only remembers when. Answers that moment (`clearedAt`) and the one before
 * (`previous`); the undo passes both back to `restoreCheckedCleared`, which
 * puts `previous` back only while `clearedAt` is still the list's last clear
 * (APP-403).
 */
export const clearCheckedUndoable = mutation({
  args: { listId: v.id('taskLists'), groupSlug: v.string() },
  returns: v.object({
    clearedAt: v.number(),
    previous: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, args) => await clearCheckedOn(ctx, args),
})

/**
 * `clearCheckedUndoable` for installed phones, which read the previous moment
 * as the whole answer. Retires with its row in `docs/migrations/README.md`.
 */
export const clearChecked = mutation({
  args: { listId: v.id('taskLists'), groupSlug: v.string() },
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, args) => (await clearCheckedOn(ctx, args)).previous,
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

async function clearCheckedOn(
  ctx: MutationCtx,
  args: { listId: Id<'taskLists'>; groupSlug: string },
) {
  const { group, doc: list } = await requireInGroup(
    ctx,
    args.groupSlug,
    args.listId,
    taskRefusal('not-found'),
  )
  requireWritableGroceryList(group, list)
  const clearedAt = Date.now()
  await ctx.db.patch(args.listId, { checkedClearedAt: clearedAt })
  return { clearedAt, previous: list.checkedClearedAt ?? null }
}

/**
 * The undo of Clear checked: the moment it answered as `previous`, or none.
 *
 * Refused, and nothing changes (APP-403), when:
 * - the moment is in the future, or not before the clear it undoes
 *   (`invalid-undo`);
 * - the list has been cleared again since, by anyone, or already put back
 *   (`clear-superseded`). A current phone passes the `clearedAt` its clear
 *   answered, and only that clear can be undone. An installed phone passes
 *   none; then only a list whose last clear is after `checkedClearedAt` can
 *   be put back.
 */
export const restoreCheckedCleared = mutation({
  args: {
    listId: v.id('taskLists'),
    groupSlug: v.string(),
    checkedClearedAt: v.union(v.number(), v.null()),
    clearedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { group, doc: list } = await requireInGroup(
      ctx,
      args.groupSlug,
      args.listId,
      taskRefusal('not-found'),
    )
    requireWritableGroceryList(group, list)
    const previous = args.checkedClearedAt
    const latest = args.clearedAt ?? Date.now()
    if (previous !== null && (previous > Date.now() || previous >= latest))
      throw new ConvexError(taskRefusal('invalid-undo'))
    const current = list.checkedClearedAt
    const superseded =
      args.clearedAt !== undefined
        ? current !== args.clearedAt
        : current === undefined || (previous !== null && current <= previous)
    if (superseded) throw new ConvexError(taskRefusal('clear-superseded'))
    await ctx.db.patch(args.listId, { checkedClearedAt: previous ?? undefined })
    return null
  },
})

/** How many names one list's suggestions can hide; the oldest go first. */
export const HIDDEN_SUGGESTIONS_LIMIT = 500

/** The longest title a suggestion is hidden by, as for a grocery line. */
const SUGGESTION_TITLE_MAX = 500

/** A hidden suggestion's key: a grocery title, not longer than a line. */
function suggestionKey(title: string): string {
  if (title.length > SUGGESTION_TITLE_MAX) {
    throw new ConvexError('That is not an item')
  }
  return groceryTitleKey(title)
}

/** A local grocery list of the named Group, for a suggestions write. */
async function requireSuggestionsList(
  ctx: MutationCtx,
  groupSlug: string,
  listId: Id<'taskLists'>,
) {
  const { group, doc: list } = await requireInGroup(
    ctx,
    groupSlug,
    listId,
    'List not found',
  )
  if (list.provider !== 'local' || !isGroceryList(group, list)) {
    throw new ConvexError('That is not a grocery list')
  }
  return list
}

/**
 * The "Maybe needed" strip on or off for a grocery list (APP-311), for every
 * Member: the list's `…` menu.
 */
export const setSuggestions = mutation({
  args: { listId: v.id('taskLists'), groupSlug: v.string(), on: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSuggestionsList(ctx, args.groupSlug, args.listId)
    await ctx.db.patch(args.listId, {
      suggestionsOff: args.on ? undefined : true,
    })
    return null
  },
})

/**
 * A name off a grocery list's suggestions for good (APP-311): press and hold
 * on the strip. Kept as its `groceryTitleKey`, so "Melk" and "2 pak melk"
 * are one name.
 */
export const hideSuggestion = mutation({
  args: { listId: v.id('taskLists'), groupSlug: v.string(), title: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const list = await requireSuggestionsList(ctx, args.groupSlug, args.listId)
    const key = suggestionKey(args.title)
    const hidden = list.hiddenSuggestions ?? []
    if (!key || hidden.includes(key)) return null
    await ctx.db.patch(args.listId, {
      hiddenSuggestions: [...hidden, key].slice(-HIDDEN_SUGGESTIONS_LIMIT),
    })
    return null
  },
})

/** The undo of `hideSuggestion`: the name can be suggested again. */
export const unhideSuggestion = mutation({
  args: { listId: v.id('taskLists'), groupSlug: v.string(), title: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const list = await requireSuggestionsList(ctx, args.groupSlug, args.listId)
    const key = suggestionKey(args.title)
    const hidden = list.hiddenSuggestions ?? []
    if (!hidden.includes(key)) return null
    const rest = hidden.filter((name) => name !== key)
    await ctx.db.patch(args.listId, {
      hiddenSuggestions: rest.length ? rest : undefined,
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
          parentExternalId: t.parentTaskId,
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

export type LinkedTaskWrite = Infer<typeof linkedTaskWriteValidator>

export type WriteTaskResult =
  | ({ status: 'ok' } & WriteOutcome)
  | { status: 'reconnect'; provider: ExternalProviderId }
  | { status: 'error'; reason: 'not-found' | 'failed' }

const MAX_TITLE = 500
const REQUEST_KEY = /^[\w-]{1,64}$/

/** A write as the provider may be sent it; throws on one that makes no sense. */
function checkedWrite(write: LinkedTaskWrite): LinkedTaskWrite {
  if (write.kind === 'create' || write.kind === 'update') {
    if (write.dueDate != null && !isIsoDate(write.dueDate)) {
      throw new ConvexError('Date must be YYYY-MM-DD')
    }
    if (write.title !== undefined) {
      const title = write.title.trim()
      if (!title || title.length > MAX_TITLE) {
        throw new ConvexError('A task needs a title of at most 500 characters')
      }
      return { ...write, title }
    }
  }
  if (write.kind === 'move' && write.parentId === write.taskId) {
    throw new ConvexError('A task cannot be its own subtask')
  }
  return write
}

function runWrite(
  writer: TaskProviderWriter,
  accessToken: string,
  config: SourceConfig,
  write: LinkedTaskWrite,
): Promise<WriteOutcome> {
  switch (write.kind) {
    case 'create': {
      const { kind: _, requestKey, ...task } = write
      return writer.createTask(accessToken, config, {
        ...task,
        ...(requestKey && REQUEST_KEY.test(requestKey) ? { requestKey } : {}),
      })
    }
    case 'update': {
      const { kind: _, taskId, ...changes } = write
      return writer.updateTask(accessToken, config, taskId, changes)
    }
    case 'setDone':
      return write.done
        ? writer.closeTask(accessToken, config, write.taskId, {
            withSubtasks: write.withSubtasks ?? false,
          })
        : writer.reopenTask(accessToken, config, write.taskId)
    case 'move':
      return writer.moveTask(accessToken, config, write.taskId, write.parentId)
  }
}

/**
 * One write to a linked list, made in its provider first (ADR-0020): Gather
 * stores none of it, and answers `ok` only once the provider accepted it.
 * Local lists are written by the `tasks` mutations, and a provider without a
 * write path is refused.
 */
export const writeTask = action({
  args: {
    listId: v.id('taskLists'),
    groupSlug: v.string(),
    write: linkedTaskWriteValidator,
  },
  handler: async (ctx, args): Promise<WriteTaskResult> => {
    await getGatedIdentity(ctx)
    const list = await ctx.runQuery(internal.taskLists.getList, {
      listId: args.listId,
      groupSlug: args.groupSlug,
    })
    const writer =
      list.provider === 'local' ? undefined : getAdapter(list.provider).writer
    if (list.provider === 'local' || !writer) {
      throw new ConvexError(taskRefusal('read-only'))
    }
    const write = checkedWrite(args.write)
    // A connected app retries, so its create must carry a key (ADR-0046).
    if (
      write.kind === 'create' &&
      !REQUEST_KEY.test(write.requestKey ?? '') &&
      (await isConnectedApp(ctx))
    ) {
      throw new ConvexError(IDEMPOTENCY_KEY_REQUIRED)
    }
    const config = list.providerConfig
    if (!config) return { status: 'error', reason: 'failed' }
    const conn = await ctx.runQuery(internal.integrations.getConnection, {
      connectionId: config.connectionId,
    })
    if (!conn) return { status: 'reconnect', provider: list.provider }
    try {
      const outcome = await runWrite(writer, conn.accessToken, config, write)
      return { status: 'ok', ...outcome }
    } catch (error) {
      if (error instanceof ProviderAuthError) {
        return { status: 'reconnect', provider: list.provider }
      }
      return {
        status: 'error',
        reason:
          error instanceof ProviderTaskNotFoundError ? 'not-found' : 'failed',
      }
    }
  },
})
