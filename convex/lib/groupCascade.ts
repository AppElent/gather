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
 * ## A page per transaction
 *
 * A Group can hold more than one transaction may read or write, so its rows go
 * a page at a time (`purgePage.ts`, APP-842): the first page in the
 * transaction that deletes the Group, the rest in `cascade.purgeGroup` steps.
 * Nothing reaches the rest meanwhile, because every way to Group content
 * resolves its Group or a membership first.
 *
 * ## Blobs come back rather than going here
 *
 * `deleteStoredFile` asks whether any row in any photo-holding table still
 * points at a blob, so it costs a scan of each of them per photo. So the
 * storage ids travel along with the steps and are released by scheduled work
 * after the last one, when that scan no longer reads this Group's rows.
 */

import { internal } from '../_generated/api'
import type { Doc, Id, TableNames } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import type { GroupScopedTable } from './groupAccess'
import { cancelJob } from './notifications'
import { charge, drain, newPurgePage, type PurgePage, pauseMs } from './purgePage'
import { storedFileIdsOf } from './storedFiles'
import { unassignFromGroup } from './taskAssignee'
import { cancelSend, dropMemberReminders } from './taskReminders'
import { purgeCompletionsOfTask } from './taskRepeat'
import { deleteWatchDevices } from './watchDevices'

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
  // A watch on this list goes back to the Group's own grocery list.
  const watches = await ctx.db
    .query('watchDevices')
    .withIndex('by_group', (q) => q.eq('groupId', list.groupId))
    .collect()
  for (const watch of watches)
    if (watch.groceryListId === listId)
      await ctx.db.patch(watch._id, { groceryListId: undefined })
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
 * How each group-scoped table's rows are reached and removed. An entry answers
 * whether its table is empty now; false stops the step, because the page is
 * spent.
 *
 * Declaration order is deletion order. What gives access goes first. The rest
 * is containment: a parent's entry clears its children before removing the
 * parent, because the parent rows are the only way to find them.
 *
 * `scheduledNotifications` has its Group inside its payload, so it is listed
 * by hand.
 */
const GROUP_CONTENT: {
  [T in GroupScopedTable | 'scheduledNotifications']: (
    ctx: MutationCtx,
    groupId: Id<'groups'>,
    page: PurgePage,
  ) => Promise<boolean>
} = {
  // Credentials first: each is a key or a token, and nobody can revoke it in the
  // app any more.
  watchDevices: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'watchDevices',
      ctx.db
        .query('watchDevices')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  integrationConnections: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'integrationConnections',
      ctx.db
        .query('integrationConnections')
        .withIndex('by_group_provider', (q) => q.eq('groupId', groupId)),
    ),

  energySources: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'energySources',
      ctx.db
        .query('energySources')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  // A feed's account prices carry no Group id and are some 35,000 rows a year:
  // they are found through the feed's id and deleted a page at a time by
  // `cascade.purgeAccountPrices`. Nothing writes new ones meanwhile, because a
  // fetch checks that its feed still exists. Market prices (no `feedId`) are
  // every Group's and stay.
  energyPriceFeeds: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'energyPriceFeeds',
      ctx.db
        .query('energyPriceFeeds')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
      async (feed) => {
        await ctx.scheduler.runAfter(0, internal.cascade.purgeAccountPrices, {
          feedId: feed._id,
        })
        return true
      },
    ),

  // Somebody whose default Group this was would otherwise open the app onto a
  // Group that is not there.
  memberships: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'memberships',
      ctx.db
        .query('memberships')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
      async (membership) => {
        const user = await ctx.db.get(membership.userId)
        if (!user) return true
        charge(page, user)
        if (user.defaultGroupId === groupId)
          await ctx.db.patch(user._id, { defaultGroupId: undefined })
        return true
      },
    ),

  // Whatever is still queued for the Group would send nothing, but its row and
  // job would outlive the Group until their time.
  scheduledNotifications: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'scheduledNotifications',
      ctx.db
        .query('scheduledNotifications')
        .withIndex('by_group', (q) => q.eq('payload.groupId', groupId)),
      async (send) => {
        await cancelJob(ctx, send.jobId)
        return true
      },
    ),

  groceryCategoryOverrides: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'groceryCategoryOverrides',
      ctx.db
        .query('groceryCategoryOverrides')
        .withIndex('by_group_and_name', (q) => q.eq('groupId', groupId)),
    ),

  groceryAiGroupUsage: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'groceryAiGroupUsage',
      ctx.db
        .query('groceryAiGroupUsage')
        .withIndex('by_group_and_day', (q) => q.eq('groupId', groupId)),
    ),

  // Ahead of the tasks: by the Group they need no walk over them.
  taskCompletions: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'taskCompletions',
      ctx.db
        .query('taskCompletions')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  taskLists: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'taskLists',
      ctx.db
        .query('taskLists')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
      (list) =>
        drain(
          ctx,
          page,
          'tasks',
          ctx.db
            .query('tasks')
            .withIndex('by_list', (q) => q.eq('listId', list._id)),
          async (task) => {
            await cancelSend(ctx, task)
            return true
          },
        ),
    ),

  babies: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'babies',
      ctx.db
        .query('babies')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
      (baby) =>
        drain(
          ctx,
          page,
          'babyEvents',
          ctx.db
            .query('babyEvents')
            .withIndex('by_baby', (q) => q.eq('babyId', baby._id)),
        ),
    ),

  calendars: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'calendars',
      ctx.db
        .query('calendars')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
      (calendar) =>
        drain(
          ctx,
          page,
          'calendarEvents',
          ctx.db
            .query('calendarEvents')
            .withIndex('by_calendar', (q) => q.eq('calendarId', calendar._id)),
        ),
    ),

  recipes: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'recipes',
      ctx.db
        .query('recipes')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
      (recipe) =>
        drain(
          ctx,
          page,
          'recipeShares',
          ctx.db
            .query('recipeShares')
            .withIndex('by_recipe_group', (q) => q.eq('recipeId', recipe._id)),
        ),
    ),

  // Shares *into* this Group of recipes living elsewhere. A recipe is not ours
  // to delete, only the sharing is.
  recipeShares: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'recipeShares',
      ctx.db
        .query('recipeShares')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
      async (share) => {
        const recipe = await ctx.db.get(share.recipeId)
        if (!recipe) return true
        charge(page, recipe)
        if (recipe.sharedGroupIds.includes(groupId))
          await ctx.db.patch(recipe._id, {
            sharedGroupIds: recipe.sharedGroupIds.filter((id) => id !== groupId),
          })
        return true
      },
    ),

  notes: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'notes',
      ctx.db
        .query('notes')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  mealEntries: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'mealEntries',
      ctx.db
        .query('mealEntries')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  plannedDinners: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'plannedDinners',
      ctx.db
        .query('plannedDinners')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  mealPreferences: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'mealPreferences',
      ctx.db
        .query('mealPreferences')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  mealPlanDrafts: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'mealPlanDrafts',
      ctx.db
        .query('mealPlanDrafts')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  pantryEntries: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'pantryEntries',
      ctx.db
        .query('pantryEntries')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  groceryStaples: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'groceryStaples',
      ctx.db
        .query('groceryStaples')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  tastings: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'tastings',
      ctx.db
        .query('tastings')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  loyaltyCards: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'loyaltyCards',
      ctx.db
        .query('loyaltyCards')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  tastingSubjects: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'tastingSubjects',
      ctx.db
        .query('tastingSubjects')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  loanParts: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'loanParts',
      ctx.db
        .query('loanParts')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  mortgageCalculations: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'mortgageCalculations',
      ctx.db
        .query('mortgageCalculations')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  homeBuyingCosts: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'homeBuyingCosts',
      ctx.db
        .query('homeBuyingCosts')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  // Energy (APP-491). These two can be tens of thousands of rows:
  // `cascade.purgeEnergyRows` deletes them, from `destroyGroup` on. Nothing
  // writes new ones meanwhile, because a sync checks that its source and
  // channel still exist.
  energyReadings: async () => true,

  energyIntervals: async () => true,

  energyChannels: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'energyChannels',
      ctx.db
        .query('energyChannels')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  energyAssets: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'energyAssets',
      ctx.db
        .query('energyAssets')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  energyContracts: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'energyContracts',
      ctx.db
        .query('energyContracts')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  energySites: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'energySites',
      ctx.db
        .query('energySites')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  houses: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'houses',
      ctx.db
        .query('houses')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  recurringCosts: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'recurringCosts',
      ctx.db
        .query('recurringCosts')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  savingsGoals: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'savingsGoals',
      ctx.db
        .query('savingsGoals')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  splitScenarios: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'splitScenarios',
      ctx.db
        .query('splitScenarios')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  holdingTransactions: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'holdingTransactions',
      ctx.db
        .query('holdingTransactions')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  holdings: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'holdings',
      ctx.db
        .query('holdings')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  // Retired table; this entry goes with it (see the schema).
  financeSettings: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'financeSettings',
      ctx.db
        .query('financeSettings')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  netWorthEntries: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'netWorthEntries',
      ctx.db
        .query('netWorthEntries')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),

  netWorthSnapshots: (ctx, groupId, page) =>
    drain(
      ctx,
      page,
      'netWorthSnapshots',
      ctx.db
        .query('netWorthSnapshots')
        .withIndex('by_group', (q) => q.eq('groupId', groupId)),
    ),
}

/**
 * The most stored files a step carries to the next: half of what an argument
 * array may hold, and a page frees at most two per row.
 */
const MAX_HELD_FILES = 4000

/**
 * Delete a page of a destroyed Group's rows and schedule the next while any
 * are left, or the release of the stored files they held when none are.
 */
export async function purgeGroupPage(
  ctx: MutationCtx,
  groupId: Id<'groups'>,
  heldFiles: Id<'_storage'>[],
): Promise<void> {
  const page = newPurgePage()
  let empty = true
  for (const purgeTable of Object.values(GROUP_CONTENT)) {
    empty = await purgeTable(ctx, groupId, page)
    if (!empty) break
  }

  let storageIds = [...heldFiles, ...page.files]
  if (storageIds.length > 0 && (empty || storageIds.length > MAX_HELD_FILES)) {
    await ctx.scheduler.runAfter(0, internal.cascade.releaseFiles, {
      storageIds,
    })
    storageIds = []
  }
  if (!empty) {
    await ctx.scheduler.runAfter(
      pauseMs(page),
      internal.cascade.purgeGroup,
      { groupId, storageIds },
    )
  }
}

/**
 * Delete a Group and everything in it, its own image included, and schedule the
 * release of the stored files that lets go of. Already gone is not an error.
 *
 * The Group itself and a first page of its rows go here, the rest in steps
 * after it.
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

  await ctx.db.delete(groupId)
  for (const table of ['energyReadings', 'energyIntervals'] as const) {
    await ctx.scheduler.runAfter(0, internal.cascade.purgeEnergyRows, {
      groupId,
      table,
    })
  }
  await purgeGroupPage(ctx, groupId, group.imageId ? [group.imageId] : [])
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
 * A **staple** they added after its maker did (`keptBy`, APP-681) drops them;
 * the staple stays.
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
  await deleteWatchDevices(
    ctx,
    userId,
    (device) => device.groupId === groupId,
  )

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

  const staples = await ctx.db
    .query('groceryStaples')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .collect()
  for (const staple of staples) {
    if (!staple.keptBy?.includes(userId)) continue
    await ctx.db.patch(staple._id, {
      keptBy: staple.keptBy.filter((id) => id !== userId),
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
