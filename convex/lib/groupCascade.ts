/**
 * Emptying a Group of everything it contains.
 *
 * Deleting a Group used to delete two rows — the membership and the Group —
 * and leave every recipe, task list, baby, calendar, house, holding and
 * tasting subject in it as rows nothing can reach, with their photos leaked in
 * storage. Nothing surfaced it, because unreachable rows read exactly like
 * rows that are not there. The seed's own reset says why that is the worse
 * failure (`lib/seed/apply.ts`: invisible garbage is worse than deletion), and
 * account deletion is what finally needed the cascade to exist.
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
 * the parent's rows are still there to be enumerated from. `comboItems` hangs
 * off a combo, which is a person's and not a Group's, and belongs to the
 * account purge instead.
 *
 * ## Blobs come back rather than going here
 *
 * `deleteStoredFile` asks whether any row in any of five tables still points
 * at a blob, so it costs five table scans per photo. A Group with fifty photos
 * would spend two hundred and fifty scans inside one transaction. So the
 * storage ids are *returned*, and the caller schedules them — which is also
 * what makes the whole thing survive a Group larger than one transaction.
 */

import type { Doc, Id, TableNames } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { storedFileIdOf } from './storedFiles'

/**
 * Every table whose rows belong to a Group.
 *
 * Assignability runs row → shape: a table without the column simply does not
 * extend it, which is what makes the union exactly the group-scoped tables.
 */
type GroupScopedTable = {
  [T in TableNames]: Doc<T> extends { groupId: Id<'groups'> } ? T : never
}[TableNames]

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
    for (const list of lists) {
      await purge(
        ctx,
        'tasks',
        await ctx.db
          .query('tasks')
          .withIndex('by_list', (q) => q.eq('listId', list._id))
          .collect(),
      )
    }
    return purge(ctx, 'taskLists', lists)
  },

  babies: async (ctx, groupId) => {
    const babies = await ctx.db
      .query('babies')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect()
    const files: Id<'_storage'>[] = []
    for (const baby of babies) {
      files.push(
        ...(await purge(
          ctx,
          'babyEvents',
          await ctx.db
            .query('babyEvents')
            .withIndex('by_baby', (q) => q.eq('babyId', baby._id))
            .collect(),
        )),
      )
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
      await purge(
        ctx,
        'calendarEvents',
        await ctx.db
          .query('calendarEvents')
          .withIndex('by_calendar', (q) => q.eq('calendarId', calendar._id))
          .collect(),
      )
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
 * Delete a Group and everything in it, returning the stored files it released.
 *
 * The caller schedules those — see the note at the top of this file — and is
 * also the one that has already decided this Group may be destroyed. Nothing
 * here checks a membership or a role: it is reachable only from mutations that
 * have.
 */
export async function deleteGroupContent(
  ctx: MutationCtx,
  groupId: Id<'groups'>,
): Promise<Id<'_storage'>[]> {
  const files: Id<'_storage'>[] = []
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
  return files
}
