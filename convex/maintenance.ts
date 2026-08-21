import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { internalMutation, internalQuery } from './_generated/server'
import { foodSearchText } from './lib/foodSearchText'
import { allocateGroupSlug } from './lib/groupSlugs'
import { pickCanonicalUser } from './lib/sharing'
import { stableDigest } from './lib/stableDigest'
import { createPersonalGroup } from './users'

/**
 * One-off cleanup for `users` documents carrying stray fields left over from
 * removed experiments (e.g. `nutritionTargets`), which fail schema
 * validation and block `convex dev`/deploy from pushing any new functions.
 * Safe to re-run — replacing an already-clean document is a no-op.
 */
export const cleanUserDocuments = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').collect()
    let cleaned = 0
    for (const user of users) {
      const { clerkId, name, email, imageUrl, defaultGroupId } = user
      await ctx.db.replace(user._id, {
        clerkId,
        name,
        email,
        imageUrl,
        defaultGroupId,
      })
      cleaned++
    }
    return { cleaned }
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
 * Rows written before this migration are shaped differently from the ones the
 * schema now describes, and once the schema is tightened TypeScript knows the
 * fields cannot be missing. These read a document as it may actually exist on
 * disk, which is the only honest way for a migration to ask.
 */
function currentSlug(group: { slug?: string }): string {
  return group.slug ?? ''
}
function missingIsPersonal(group: { isPersonal?: boolean }): boolean {
  return group.isPersonal === undefined
}
function hasLegacyOwnerRole(membership: { role: string }): boolean {
  return membership.role === 'owner'
}
/**
 * `groups.type` is dropped by the tightening commit, and Convex rejects a
 * document carrying a field the schema does not describe — so a row still
 * holding it would fail that deploy's schema validation, exactly as the stray
 * fields `cleanUserDocuments` was written for did.
 */
function hasDroppedTypeField(group: object): boolean {
  return 'type' in group
}

/**
 * Give every Group a slug and an `isPersonal` marker, give every person the
 * Personal group they are now guaranteed to have, rename the old `owner` role
 * to `admin`, and drop the `type` field `isPersonal` replaces.
 *
 * The expand half of expand–contract: `groups.slug`, `groups.isPersonal` and
 * the `admin` role land optional/widened, this fills them in, and only then can
 * the schema require them. See
 * docs/migrations/0001-group-slugs-and-personal-groups.md.
 *
 * Dry run by default — pass `{ apply: true }` to write. Idempotent: a second
 * run finds nothing to do and reports zeroes, because every decision it makes
 * is conditioned on the field still being absent.
 */
export const backfillGroupSlugsAndPersonalGroups = internalMutation({
  args: { apply: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const apply = args.apply ?? false
    const groups = await ctx.db.query('groups').collect()
    const users = await ctx.db.query('users').collect()
    const memberships = await ctx.db.query('memberships').collect()

    // Slugs already spoken for. A dry run writes nothing, so without this every
    // Group would be offered the same free candidate and the summary would
    // promise slugs that collide the moment they were applied.
    const taken = new Set<string>()
    for (const group of groups) {
      if (group.slug) taken.add(group.slug)
    }

    const membersOf = new Map<Id<'groups'>, Id<'users'>[]>()
    const groupsOf = new Map<Id<'users'>, Id<'groups'>[]>()
    for (const m of memberships) {
      membersOf.set(m.groupId, [...(membersOf.get(m.groupId) ?? []), m.userId])
      groupsOf.set(m.userId, [...(groupsOf.get(m.userId) ?? []), m.groupId])
    }
    const userById = new Map(users.map((u) => [u._id, u]))

    let rolesMigrated = 0
    for (const m of memberships) {
      if (!hasLegacyOwnerRole(m)) continue
      rolesMigrated++
      if (apply) await ctx.db.patch(m._id, { role: 'admin' })
    }

    const personalGroupIds = new Set<Id<'groups'>>()
    let groupsMarkedPersonal = 0
    let groupsMarkedShared = 0
    let slugsAssigned = 0
    let droppedTypeFields = 0
    for (const group of groups) {
      const members = membersOf.get(group._id) ?? []
      const soleMemberId = members.length === 1 ? members[0] : undefined
      const soleMember = soleMemberId ? userById.get(soleMemberId) : undefined

      // A Group is the Personal one exactly when it has a single Member and
      // that Member's `defaultGroupId` points at it — which describes the
      // `Home` group signup used to create, and nothing else.
      const undecided = missingIsPersonal(group)
      const isPersonal = undecided
        ? soleMember?.defaultGroupId === group._id
        : group.isPersonal === true
      if (undecided) {
        if (isPersonal) groupsMarkedPersonal++
        else groupsMarkedShared++
      }
      if (isPersonal) personalGroupIds.add(group._id)

      let slug = currentSlug(group)
      if (!slug) {
        // A Personal group's slug reads better from the person than from the
        // group's name, which for every backfilled one is the literal "Home".
        const from = (isPersonal ? soleMember?.name : undefined) ?? group.name
        slug = await allocateGroupSlug(ctx, { name: from, isPersonal, taken })
        slugsAssigned++
      }

      const stray = hasDroppedTypeField(group)
      if (stray) droppedTypeFields++
      if (!undecided && !stray && slug === currentSlug(group)) continue
      // `replace` rather than `patch`, because dropping a field is the point.
      if (apply) {
        await ctx.db.replace(group._id, {
          name: group.name,
          inviteCode: group.inviteCode,
          slug,
          isPersonal,
        })
      }
    }

    let personalGroupsCreated = 0
    let defaultGroupsRepointed = 0
    for (const user of users) {
      const existing = (groupsOf.get(user._id) ?? []).find((id) =>
        personalGroupIds.has(id),
      )
      if (existing) {
        // `defaultGroupId` means "my Personal group" now, not "the last Group I
        // picked", so anyone who had pointed it elsewhere is moved back.
        if (user.defaultGroupId === existing) continue
        defaultGroupsRepointed++
        if (apply) await ctx.db.patch(user._id, { defaultGroupId: existing })
        continue
      }
      personalGroupsCreated++
      const slug = await allocateGroupSlug(ctx, {
        name: user.name,
        isPersonal: true,
        taken,
      })
      if (apply) await createPersonalGroup(ctx, user, slug)
    }

    return {
      apply,
      rolesMigrated,
      groupsMarkedPersonal,
      groupsMarkedShared,
      slugsAssigned,
      droppedTypeFields,
      personalGroupsCreated,
      defaultGroupsRepointed,
    }
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
 * Delete every recipe, and clear the references that leaves dangling.
 *
 * #19 gives a recipe to a Group rather than to a person, and says so in fields
 * that are required from the first commit — so there is no shape a pre-#19 row
 * can be migrated into. Recipe data is disposable, so it is destroyed rather
 * than migrated; see docs/migrations/0002-recipes-become-group-owned.md, which
 * says that plainly and is the reason this is acceptable.
 *
 * A diary entry is *not* disposable and nothing about it is touched beyond its
 * `recipeId`. What it recorded — the label, the quantity, the nutrition — is a
 * snapshot, and a snapshot does not change because the thing it was taken from
 * is gone (ADR-0003). Only the provenance reference is cleared, and provenance
 * was already allowed to dangle.
 *
 * Dry run by default — pass `{ apply: true }` to write. Idempotent: a second
 * run finds no recipes and no references left to clear, and reports zeroes.
 */
export const wipeRecipes = internalMutation({
  args: { apply: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const apply = args.apply ?? false

    const recipes = await ctx.db.query('recipes').collect()
    if (apply) {
      for (const recipe of recipes) await ctx.db.delete(recipe._id)
    }

    const entries = await ctx.db.query('consumptionEntries').collect()
    const linked = entries.filter((e) => e.recipeId !== undefined)
    if (apply) {
      // The reference and only the reference — `patch` rather than `replace`,
      // so there is no way for this to reach the snapshot by accident.
      for (const entry of linked) {
        await ctx.db.patch(entry._id, { recipeId: undefined })
      }
    }

    return {
      apply,
      recipesDeleted: recipes.length,
      entriesUnlinked: linked.length,
    }
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
 * docs/migrations/0003-baby-log-onto-group-scope.md, which says plainly to stop
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

/** Repoint every `v.id('users')` reference from `drop` onto `keep`. */
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

  // `recipes`, `tasks`, `foods`, `integrationConnections` and `babyEvents`
  // carry a user reference but no index on it. This is a one-off repair over a
  // household-sized dataset, so scanning beats carrying five indexes that
  // nothing in the app itself would ever query.
  const recipes = await ctx.db.query('recipes').collect()
  const tasks = await ctx.db.query('tasks').collect()
  const foods = await ctx.db.query('foods').collect()
  const connections = await ctx.db.query('integrationConnections').collect()
  const babyEvents = await ctx.db.query('babyEvents').collect()

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

    // Attribution follows the merge: "who added this" must go on pointing at
    // the row the app resolves the person to, not at one it is about to delete.
    for (const r of recipes) {
      if (r.createdByUserId !== dupe._id) continue
      bump('recipes')
      if (apply) await ctx.db.patch(r._id, { createdByUserId: keep._id })
    }

    const entries = await ctx.db
      .query('consumptionEntries')
      .withIndex('by_user_date', (q) => q.eq('userId', dupe._id))
      .collect()
    for (const e of entries) {
      bump('consumptionEntries')
      if (apply) await ctx.db.patch(e._id, { userId: keep._id })
    }

    for (const t of tasks) {
      if (t.createdBy !== dupe._id) continue
      bump('tasks')
      if (apply) await ctx.db.patch(t._id, { createdBy: keep._id })
    }
    for (const f of foods) {
      if (f.createdBy !== dupe._id) continue
      bump('foods')
      if (apply) await ctx.db.patch(f._id, { createdBy: keep._id })
    }
    for (const c of connections) {
      if (c.connectedBy !== dupe._id) continue
      bump('integrationConnections')
      if (apply) await ctx.db.patch(c._id, { connectedBy: keep._id })
    }
    for (const e of babyEvents) {
      if (e.loggedBy !== dupe._id) continue
      bump('babyEvents')
      if (apply) await ctx.db.patch(e._id, { loggedBy: keep._id })
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
