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
import { cancelGroupSends } from './notifications'
import { dropRecipeShares, setSharedGroups } from './recipeShares'
import { storedFileIdsOf } from './storedFiles'
import { unassignFromGroup } from './taskAssignee'
import { cancelSend, dropMemberReminders } from './taskReminders'
import { purgeCompletionsOfTask } from './taskRepeat'

/** Delete these rows, handing back the stored files they were holding. */
async function purge<T extends TableNames>(
  ctx: MutationCtx,
  table: T,
  rows: Doc<T>[],
): Promise<Id<'_storage'>[]> {
  const files: Id<'_storage'>[] = []
  for (const row of rows) {
    files.push(...storedFileIdsOf(table, row))
    await ctx.db.delete(row._id)
  }
  return files
}

/**
 * Delete a list's tasks: the only way to find them is through the list. A
 * task's queued reminder is withdrawn with it (APP-305), and its completion
 * history goes too (APP-303).
 */
export async function purgeTasksOfList(
  ctx: MutationCtx,
  listId: Id<'taskLists'>,
) {
  const tasks = await ctx.db
    .query('tasks')
    .withIndex('by_list', (q) => q.eq('listId', listId))
    .collect()
  for (const task of tasks) {
    await cancelSend(ctx, task)
    await purgeCompletionsOfTask(ctx, task._id)
  }
  await purge(ctx, 'tasks', tasks)
}

/**
 * Delete one list, its tasks, and every pointer at it: the Group's grocery
 * list (moved to its next grocery list, if any) and a child's to-do and
 * questions cards. Both are set through `requireInGroup`, so they live in the
 * list's own Group. A card that lost its list also loses `…Chosen`, so the
 * list `babies.ensureAuxLists` gives it next dies with the child.
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
    // A Group with several grocery lists (APP-313) points installed phones at
    // the next one, so they open a list rather than the picker.
    const next = (
      await ctx.db
        .query('taskLists')
        .withIndex('by_group', (q) => q.eq('groupId', group._id))
        .collect()
    )
      .filter((other) => other.kind === 'groceries' && other.provider === 'local')
      .sort((a, b) => a.order - b.order)[0]
    await ctx.db.patch(group._id, { groceryListId: next?._id })
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

  groceryCategoryOverrides: async (ctx, groupId) =>
    purge(
      ctx,
      'groceryCategoryOverrides',
      await ctx.db
        .query('groceryCategoryOverrides')
        .withIndex('by_group_and_name', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  groceryAiGroupUsage: async (ctx, groupId) =>
    purge(
      ctx,
      'groceryAiGroupUsage',
      await ctx.db
        .query('groceryAiGroupUsage')
        .withIndex('by_group_and_day', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  // Also deleted with each task; this catches any whose task went first.
  taskCompletions: async (ctx, groupId) =>
    purge(
      ctx,
      'taskCompletions',
      await ctx.db
        .query('taskCompletions')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
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

  recipes: async (ctx, groupId) => {
    const recipes = await ctx.db
      .query('recipes')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect()
    for (const recipe of recipes) await dropRecipeShares(ctx, recipe._id)
    return purge(ctx, 'recipes', recipes)
  },

  // Shares *into* this Group of recipes living elsewhere. The recipes stay;
  // `destroyGroup` takes this Group out of their `sharedGroupIds`.
  recipeShares: async (ctx, groupId) =>
    purge(
      ctx,
      'recipeShares',
      await ctx.db
        .query('recipeShares')
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

  mealPreferences: async (ctx, groupId) =>
    purge(
      ctx,
      'mealPreferences',
      await ctx.db
        .query('mealPreferences')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  mealPlanDrafts: async (ctx, groupId) =>
    purge(
      ctx,
      'mealPlanDrafts',
      await ctx.db
        .query('mealPlanDrafts')
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

  groceryStaples: async (ctx, groupId) =>
    purge(
      ctx,
      'groceryStaples',
      await ctx.db
        .query('groceryStaples')
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

  loyaltyCards: async (ctx, groupId) =>
    purge(
      ctx,
      'loyaltyCards',
      await ctx.db
        .query('loyaltyCards')
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

  // Energy (APP-491), children before the sites they hang off. Every table
  // has `by_group`, so no entry needs its parent to find its rows.
  // Too many rows for this transaction: deleted a page at a time by
  // `cascade.purgeEnergyRows`. Nothing writes new ones meanwhile, because a
  // sync checks that its source and channel still exist.
  energyReadings: async (ctx, groupId) => {
    await ctx.scheduler.runAfter(0, internal.cascade.purgeEnergyRows, {
      groupId,
      table: 'energyReadings',
    })
    return []
  },
  energyIntervals: async (ctx, groupId) => {
    await ctx.scheduler.runAfter(0, internal.cascade.purgeEnergyRows, {
      groupId,
      table: 'energyIntervals',
    })
    return []
  },
  energyChannels: async (ctx, groupId) =>
    purge(
      ctx,
      'energyChannels',
      await ctx.db
        .query('energyChannels')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  // A source can hold a live token for somebody's Home Assistant.
  energySources: async (ctx, groupId) =>
    purge(
      ctx,
      'energySources',
      await ctx.db
        .query('energySources')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  energyAssets: async (ctx, groupId) =>
    purge(
      ctx,
      'energyAssets',
      await ctx.db
        .query('energyAssets')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  energyContracts: async (ctx, groupId) =>
    purge(
      ctx,
      'energyContracts',
      await ctx.db
        .query('energyContracts')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    ),

  // A feed holds the Member's own API key, so the feed goes at once. Its
  // account prices carry no Group id and are some 35,000 rows a year: they are
  // found through the feed's id and deleted a page at a time by
  // `cascade.purgeAccountPrices`. Nothing writes new ones meanwhile, because a
  // fetch checks that its feed still exists. Market prices (no `feedId`) are
  // every Group's and stay.
  energyPriceFeeds: async (ctx, groupId) => {
    const feeds = await ctx.db
      .query('energyPriceFeeds')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect()
    for (const feed of feeds) {
      await ctx.scheduler.runAfter(0, internal.cascade.purgeAccountPrices, {
        feedId: feed._id,
      })
    }
    return purge(ctx, 'energyPriceFeeds', feeds)
  },

  energySites: async (ctx, groupId) =>
    purge(
      ctx,
      'energySites',
      await ctx.db
        .query('energySites')
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
  // not ours to delete — only the sharing is. `recipeShares` indexes this, but
  // only once `maintenance:backfillRecipeShares` has run everywhere; until then
  // `sharedGroupIds` is scanned (docs/migrations/README.md).
  const shared = await ctx.db.query('recipes').collect()
  for (const recipe of shared) {
    if (!recipe.sharedGroupIds?.includes(groupId)) continue
    await setSharedGroups(ctx, recipe._id, {
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

  // Whatever is still queued for the Group (an event's reminder, a task's
  // the cascade did not reach) would send nothing, but its row and job would
  // outlive the Group until their time.
  await cancelGroupSends(ctx, groupId)

  await ctx.db.delete(groupId)
  if (files.length) {
    await ctx.scheduler.runAfter(0, internal.cascade.releaseFiles, {
      storageIds: files,
    })
  }
}

/**
 * Take a departing member out of the places a Group stores them as more
 * than a byline.
 *
 * A **cost split** is refused on save unless it adds to a hundred and names
 * only current members (`recurringCosts.validateSplit`), so a split with one
 * party missing is not a split the household could ever have agreed to, and it
 * is not this function's business to invent a new one. It is cleared, and the
 * cost goes back to being undivided until somebody says how it should be.
 *
 * A **meal-preference default** for them is dropped: it was about a Member.
 *
 * A **saved split scenario** is the opposite: it is immutable on purpose and
 * already stores each party's name beside their id precisely so it keeps
 * reading after somebody leaves. So only the id goes.
 *
 * A **Planned meal's eaters** drop the person; the meal stays.
 *
 * A **task** they were responsible for goes back to nobody (APP-302), with
 * any notice they had not opened.
 *
 * A **task reminder** for them goes, with its queued send (APP-305).
 *
 * A **calendar event** on one of the Group's calendars drops them from its
 * assignees; the event stays, and its `revision` moves so an open editor
 * still holding the old list gets a conflict rather than writing it back
 * (APP-407).
 */
export async function detachFromGroup(
  ctx: MutationCtx,
  userId: Id<'users'>,
  groupId: Id<'groups'>,
) {
  await dropMemberReminders(ctx, userId, groupId)

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

  // Who eats along with a Planned meal names Members; a former one leaves it.
  const meals = await ctx.db
    .query('plannedDinners')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .collect()
  for (const meal of meals) {
    if (!meal.eaterIds?.includes(userId)) continue
    await ctx.db.patch(meal._id, {
      eaterIds: meal.eaterIds.filter((id) => id !== userId),
    })
  }

  // A meal-preference default speaks of a Member; somebody who left has none.
  const preferences = await ctx.db
    .query('mealPreferences')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .unique()
  if (preferences?.memberDefaults?.some((entry) => entry.userId === userId)) {
    await ctx.db.patch(preferences._id, {
      memberDefaults: preferences.memberDefaults.filter(
        (entry) => entry.userId !== userId,
      ),
    })
  }
  await unassignFromGroup(ctx, userId, groupId)

  // Events hang off a calendar, so the Group's calendars are the way in.
  const calendars = await ctx.db
    .query('calendars')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .collect()
  for (const calendar of calendars) {
    const events = await ctx.db
      .query('calendarEvents')
      .withIndex('by_calendar', (q) => q.eq('calendarId', calendar._id))
      .collect()
    for (const event of events) {
      if (!event.assigneeIds?.includes(userId)) continue
      await ctx.db.patch(event._id, {
        assigneeIds: event.assigneeIds.filter((id) => id !== userId),
        revision: (event.revision ?? 0) + 1,
      })
    }
  }
}
