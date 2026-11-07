import type { WithoutSystemFields } from 'convex/server'
import { v } from 'convex/values'
import type { Doc, Id, TableNames } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { internalMutation, internalQuery } from './_generated/server'
import { foodSearchText } from './lib/foodSearchText'
import { pickCanonicalUser } from './lib/sharing'
import { stableDigest } from './lib/stableDigest'
import schema from './schema'

/**
 * Cleanup for `users` documents carrying fields the schema does not name, which
 * fail schema validation and block `convex dev`/deploy from pushing any new
 * functions. Everything the schema names survives, whatever it is added next.
 * Safe to re-run — replacing an already-clean document is a no-op.
 */
export const cleanUserDocuments = internalMutation({
  args: {},
  handler: async (ctx) => {
    const fields = Object.keys(schema.tables.users.validator.fields)
    const users = await ctx.db.query('users').collect()
    let cleaned = 0
    for (const user of users) {
      const known = Object.entries(user).filter(([field]) =>
        fields.includes(field),
      )
      await ctx.db.replace(
        user._id,
        Object.fromEntries(known) as WithoutSystemFields<Doc<'users'>>,
      )
      cleaned++
    }
    return { cleaned }
  },
})

/**
 * Removes the former Personal-group marker without creating, deleting, or
 * reparenting anything. Each Group remains the same row, with the same name,
 * members, content and invite code.
 *
 * Run with `{ apply: true }` once in every deployment, verify that
 * `converted` is zero on a second run, then make `groups.isPersonal`
 * disappear from the schema and delete this operation.
 */
export const removePersonalGroupSemantics = internalMutation({
  args: { apply: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const apply = args.apply ?? false
    const groups = await ctx.db.query('groups').collect()
    const legacy = groups.filter((group) => group.isPersonal !== undefined)
    if (apply) {
      for (const group of legacy) {
        await ctx.db.replace(group._id, {
          name: group.name,
          inviteCode: group.inviteCode,
          slug: group.slug,
          icon: group.icon,
          imageId: group.imageId,
          groceryListId: group.groceryListId,
        })
      }
    }
    return { apply, converted: legacy.length }
  },
})

/**
 * Collapse duplicate `users` rows — several rows sharing one `clerkId` — onto
 * the oldest row for that subject.
 *
 * A duplicate row took prod down outright: `getCurrentUser` resolved the viewer
 * with `.unique()`, which throws on a second match, so every viewer-scoped
 * query 500'd rather than just that one account misbehaving.
 * `pickCanonicalUser` now tolerates duplicates, but the account's records stay
 * split across the rows until they are actually merged — that is this.
 *
 * Keeps the *oldest* row, matching `pickCanonicalUser`, so the row this leaves
 * behind is the same one the running app resolves to.
 *
 * Dry run by default — pass `{ apply: true }` to write. Re-running once every
 * clerkId holds a single row is a no-op.
 */
export const mergeDuplicateUsers = internalMutation({
  args: { apply: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const apply = args.apply ?? false
    const users = await ctx.db.query('users').collect()

    const byClerkId = new Map<string, Doc<'users'>[]>()
    for (const user of users) {
      const rows = byClerkId.get(user.clerkId)
      if (rows) rows.push(user)
      else byClerkId.set(user.clerkId, [user])
    }

    const plans = []
    for (const [clerkId, rows] of byClerkId) {
      if (rows.length < 2) continue
      const keep = pickCanonicalUser(rows)
      if (!keep) continue
      const drop = rows.filter((r) => r._id !== keep._id)
      plans.push(await mergeUserInto(ctx, clerkId, keep, drop, apply))
    }

    return { apply, duplicateSubjects: plans.length, plans }
  },
})

/**
 * Give every food the `searchText` the search index now reads.
 *
 * The expand half of expand–contract: `foods.searchText` lands optional, every
 * write path fills it in, and this fills in the rows written before it existed.
 * Until it has run, `foods.search` finds nothing at all on a deployment's older
 * rows — the index has no value to match — so this is not optional housekeeping
 * on the way to brand search, it is what makes search work again.
 *
 * **End condition:** delete this once
 * docs/migrations/0005-food-search-text.md records it as run on dev and prod.
 * `searchText` becoming required in the schema is the same moment.
 *
 * Dry run by default — pass `{ apply: true }` to write. Idempotent: it only
 * writes a row whose stored value differs from the one its name and brand
 * produce, so a second run reports zero.
 */
export const backfillFoodSearchText = internalMutation({
  args: { apply: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const apply = args.apply ?? false
    const foods = await ctx.db.query('foods').collect()

    let updated = 0
    for (const food of foods) {
      const wanted = foodSearchText(food)
      if (food.searchText === wanted) continue
      updated++
      if (apply) await ctx.db.patch(food._id, { searchText: wanted })
    }

    return { apply, foods: foods.length, updated }
  },
})

/**
 * A food as it may still exist on disk: with the single serving the schema no
 * longer describes.
 *
 * The tightening commit removes `servingSize` and `servingLabel`, and
 * TypeScript then knows they cannot be there — so a migration that has to read
 * them says so itself, the way the pre-#17 group fields above do.
 */
type LegacyFood = Doc<'foods'> & {
  servingSize?: number
  servingLabel?: string
}

/**
 * Carry a food's single serving into its servings list, and drop the two
 * fields it lived in.
 *
 * The contract half of #68's expand–contract. Convex rejects a document
 * carrying a field the schema does not describe, so a row still holding
 * `servingSize` would fail the deploy that removes it — which makes this a
 * prerequisite of that deploy rather than tidying afterwards.
 *
 * The conversion is the shim's, moved here as it was deleted: the label the
 * food carried, or its own amount when it carried none. A row that already has
 * a servings list keeps it — the list has always won over the pair.
 *
 * **End condition:** docs/migrations/0006-food-servings.md. The route actually
 * taken there clears the `foods` table from the dashboard instead of running
 * this — which is the only thing that works when the backfill ships inside the
 * very push the legacy rows are blocking. This survives for a deployment whose
 * foods are worth keeping, which needs the branch split into two deploys, and
 * is deleted with that document if no such deployment appears.
 *
 * Dry run by default — pass `{ apply: true }` to write. Idempotent: a row with
 * neither legacy field present is left alone, so a second run reports zero.
 */
export const backfillFoodServings = internalMutation({
  args: { apply: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const apply = args.apply ?? false
    const foods = (await ctx.db.query('foods').collect()) as LegacyFood[]

    let converted = 0
    let stripped = 0
    for (const food of foods) {
      const hasLegacy = 'servingSize' in food || 'servingLabel' in food
      if (!hasLegacy) continue
      stripped++
      const { servingSize, servingLabel, ...rest } = food
      const carried =
        food.servings?.length || servingSize === undefined || !(servingSize > 0)
          ? food.servings
          : [
              {
                label:
                  servingLabel?.trim() || `${servingSize} ${food.baseUnit}`,
                amount: servingSize,
              },
            ]
      if (carried !== food.servings) converted++
      // `replace` rather than `patch`: the point is the fields being gone from
      // the document, and a patch cannot remove what the schema no longer
      // describes.
      if (apply) await ctx.db.replace(food._id, { ...rest, servings: carried })
    }

    return { apply, foods: foods.length, stripped, converted }
  },
})

/**
 * How many events a bounded sample takes, unless the caller says otherwise.
 * Small enough to read side by side in a terminal.
 */
const DEFAULT_SAMPLE_SIZE = 20

/**
 * What the baby log looks like right now, per Group. Reads only — this is the
 * instrument the migration is run *around*, not a step of it.
 *
 * Run it, move a child, run it again, and put the two outputs side by side:
 * the per-Group counts are the only thing allowed to have changed, and every
 * line of the sample must be identical. See
 * docs/records/2026-08-01-migration-0003-baby-log-onto-group-scope.md, which says plainly to stop
 * if it is not.
 *
 * The sample is the *oldest* entries by design. It is the part of the log that
 * cannot be re-entered, it is what a botched move would damage, and it is
 * stable while the app is still in use — a feed logged between the two runs
 * lands at the far end and cannot shift the sampled rows.
 *
 * `data` is compared by digest rather than printed: the payloads are per-type
 * objects whose key order is not guaranteed by anything, and a fingerprint
 * diffs by eye where a wall of JSON does not.
 */
export const verifyBabyLogScope = internalQuery({
  args: { sampleSize: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const sampleSize = args.sampleSize ?? DEFAULT_SAMPLE_SIZE
    const groups = await ctx.db.query('groups').collect()
    const memberships = await ctx.db.query('memberships').collect()
    const babies = await ctx.db.query('babies').collect()
    const events = await ctx.db.query('babyEvents').collect()

    const membersOf = new Map<Id<'groups'>, number>()
    for (const m of memberships) {
      membersOf.set(m.groupId, (membersOf.get(m.groupId) ?? 0) + 1)
    }
    const eventsOf = new Map<Id<'babies'>, number>()
    for (const e of events) {
      eventsOf.set(e.babyId, (eventsOf.get(e.babyId) ?? 0) + 1)
    }
    const babyById = new Map(babies.map((b) => [b._id, b]))

    const perGroup = groups
      .map((group) => {
        const held = babies.filter((b) => b.groupId === group._id)
        return {
          slug: group.slug,
          isPersonal: group.isPersonal,
          members: membersOf.get(group._id) ?? 0,
          babies: held.length,
          babyNames: held.map((b) => b.name).sort(),
          events: held.reduce((n, b) => n + (eventsOf.get(b._id) ?? 0), 0),
        }
      })
      // Sorted by slug so two runs list the Groups in the same order, whatever
      // order the table happened to hand them over in.
      .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))

    const sample = [...events]
      .sort((a, b) => a.timestamp - b.timestamp || (a._id < b._id ? -1 : 1))
      .slice(0, sampleSize)
      .map((e) => ({
        baby: babyById.get(e.babyId)?.name ?? '(no such baby)',
        type: e.type,
        timestamp: e.timestamp,
        loggedBy: e.loggedBy,
        dataDigest: stableDigest(e.data),
      }))

    return {
      totals: {
        groups: groups.length,
        babies: babies.length,
        events: events.length,
        // Every baby is accounted for by its Group, so the per-Group counts
        // sum to the totals — unless an event hangs off a child that no longer
        // exists, which is the one way a row could go missing unnoticed.
        eventsWithoutBaby: events.filter((e) => !babyById.has(e.babyId)).length,
      },
      groups: perGroup,
      sampleSize,
      sample,
    }
  },
})

/** A Group as the move reports it — enough to see whether it is the right one. */
async function groupSummary(ctx: MutationCtx, groupId: Id<'groups'>) {
  const group = await ctx.db.get(groupId)
  if (!group) return null
  const members = await ctx.db
    .query('memberships')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .collect()
  return {
    slug: group.slug,
    name: group.name,
    isPersonal: group.isPersonal,
    members: members.length,
  }
}

/**
 * Move one child to a named Group, carrying their to-do and questions lists.
 *
 * Nothing here is destructive. A baby's events reference the *baby*, not a
 * Group, so the whole log follows the child on one `groupId` patch and not a
 * single event row is read, rewritten or reordered — which is the strongest
 * guarantee available that payloads and timestamps come through unchanged. The
 * two aux `taskLists` move with the child so they do not end up in a Group the
 * child no longer lives in.
 *
 * **Which child belongs in which Group is the operator's call.** `defaultGroupId`
 * meant "the last Group I picked" before #17 and "my Personal group" after it,
 * so a child's current Group may or may not be the household one, and nothing
 * in the data says which was meant. Both the child and the target Group are
 * arguments; this does not guess, and a Personal target is reported rather than
 * assumed to be wrong.
 *
 * Refuses a Group that does not exist, and a Group with no Members — nobody
 * could read the log from there.
 *
 * Dry run by default — pass `{ apply: true }` to write. Idempotent: once the
 * child is in the target Group a second run reports zero work and writes
 * nothing.
 */
export const moveBabyToGroup = internalMutation({
  args: {
    babyId: v.id('babies'),
    toGroupSlug: v.string(),
    apply: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const apply = args.apply ?? false

    const baby = await ctx.db.get(args.babyId)
    if (!baby) throw new Error('No baby has that id')

    const target = await ctx.db
      .query('groups')
      .withIndex('by_slug', (q) => q.eq('slug', args.toGroupSlug))
      .unique()
    if (!target) throw new Error('No group has that slug')

    const to = await groupSummary(ctx, target._id)
    if (!to || to.members === 0) {
      throw new Error('That group has no members — nobody could read the log')
    }
    const from = await groupSummary(ctx, baby.groupId)

    const alreadyInTargetGroup = baby.groupId === target._id
    if (!alreadyInTargetGroup && apply) {
      await ctx.db.patch(baby._id, { groupId: target._id })
    }

    let taskListsMoved = 0
    let taskListsMissing = 0
    for (const field of ['taskListId', 'questionsListId'] as const) {
      const listId = baby[field]
      if (!listId) continue
      const list = await ctx.db.get(listId)
      if (!list) {
        taskListsMissing++
        continue
      }
      if (list.groupId === target._id) continue
      taskListsMoved++
      if (apply) await ctx.db.patch(listId, { groupId: target._id })
    }

    const events = await ctx.db
      .query('babyEvents')
      .withIndex('by_baby', (q) => q.eq('babyId', baby._id))
      .collect()

    return {
      apply,
      baby: { id: baby._id, name: baby.name },
      from,
      to,
      alreadyInTargetGroup,
      babiesMoved: alreadyInTargetGroup ? 0 : 1,
      taskListsMoved,
      taskListsMissing,
      // The log follows the child. Reported so the operator can see how much
      // is riding on the patch, and check it against the verification output.
      eventsCarried: events.length,
      eventsRewritten: 0,
    }
  },
})

/** Whether a stored value holds a user's id anywhere inside it. */
type HoldsUserId<V> = 0 extends 1 & V
  ? never
  : V extends Id<'users'>
    ? true
    : V extends string | number | boolean | null | undefined
      ? never
      : V extends readonly (infer E)[]
        ? HoldsUserId<E>
        : V extends object
          ? HoldsUserId<V[keyof V]>
          : never

type UserColumn<T extends TableNames> = {
  [K in Exclude<keyof Doc<T>, '_id'>]-?: [HoldsUserId<Doc<T>[K]>] extends [
    never,
  ]
    ? never
    : K
}[Exclude<keyof Doc<T>, '_id'>]

type TableHoldingUsers = {
  [T in TableNames]: [UserColumn<T>] extends [never] ? never : T
}[TableNames]

/**
 * Every column that names a user, derived from the data model, so a new one fails
 * `pnpm typecheck` until somebody says how a merge treats it.
 *
 * `repoint` swaps the id wherever it sits in the value. `own rule` is a column
 * with a uniqueness rule a swap would break: one membership per (group, user), one
 * `aiUsage` row per (user, day). `mergeUserInto` handles those itself.
 */
const USER_REFERENCES: {
  [T in TableHoldingUsers]: Record<UserColumn<T>, 'repoint' | 'own rule'>
} = {
  memberships: { userId: 'own rule', calendarPeopleFilter: 'repoint' },
  aiUsage: { userId: 'own rule' },
  recipes: { createdByUserId: 'repoint' },
  tasks: { createdBy: 'repoint' },
  foods: { createdBy: 'repoint' },
  notes: { createdBy: 'repoint', updatedBy: 'repoint' },
  mealEntries: { createdBy: 'repoint' },
  pantryEntries: { createdBy: 'repoint' },
  calendars: { createdBy: 'repoint' },
  calendarEvents: { createdBy: 'repoint', assigneeIds: 'repoint' },
  integrationConnections: { connectedBy: 'repoint' },
  babyEvents: { loggedBy: 'repoint' },
  consumptionEntries: { userId: 'repoint' },
  combos: { userId: 'repoint' },
  houses: { createdByUserId: 'repoint' },
  mortgageCalculations: {
    createdByUserId: 'repoint',
    updatedByUserId: 'repoint',
  },
  homeBuyingCosts: { updatedByUserId: 'repoint' },
  recurringCosts: { createdByUserId: 'repoint', split: 'repoint' },
  savingsGoals: { createdByUserId: 'repoint', updatedByUserId: 'repoint' },
  splitScenarios: {
    createdByUserId: 'repoint',
    payments: 'repoint',
    participants: 'repoint',
    owed: 'repoint',
    transfers: 'repoint',
  },
  holdings: { createdByUserId: 'repoint' },
  holdingTransactions: { createdByUserId: 'repoint' },
  netWorthEntries: { createdByUserId: 'repoint' },
  netWorthSnapshots: { takenByUserId: 'repoint' },
  tastingSubjects: { createdByUserId: 'repoint' },
  tastings: { createdByUserId: 'repoint' },
  seedRuns: { restoreDefaultGroup: 'repoint' },
}

function repointUserIds(
  value: unknown,
  drop: ReadonlySet<string>,
  keep: Id<'users'>,
): unknown {
  if (typeof value === 'string') return drop.has(value) ? keep : value
  if (Array.isArray(value)) {
    const next = value.map((item) => repointUserIds(item, drop, keep))
    // `keep` and a dupe both named in one list are now one person.
    return next.every((item) => typeof item === 'string')
      ? [...new Set(next)]
      : next
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        repointUserIds(inner, drop, keep),
      ]),
    )
  }
  return value
}

/**
 * Repoint every `v.id('users')` reference from `drop` onto `keep`. A reference
 * left on a deleted row is attribution that reads as nobody, a split that no
 * longer adds up, a calendar event assigned to no one.
 *
 * Most of these tables have no index on the user, so this scans them. It is a
 * repair over a household-sized dataset, and scanning beats carrying indexes that
 * nothing in the app itself would ever query.
 */
async function mergeUserInto(
  ctx: MutationCtx,
  clerkId: string,
  keep: Doc<'users'>,
  drop: Doc<'users'>[],
  apply: boolean,
) {
  const repointed: Record<string, number> = {}
  const bump = (table: string) => {
    repointed[table] = (repointed[table] ?? 0) + 1
  }
  let membershipsDropped = 0
  let adoptedDefaultGroup = false
  let defaultGroupId = keep.defaultGroupId

  const keepGroupIds = new Set(
    (
      await ctx.db
        .query('memberships')
        .withIndex('by_user', (q) => q.eq('userId', keep._id))
        .collect()
    ).map((m) => m.groupId),
  )
  const keepUsage = new Map(
    (
      await ctx.db
        .query('aiUsage')
        .withIndex('by_user_and_day', (q) => q.eq('userId', keep._id))
        .collect()
    ).map((row) => [row.day, row]),
  )

  for (const dupe of drop) {
    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', dupe._id))
      .collect()
    for (const m of memberships) {
      // Repointing into a group `keep` already belongs to would leave two rows
      // for one (group, user) pair, and the group would show up twice.
      if (keepGroupIds.has(m.groupId)) {
        membershipsDropped++
        if (apply) await ctx.db.delete(m._id)
        continue
      }
      keepGroupIds.add(m.groupId)
      bump('memberships')
      if (apply) await ctx.db.patch(m._id, { userId: keep._id })
    }

    const usage = await ctx.db
      .query('aiUsage')
      .withIndex('by_user_and_day', (q) => q.eq('userId', dupe._id))
      .collect()
    for (const row of usage) {
      bump('aiUsage')
      const kept = keepUsage.get(row.day)
      if (!kept) {
        keepUsage.set(row.day, { ...row, userId: keep._id })
        if (apply) await ctx.db.patch(row._id, { userId: keep._id })
        continue
      }
      // One person, one budget: the calls add up rather than being forgotten.
      kept.count += row.count
      if (apply) {
        await ctx.db.patch(kept._id, { count: kept.count })
        await ctx.db.delete(row._id)
      }
    }

    // Only fills a gap — a surviving row that already picked a default group
    // keeps it, so the merge never silently moves the user somewhere else.
    if (!defaultGroupId && dupe.defaultGroupId) {
      defaultGroupId = dupe.defaultGroupId
      adoptedDefaultGroup = true
      if (apply) await ctx.db.patch(keep._id, { defaultGroupId })
    }

    if (apply) await ctx.db.delete(dupe._id)
  }

  const dropIds = new Set<string>(drop.map((dupe) => dupe._id))
  for (const table of Object.keys(USER_REFERENCES) as TableHoldingUsers[]) {
    const columns = Object.entries(USER_REFERENCES[table])
      .filter(([, rule]) => rule === 'repoint')
      .map(([column]) => column)
    if (columns.length === 0) continue
    for (const row of await ctx.db.query(table).collect()) {
      const patch: Record<string, unknown> = {}
      for (const column of columns) {
        const before = (row as Record<string, unknown>)[column]
        const after = repointUserIds(before, dropIds, keep._id)
        if (JSON.stringify(before) !== JSON.stringify(after)) {
          patch[column] = after
        }
      }
      if (Object.keys(patch).length === 0) continue
      bump(table)
      if (apply) await ctx.db.patch(row._id as Id<TableHoldingUsers>, patch)
    }
  }

  return {
    clerkId,
    keep: keep._id,
    drop: drop.map((d) => d._id),
    repointed,
    membershipsDropped,
    adoptedDefaultGroup,
    groupIdsAfterMerge: [...keepGroupIds],
  }
}
