import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { internalMutation } from './_generated/server'
import { allocateGroupSlug } from './lib/groupSlugs'
import { pickCanonicalUser } from './lib/sharing'
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
