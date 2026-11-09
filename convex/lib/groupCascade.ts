/**
 * Emptying a Group of everything it contains.
 *
 * Rows a deleted Group leaves behind read exactly like rows that are not there:
 * nothing surfaces them, and they keep their photos alive in storage. So one
 * function destroys a Group, and account deletion, `groups.deleteGroup` and the
 * sample reset all go through it.
 *
 * ## The registry cannot be forgotten
 *
 * `GROUP_CONTENT` is keyed by *every table in the schema that has a
 * `groupId`*, derived from the data model rather than written out. A new
 * Module's table fails to compile here until somebody says how its rows are
 * reached — which is the only thing standing between a new Module and another
 * silent leak. It is the same trick, for the same reason, as `FILE_HOLDERS` in
 * `storedFiles.ts`.
 *
 * Three tables are deliberately *not* in it, because they hang off a parent
 * rather than off a Group: `tasks` (a list), `calendarEvents` (a calendar) and
 * `babyEvents` (a baby). Each is deleted by the entry that owns its parent, so
 * the parent's rows are still there to be enumerated from.
 *
 * ## Blobs come back rather than going here
 *
 * `deleteStoredFile` asks whether any row in any photo-holding table still
 * points at a blob, so it costs a scan of each of them per photo, which a Group
 * with fifty photos could not spend inside one transaction. So the storage ids
 * are collected and released by scheduled work, which is also what makes the
 * whole thing survive a Group larger than one transaction.
 */

import { internal } from '../_generated/api'
import type { Doc, Id, TableNames } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import type { GroupScopedTable } from './groupAccess'
import { storedFileIdOf } from './storedFiles'

/** Delete these rows, handing back the stored files they were holding. */
async function purge<T extends TableNames>(
  ctx: MutationCtx,
  table: T,
  rows: Doc<T>[],
): Promise<Id<'_storage'>[]> {
  const files: Id<'_storage'>[] = []
  for (const row of rows) {
    const file = storedFileIdOf(table, row)
    if (file) files.push(file)
    await ctx.db.delete(row._id)
  }
  return files
}

/** Delete a list's tasks: the only way to find them is through the list. */
export async function purgeTasksOfList(
  ctx: MutationCtx,
  listId: Id<'taskLists'>,
) {
  await purge(
    ctx,
    'tasks',
    await ctx.db
      .query('tasks')
      .withIndex('by_list', (q) => q.eq('listId', listId))
      .collect(),
  )
}

/**
 * Delete one list, its tasks, and every pointer at it: the Group's grocery
 * list and a child's to-do and questions cards. Both are set through
 * `requireInGroup`, so they live in the list's own Group. A card that lost its
 * list also loses `…Chosen`, so the list `babies.ensureAuxLists` gives it next
 * dies with the child.
 */
export async function deleteTaskList(
  ctx: MutationCtx,
  listId: Id<'taskLists'>,
) {
  const list = await ctx.db.get(listId)
  if (!list) return
  await purgeTasksOfList(ctx, listId)
  await ctx.db.delete(listId)

  const group = await ctx.db.get(list.groupId)
  if (group?.groceryListId === listId) {
    await ctx.db.patch(group._id, { groceryListId: undefined })
  }
  const babies = await ctx.db
    .query('babies')
    .withIndex('by_group', (q) => q.eq('groupId', list.groupId))
    .collect()
  for (const baby of babies) {
    const patch: Partial<Doc<'babies'>> = {}
    if (baby.taskListId === listId) {
      patch.taskListId = undefined
      patch.taskListChosen = undefined
    }
    if (baby.questionsListId === listId) {
      patch.questionsListId = undefined
      patch.questionsListChosen = undefined
    }
    if (Object.keys(patch).length > 0) await ctx.db.patch(baby._id, patch)
  }
}

/** Delete a calendar's events: the only way to find them is through it. */
export async function purgeEventsOfCalendar(
  ctx: MutationCtx,
  calendarId: Id<'calendars'>,
) {
  await purge(
    ctx,
    'calendarEvents',
    await ctx.db
      .query('calendarEvents')
      .withIndex('by_calendar', (q) => q.eq('calendarId', calendarId))
      .collect(),
  )
}

/** Delete a child's events, handing back the photos they held. */
export async function purgeEventsOfBaby(
  ctx: MutationCtx,
  babyId: Id<'babies'>,
): Promise<Id<'_storage'>[]> {
  return await purge(
    ctx,
    'babyEvents',
    await ctx.db
      .query('babyEvents')
      .withIndex('by_baby', (q) => q.eq('babyId', babyId))
      .collect(),
  )
}

/**
 * How each group-scoped table's rows are reached and removed.
 *
 * Declaration order is deletion order, and the first entry is deliberate: a
 * connection left behind is a live OAuth token nobody can reach or revoke
 * through the app any more. The rest is containment — a parent's entry clears
 * its children before removing the parent, because the parent rows are the
 * only way to find them.
 */
const GROUP_CONTENT: {
  [T in GroupScopedTable]: (
    ctx: MutationCtx,
    groupId: Id<'groups'>,
  ) => Promise<Id<'_storage'>[]>
} = {
  integrationConnections: async (ctx, groupId) =>
    purge(
      ctx,
      'integrationConnections',
      await ctx.db
        .query('integrationConnections')
        .withIndex('by_group_provider', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  taskLists: async (ctx, groupId) => {
    const lists = await ctx.db
      .query('taskLists')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect()
    for (const list of lists) await purgeTasksOfList(ctx, list._id)
    return purge(ctx, 'taskLists', lists)
  },

  babies: async (ctx, groupId) => {
    const babies = await ctx.db
      .query('babies')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect()
    const files: Id<'_storage'>[] = []
    for (const baby of babies) {
      files.push(...(await purgeEventsOfBaby(ctx, baby._id)))
    }
    files.push(...(await purge(ctx, 'babies', babies)))
    return files
  },

  calendars: async (ctx, groupId) => {
    const calendars = await ctx.db
      .query('calendars')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect()
    for (const calendar of calendars) {
      await purgeEventsOfCalendar(ctx, calendar._id)
    }
    return purge(ctx, 'calendars', calendars)
  },

  recipes: async (ctx, groupId) =>
    purge(
      ctx,
      'recipes',
      await ctx.db
        .query('recipes')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  notes: async (ctx, groupId) =>
    purge(
      ctx,
      'notes',
      await ctx.db
        .query('notes')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  mealEntries: async (ctx, groupId) =>
    purge(
      ctx,
      'mealEntries',
      await ctx.db
        .query('mealEntries')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  plannedDinners: async (ctx, groupId) =>
    purge(
      ctx,
      'plannedDinners',
      await ctx.db
        .query('plannedDinners')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  pantryEntries: async (ctx, groupId) =>
    purge(
      ctx,
      'pantryEntries',
      await ctx.db
        .query('pantryEntries')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  tastings: async (ctx, groupId) =>
    purge(
      ctx,
      'tastings',
      await ctx.db
        .query('tastings')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  tastingSubjects: async (ctx, groupId) =>
    purge(
      ctx,
      'tastingSubjects',
      await ctx.db
        .query('tastingSubjects')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  loanParts: async (ctx, groupId) =>
    purge(
      ctx,
      'loanParts',
      await ctx.db
        .query('loanParts')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  mortgageCalculations: async (ctx, groupId) =>
    purge(
      ctx,
      'mortgageCalculations',
      await ctx.db
        .query('mortgageCalculations')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  homeBuyingCosts: async (ctx, groupId) =>
    purge(
      ctx,
      'homeBuyingCosts',
      await ctx.db
        .query('homeBuyingCosts')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  houses: async (ctx, groupId) =>
    purge(
      ctx,
      'houses',
      await ctx.db
        .query('houses')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  recurringCosts: async (ctx, groupId) =>
    purge(
      ctx,
      'recurringCosts',
      await ctx.db
        .query('recurringCosts')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  savingsGoals: async (ctx, groupId) =>
    purge(
      ctx,
      'savingsGoals',
      await ctx.db
        .query('savingsGoals')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  splitScenarios: async (ctx, groupId) =>
    purge(
      ctx,
      'splitScenarios',
      await ctx.db
        .query('splitScenarios')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  holdingTransactions: async (ctx, groupId) =>
    purge(
      ctx,
      'holdingTransactions',
      await ctx.db
        .query('holdingTransactions')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  holdings: async (ctx, groupId) =>
    purge(
      ctx,
      'holdings',
      await ctx.db
        .query('holdings')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  // Retired table; this entry goes with it (see the schema).
  financeSettings: async (ctx, groupId) =>
    purge(
      ctx,
      'financeSettings',
      await ctx.db
        .query('financeSettings')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  netWorthEntries: async (ctx, groupId) =>
    purge(
      ctx,
      'netWorthEntries',
      await ctx.db
        .query('netWorthEntries')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  netWorthSnapshots: async (ctx, groupId) =>
    purge(
      ctx,
      'netWorthSnapshots',
      await ctx.db
        .query('netWorthSnapshots')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  // Last: the memberships are how the Group is reached at all, and clearing
  // them first would make a half-finished cascade unreachable rather than
  // merely unfinished.
  memberships: async (ctx, groupId) =>
    purge(
      ctx,
      'memberships',
      await ctx.db
        .query('memberships')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    ),
}

/**
 * Delete a Group and everything in it, its own image included, and schedule the
 * release of the stored files that lets go of. Already gone is not an error.
 *
 * The caller has already decided this Group may be destroyed. Nothing here
 * checks a membership or a role: it is reachable only from mutations that have.
 */
export async function destroyGroup(
  ctx: MutationCtx,
  groupId: Id<'groups'>,
): Promise<void> {
  const group = await ctx.db.get(groupId)
  if (!group) return

  const files = group.imageId ? [group.imageId] : []
  for (const table of Object.keys(GROUP_CONTENT) as GroupScopedTable[]) {
    files.push(...(await GROUP_CONTENT[table](ctx, groupId)))
  }

  // A recipe living in another Group may have been Shared into this one. It is
  // not ours to delete — only the sharing is. There is no index on
  // `sharedGroupIds`, and this is the one scan the cascade cannot avoid.
  const shared = await ctx.db.query('recipes').collect()
  for (const recipe of shared) {
    if (!recipe.sharedGroupIds?.includes(groupId)) continue
    await ctx.db.patch(recipe._id, {
      sharedGroupIds: recipe.sharedGroupIds.filter((id) => id !== groupId),
    })
  }

  // Somebody whose default Group this was would otherwise open the app onto a
  // Group that is not there.
  const users = await ctx.db.query('users').collect()
  for (const user of users) {
    if (user.defaultGroupId === groupId) {
      await ctx.db.patch(user._id, { defaultGroupId: undefined })
    }
  }

  await ctx.db.delete(groupId)
  if (files.length) {
    await ctx.scheduler.runAfter(0, internal.cascade.releaseFiles, {
      storageIds: files,
    })
  }
}

/**
 * Take a departing member out of the two places a Group stores them as more
 * than a byline.
 *
 * A **cost split** is refused on save unless it adds to a hundred and names
 * only current members (`recurringCosts.validateSplit`), so a split with one
 * party missing is not a split the household could ever have agreed to, and it
 * is not this function's business to invent a new one. It is cleared, and the
 * cost goes back to being undivided until somebody says how it should be.
 *
 * A **saved split scenario** is the opposite: it is immutable on purpose and
 * already stores each party's name beside their id precisely so it keeps
 * reading after somebody leaves. So only the id goes.
 */
export async function detachFromGroup(
  ctx: MutationCtx,
  userId: Id<'users'>,
  groupId: Id<'groups'>,
) {
  const costs = await ctx.db
    .query('recurringCosts')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .collect()
  for (const cost of costs) {
    if (!cost.split?.some((share) => share.userId === userId)) continue
    await ctx.db.patch(cost._id, { split: undefined })
  }

  const scenarios = await ctx.db
    .query('splitScenarios')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .collect()
  for (const scenario of scenarios) {
    const anonymise = <P extends { userId?: Id<'users'>; name: string }>(
      party: P,
    ): P => (party.userId === userId ? { ...party, userId: undefined } : party)
    const names = [
      ...scenario.payments.map((p) => p.party),
      ...scenario.participants,
      ...scenario.owed.map((o) => o.party),
      ...scenario.transfers.flatMap((t) => [t.from, t.to]),
    ]
    if (!names.some((party) => party.userId === userId)) continue
    await ctx.db.patch(scenario._id, {
      payments: scenario.payments.map((p) => ({
        ...p,
        party: anonymise(p.party),
      })),
      participants: scenario.participants.map(anonymise),
      owed: scenario.owed.map((o) => ({ ...o, party: anonymise(o.party) })),
      transfers: scenario.transfers.map((t) => ({
        ...t,
        from: anonymise(t.from),
        to: anonymise(t.to),
      })),
    })
  }
}
