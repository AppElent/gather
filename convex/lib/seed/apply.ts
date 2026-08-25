import { declinedEventTypes } from '@gather/core/domain'
import type { Id, TableNames } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import {
  computeFoodEntryNutrition,
  computeRecipeEntryNutrition,
} from '../consumption'
import { foodSearchText } from '../foodSearchText'
import { allocateGroupSlug } from '../groupSlugs'
import { getUserByClerkId } from '../sharing'
import { CATALOG_FOODS } from './catalogFoods'
import {
  SAMPLE_BABY,
  SAMPLE_BABY_EVENTS,
  SAMPLE_BUYING_COSTS,
  SAMPLE_COMBOS,
  SAMPLE_DIARY,
  SAMPLE_FINANCE_SETTINGS,
  SAMPLE_GROUP_NAME,
  SAMPLE_HOLDINGS,
  SAMPLE_HOUSE,
  SAMPLE_HOUSEMATES,
  SAMPLE_MORTGAGES,
  SAMPLE_NET_WORTH_ENTRIES,
  SAMPLE_NOTES,
  SAMPLE_RECIPES,
  SAMPLE_RECURRING_COSTS,
  SAMPLE_SAVINGS_GOALS,
  SAMPLE_TASK_LISTS,
  SAMPLE_TASTING_SUBJECTS,
  SAMPLE_USER_FOODS,
  type SampleAuthor,
} from './sampleHousehold'
import { TASTING_CATALOG } from './tastingCatalog'

/** The one `seedRuns.label` in use. A second kind of run would add its own. */
export const SAMPLE_LABEL = 'sample'

const DAY_MS = 24 * 60 * 60 * 1000

/** `YYYY-MM-DD`, `daysAgo` days before `now`. UTC throughout — Convex has no
 * local timezone, and the app stores plain date strings. */
function isoDate(now: number, daysAgo: number): string {
  return new Date(now - daysAgo * DAY_MS).toISOString().slice(0, 10)
}

/** `YYYY-MM-DD`, `months` whole months after `now`. Finance dates are months
 * out rather than days: a fixed rate ends in a month, not on a Tuesday. */
function isoMonthsAhead(now: number, months: number): string {
  const day = new Date(now)
  const shifted = new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + months, 1),
  )
  const last = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0),
  ).getUTCDate()
  shifted.setUTCDate(Math.min(day.getUTCDate(), last))
  return shifted.toISOString().slice(0, 10)
}

/** Epoch ms at a given hour/minute on the day `daysAgo` before `now`. */
function timestampAt(
  now: number,
  daysAgo: number,
  hour: number,
  minute: number,
): number {
  const day = new Date(now - daysAgo * DAY_MS)
  return Date.UTC(
    day.getUTCFullYear(),
    day.getUTCMonth(),
    day.getUTCDate(),
    hour,
    minute,
  )
}

/**
 * Collects the ids one Sample household run created, so the next run can
 * remove exactly those. Ids are kept as raw strings because they span many
 * tables; `db.delete` resolves the table from the id itself.
 */
class Recorder {
  readonly ids: string[] = []

  track<T extends TableNames>(id: Id<T>): Id<T> {
    this.ids.push(id)
    return id
  }
}

// ---------------------------------------------------------------------------
// Catalog — runs in every environment, production included
// ---------------------------------------------------------------------------

/**
 * Reconcile the `foods` Catalog against `CATALOG_FOODS`.
 *
 * The seed always wins (ADR 0004): a re-run overwrites a Catalog row even if
 * somebody edited it, and drops rows whose `seedKey` is no longer shipped.
 * Rows without a `seedKey` are user-created and never touched.
 *
 * Dropping a retired Catalog row can leave a `consumptionEntries.foodId`
 * dangling. That is by design — Provenance is permission-checked on read and
 * safe to dangle, and the entry already snapshots its own nutrition.
 */
export async function applyCatalog(ctx: MutationCtx) {
  const wanted = new Set(CATALOG_FOODS.map((f) => f.seedKey))
  let inserted = 0
  let updated = 0
  let deduped = 0

  for (const food of CATALOG_FOODS) {
    const matches = await ctx.db
      .query('foods')
      .withIndex('by_seedKey', (q) => q.eq('seedKey', food.seedKey))
      .collect()

    const fields = {
      name: food.name,
      icon: food.icon,
      baseUnit: food.baseUnit,
      nutritionPer100: food.nutritionPer100,
      servings: food.servings,
      searchText: foodSearchText(food),
      source: 'seed' as const,
      seedKey: food.seedKey,
    }

    const [keep, ...extras] = matches
    // A duplicated seedKey is a data bug, not a reason to fail the deploy —
    // collapse it rather than throwing, the way pickCanonicalUser does.
    for (const extra of extras) {
      await ctx.db.delete(extra._id)
      deduped++
    }

    if (keep) {
      await ctx.db.replace(keep._id, fields)
      updated++
    } else {
      await ctx.db.insert('foods', fields)
      inserted++
    }
  }

  // Retired fixtures: a row still carrying a seedKey we no longer ship.
  const all = await ctx.db.query('foods').collect()
  let retired = 0
  for (const row of all) {
    if (row.seedKey !== undefined && !wanted.has(row.seedKey)) {
      await ctx.db.delete(row._id)
      retired++
    }
  }

  const catalogRows = (await ctx.db.query('foods').collect()).filter(
    (f) => f.seedKey !== undefined,
  ).length
  if (catalogRows !== CATALOG_FOODS.length) {
    throw new Error(
      `Catalog seed self-check failed: ${catalogRows} Catalog rows for ${CATALOG_FOODS.length} fixtures`,
    )
  }

  return { inserted, updated, retired, deduped, catalogRows }
}

/**
 * Reconcile the `tastingCatalog` against `TASTING_CATALOG` (#199).
 *
 * Same ADR-0004 rules as the food Catalog — the seed always wins, retired
 * fixtures go, a duplicated `seedKey` collapses rather than failing a deploy —
 * and deliberately a separate function rather than a generalisation of it.
 * The two catalogs mean opposite things (a fact versus a suggestion,
 * ADR-0024), and an abstraction over both would be an invitation to give them
 * the same rules next time somebody touches it.
 *
 * Retiring an entry here is safe in a way retiring a food is not: nothing in a
 * Group ever points at one of these rows. A household that materialised it
 * keeps its own copy, `catalogKey` and all.
 */
export async function applyTastingCatalog(ctx: MutationCtx) {
  const wanted = new Set(TASTING_CATALOG.map((entry) => entry.seedKey))
  let inserted = 0
  let updated = 0
  let deduped = 0

  for (const entry of TASTING_CATALOG) {
    const matches = await ctx.db
      .query('tastingCatalog')
      .withIndex('by_seedKey', (q) => q.eq('seedKey', entry.seedKey))
      .collect()

    const fields = {
      seedKey: entry.seedKey,
      kind: entry.kind,
      name: entry.name,
      attributes: entry.attributes,
    }

    const [keep, ...extras] = matches
    for (const extra of extras) {
      await ctx.db.delete(extra._id)
      deduped++
    }

    if (keep) {
      await ctx.db.replace(keep._id, fields)
      updated++
    } else {
      await ctx.db.insert('tastingCatalog', fields)
      inserted++
    }
  }

  const all = await ctx.db.query('tastingCatalog').collect()
  let retired = 0
  for (const row of all) {
    if (!wanted.has(row.seedKey)) {
      await ctx.db.delete(row._id)
      retired++
    }
  }

  const rows = (await ctx.db.query('tastingCatalog').collect()).length
  if (rows !== TASTING_CATALOG.length) {
    throw new Error(
      `Tasting catalog seed self-check failed: ${rows} rows for ${TASTING_CATALOG.length} fixtures`,
    )
  }

  return { inserted, updated, retired, deduped, rows }
}

// ---------------------------------------------------------------------------
// Sample household — dev and preview only
// ---------------------------------------------------------------------------

/**
 * Remove everything previous Sample household runs created, then repair what
 * those deletions left behind.
 *
 * The recorded ids are not enough on their own. A row the *app* created
 * inside the Sample household — a task added to a seeded list, an event
 * logged against the seeded baby, the baby's lazily-created to-do list from
 * `babies.ensureTodoList` — is not in `documentIds`, so deleting its parent
 * would leave it in the database but unreachable: every query for it
 * navigates through the list, baby or Group that no longer exists. Invisible
 * garbage is worse than deletion, so the sweep below removes descendants
 * whose parent has gone.
 *
 * Content that is *not* contained by the Sample household survives: a recipe
 * living in a real Group is only un-shared from the deleted one, and Personal
 * records (the food diary) belong to a user rather than a Group and are left
 * alone entirely.
 */
export async function resetSample(ctx: MutationCtx) {
  const runs = await ctx.db
    .query('seedRuns')
    .withIndex('by_label', (q) => q.eq('label', SAMPLE_LABEL))
    .collect()

  let deleted = 0
  for (const run of runs) {
    for (const raw of run.documentIds) {
      const id = raw as Id<TableNames>
      if (await ctx.db.get(id)) {
        await ctx.db.delete(id)
        deleted++
      }
    }
  }

  const alive = async (id: Id<TableNames> | undefined) =>
    id !== undefined && (await ctx.db.get(id)) !== null

  // Ordered by containment: Groups are gone already, so drop what hung off
  // them first, then what hung off *those* rows.
  let orphaned = 0

  for (const membership of await ctx.db.query('memberships').collect()) {
    if (
      !(await alive(membership.groupId)) ||
      !(await alive(membership.userId))
    ) {
      await ctx.db.delete(membership._id)
      orphaned++
    }
  }
  // Holds a real OAuth access token — a dangling one is a live credential
  // nobody can reach or revoke through the app.
  for (const conn of await ctx.db.query('integrationConnections').collect()) {
    if (!(await alive(conn.groupId))) {
      await ctx.db.delete(conn._id)
      orphaned++
    }
  }
  for (const list of await ctx.db.query('taskLists').collect()) {
    if (!(await alive(list.groupId))) {
      await ctx.db.delete(list._id)
      orphaned++
    }
  }
  for (const baby of await ctx.db.query('babies').collect()) {
    if (!(await alive(baby.groupId))) {
      await ctx.db.delete(baby._id)
      orphaned++
    }
  }
  for (const task of await ctx.db.query('tasks').collect()) {
    if (!(await alive(task.listId))) {
      await ctx.db.delete(task._id)
      orphaned++
    }
  }
  for (const event of await ctx.db.query('babyEvents').collect()) {
    if (!(await alive(event.babyId))) {
      await ctx.db.delete(event._id)
      orphaned++
    }
  }
  // A subject belongs to its Group and a Tasting to its subject, so both
  // follow containment exactly as a baby and its events do — including a
  // subject somebody added through the app to the seeded household, which the
  // run never recorded and would otherwise leave unreachable.
  for (const subject of await ctx.db.query('tastingSubjects').collect()) {
    if (!(await alive(subject.groupId))) {
      await ctx.db.delete(subject._id)
      orphaned++
    }
  }
  for (const tasting of await ctx.db.query('tastings').collect()) {
    if (!(await alive(tasting.subjectId))) {
      await ctx.db.delete(tasting._id)
      orphaned++
    }
  }

  // A recipe lives in one Group and may be *shared* into others (ADR-0003), so
  // it is the home Group that decides its fate: gone with it. This used to read
  // the other way round, when a recipe was owned by a person and merely shared
  // into a Group — under that model a deleted Group left the recipe standing.
  // A recipe whose home Group has gone is unreachable by anybody, which is the
  // invisible garbage this sweep exists to prevent.
  for (const recipe of await ctx.db.query('recipes').collect()) {
    if (!(await alive(recipe.groupId))) {
      await ctx.db.delete(recipe._id)
      orphaned++
      continue
    }
    const shared: Id<'groups'>[] = []
    for (const groupId of recipe.sharedGroupIds) {
      if (await alive(groupId)) shared.push(groupId)
    }
    if (shared.length !== recipe.sharedGroupIds.length) {
      await ctx.db.patch(recipe._id, { sharedGroupIds: shared })
    }
  }

  // Personal records follow the person, not the Group — only a diary entry
  // belonging to a user who no longer exists is orphaned. A dangling
  // recipeId/foodId is fine: provenance is allowed to dangle (ADR 0003).
  for (const entry of await ctx.db.query('consumptionEntries').collect()) {
    if (!(await alive(entry.userId))) {
      await ctx.db.delete(entry._id)
      orphaned++
    }
  }
  // The same, for a Combo and the components inside one. A component whose
  // Combo has gone is unreachable rather than intact, which is the containment
  // rule this sweep exists for; a dangling foodId/recipeId inside a surviving
  // one is fine for the same reason a diary entry's is.
  for (const combo of await ctx.db.query('combos').collect()) {
    if (!(await alive(combo.userId))) {
      await ctx.db.delete(combo._id)
      orphaned++
    }
  }
  for (const item of await ctx.db.query('comboItems').collect()) {
    if (!(await alive(item.comboId))) {
      await ctx.db.delete(item._id)
      orphaned++
    }
  }

  // Put the owner's default Group back where it pointed before the run took
  // it over. Clearing it instead would leave Tasks and Baby in their
  // no-default state until the user manually revisited Groups.
  let defaultGroupRestored = false
  for (const run of runs) {
    const restore = run.restoreDefaultGroup
    if (!restore) continue
    if (!(await alive(restore.userId))) continue
    const groupId = (await alive(restore.groupId)) ? restore.groupId : undefined
    await ctx.db.patch(restore.userId, { defaultGroupId: groupId })
    defaultGroupRestored = groupId !== undefined
  }
  // Anyone else still pointing at a Group we deleted (including the owner
  // when there was nothing to restore) loses the stale pointer.
  for (const user of await ctx.db.query('users').collect()) {
    if (user.defaultGroupId && !(await alive(user.defaultGroupId))) {
      await ctx.db.patch(user._id, { defaultGroupId: undefined })
    }
  }

  for (const run of runs) await ctx.db.delete(run._id)

  const remaining = await ctx.db
    .query('seedRuns')
    .withIndex('by_label', (q) => q.eq('label', SAMPLE_LABEL))
    .collect()
  if (remaining.length > 0) {
    throw new Error(
      `Sample reset self-check failed: ${remaining.length} run rows survived`,
    )
  }

  return { deleted, orphaned, defaultGroupRestored, runs: runs.length }
}

/**
 * Resolve the `users` row for a Clerk subject, creating it if absent.
 *
 * Upsert, never a blind insert: a second row for one subject reproduces the
 * duplicate-user bug that took production down — see
 * `maintenance.mergeDuplicateUsers`. The row is not recorded for deletion,
 * because for the preview test user it is a real account.
 */
export async function ensureSeedUser(
  ctx: MutationCtx,
  clerkId: string,
  name: string,
  email: string,
): Promise<Id<'users'>> {
  const existing = await getUserByClerkId(ctx, clerkId)
  if (existing) return existing._id
  return await ctx.db.insert('users', { clerkId, name, email })
}

/**
 * Build the Sample household for `ownerUserId`, with every date anchored to
 * `now`. Assumes `resetSample` has already run.
 */
export async function applySample(
  ctx: MutationCtx,
  ownerUserId: Id<'users'>,
  now: number,
) {
  const rec = new Recorder()

  // Captured before the run takes the default over, so `resetSample` can put
  // it back rather than leaving the account with no default Group.
  const previousDefaultGroupId = (await ctx.db.get(ownerUserId))?.defaultGroupId

  // --- Group and members ---------------------------------------------------
  const groupId = rec.track(
    await ctx.db.insert('groups', {
      name: SAMPLE_GROUP_NAME,
      inviteCode: crypto.randomUUID().slice(0, 8),
      // Allocated the same way a real Group's is, so the sample household has
      // an address that behaves like every other (ADR-0002) — a hand-written
      // slug here would be the one Group whose URL could collide.
      slug: await allocateGroupSlug(ctx, {
        name: SAMPLE_GROUP_NAME,
        isPersonal: false,
      }),
      isPersonal: false,
    }),
  )
  rec.track(
    await ctx.db.insert('memberships', {
      groupId,
      userId: ownerUserId,
      role: 'admin',
    }),
  )

  const authors: Record<SampleAuthor, Id<'users'>> = {
    owner: ownerUserId,
    nora: ownerUserId,
    sam: ownerUserId,
  }
  for (const mate of SAMPLE_HOUSEMATES) {
    // Housemates are seed-owned, so unlike the owner they are recorded for
    // deletion. A row surviving a crashed run is reused rather than doubled.
    const existing = await getUserByClerkId(ctx, mate.clerkId)
    const userId =
      existing?._id ??
      (await ctx.db.insert('users', {
        clerkId: mate.clerkId,
        name: mate.name,
        email: mate.email,
      }))
    rec.track(userId)
    authors[mate.key] = userId
    rec.track(
      await ctx.db.insert('memberships', {
        groupId,
        userId,
        role: 'member',
      }),
    )
  }

  await ctx.db.patch(ownerUserId, { defaultGroupId: groupId })

  // --- Recipes -------------------------------------------------------------
  const recipeIds = new Map<string, Id<'recipes'>>()
  for (const recipe of SAMPLE_RECIPES) {
    const id = rec.track(
      await ctx.db.insert('recipes', {
        // The recipe belongs to the household, not to whoever typed it in;
        // `createdByUserId` is attribution and confers nothing (CONTEXT.md).
        // That is the whole point of the varied authors in the fixtures — the
        // activity stream has different names in it to look at.
        groupId,
        sharedGroupIds: [],
        createdByUserId: authors[recipe.author],
        title: recipe.title,
        description: recipe.description,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        tags: recipe.tags,
        rating: recipe.rating,
        prepMinutes: recipe.prepMinutes,
        servings: recipe.servings,
        nutrition: recipe.nutrition,
        nutritionSource: 'manual',
      }),
    )
    recipeIds.set(recipe.key, id)
  }

  // --- Tasks ---------------------------------------------------------------
  let listOrder = 0
  for (const list of SAMPLE_TASK_LISTS) {
    const listId = rec.track(
      await ctx.db.insert('taskLists', {
        groupId,
        name: list.name,
        provider: 'local',
        order: listOrder++,
      }),
    )
    let taskOrder = 0
    for (const task of list.tasks) {
      rec.track(
        await ctx.db.insert('tasks', {
          listId,
          title: task.title,
          done: task.done,
          dueDate:
            task.dueInDays === undefined
              ? undefined
              : isoDate(now, -task.dueInDays),
          priority: task.priority,
          labels: task.labels,
          createdBy: authors[task.author],
          order: taskOrder++,
        }),
      )
    }
  }

  // --- Notes ----------------------------------------------------------------
  for (const note of SAMPLE_NOTES) {
    rec.track(
      await ctx.db.insert('notes', {
        groupId,
        title: note.title,
        body: note.body,
        pinned: note.pinned,
        createdBy: authors[note.author],
        updatedAt: now - note.daysAgo * DAY_MS,
      }),
    )
  }

  // --- Baby ----------------------------------------------------------------
  // The two lists the app gives every Child are made here rather than left to
  // `babies.ensureAuxLists`: the seed writes straight to the table, so a
  // sample child without them would be the one child in the app that starts
  // out unlike every child a person creates — and a preview is only worth
  // having if it shows what the Module actually looks like.
  const babyTaskListId = rec.track(
    await ctx.db.insert('taskLists', {
      groupId,
      name: `${SAMPLE_BABY.name} to-dos`,
      provider: 'local',
      order: listOrder++,
    }),
  )
  const babyQuestionsListId = rec.track(
    await ctx.db.insert('taskLists', {
      groupId,
      name: `${SAMPLE_BABY.name} questions`,
      provider: 'local',
      order: listOrder++,
    }),
  )
  const babyId = rec.track(
    await ctx.db.insert('babies', {
      groupId,
      name: SAMPLE_BABY.name,
      birthDate: isoDate(now, SAMPLE_BABY.ageInDays),
      sex: SAMPLE_BABY.sex,
      // The fixture says what she tracks, because that is what reads; the
      // record holds what she does not (ADR-0022).
      untrackedTypes: declinedEventTypes(SAMPLE_BABY.trackedTypes),
      taskListId: babyTaskListId,
      questionsListId: babyQuestionsListId,
      order: 0,
    }),
  )
  for (const [listId, titles] of [
    [babyTaskListId, SAMPLE_BABY.todos],
    [babyQuestionsListId, SAMPLE_BABY.questions],
  ] as const) {
    let order = 0
    for (const title of titles) {
      rec.track(
        await ctx.db.insert('tasks', {
          listId,
          title,
          done: false,
          createdBy: authors.owner,
          order: order++,
        }),
      )
    }
  }
  for (const event of SAMPLE_BABY_EVENTS) {
    const timestamp = timestampAt(now, event.daysAgo, event.hour, event.minute)
    rec.track(
      await ctx.db.insert('babyEvents', {
        babyId,
        type: event.type,
        timestamp,
        endTimestamp:
          event.durationMinutes === undefined
            ? undefined
            : timestamp + event.durationMinutes * 60 * 1000,
        notes: event.notes,
        loggedBy: authors[event.loggedBy],
        data: event.data,
      }),
    )
  }

  // --- User-created foods, for contrast with the read-only Catalog ---------
  // One per `nutritionSource`, so a preview shows what each of them looks
  // like on a food — and that it is a separate answer from `source`, which
  // each fixture carries in its own right.
  for (const food of SAMPLE_USER_FOODS) {
    rec.track(
      await ctx.db.insert('foods', {
        ...food,
        searchText: foodSearchText(food),
        createdBy: authors.nora,
      }),
    )
  }

  // --- Tastings ------------------------------------------------------------
  // Written straight to the tables rather than through `logTasting`, like
  // every other fixture here — but in the same order the mutation writes them
  // (subject first, then its Tastings), so a preview cannot contain a shape
  // the app itself could not produce.
  let tastings = 0
  for (const fixture of SAMPLE_TASTING_SUBJECTS) {
    const subjectId = rec.track(
      await ctx.db.insert('tastingSubjects', {
        groupId,
        kind: fixture.kind,
        name: fixture.name,
        attributes: fixture.attributes,
        catalogKey: fixture.catalogKey,
        // Whoever logged the first Tasting is who brought the subject into
        // being, which is what the app does too.
        createdByUserId: authors[fixture.tastings[0].by],
      }),
    )
    for (const tasting of fixture.tastings) {
      rec.track(
        await ctx.db.insert('tastings', {
          subjectId,
          groupId,
          rating: tasting.rating,
          tastedAt: isoDate(now, tasting.daysAgo),
          attributes: tasting.attributes,
          createdByUserId: authors[tasting.by],
        }),
      )
      tastings++
    }
  }

  // --- Food diary ----------------------------------------------------------
  const catalogByKey = new Map(
    (await ctx.db.query('foods').collect())
      .filter((f) => f.seedKey !== undefined)
      .map((f) => [f.seedKey as string, f]),
  )

  let diaryEntries = 0
  for (const entry of SAMPLE_DIARY) {
    const date = isoDate(now, entry.daysAgo)
    if (entry.kind === 'recipe') {
      const recipeId = recipeIds.get(entry.recipeKey)
      const recipe = SAMPLE_RECIPES.find((r) => r.key === entry.recipeKey)
      if (!recipeId || !recipe) {
        throw new Error(
          `Sample diary references unknown recipe ${entry.recipeKey}`,
        )
      }
      rec.track(
        await ctx.db.insert('consumptionEntries', {
          userId: ownerUserId,
          date,
          meal: entry.meal,
          recipeId,
          label: entry.label,
          quantity: entry.servings,
          quantityUnit: 'serving',
          nutrition: computeRecipeEntryNutrition(
            recipe.nutrition,
            entry.servings,
          ),
        }),
      )
    } else {
      const food = catalogByKey.get(entry.seedKey)
      if (!food) {
        throw new Error(
          `Sample diary references unknown Catalog food ${entry.seedKey} — run the Catalog seed first`,
        )
      }
      rec.track(
        await ctx.db.insert('consumptionEntries', {
          userId: ownerUserId,
          date,
          meal: entry.meal,
          foodId: food._id,
          label: entry.label,
          quantity: entry.quantity,
          quantityUnit: entry.unit,
          nutrition: computeFoodEntryNutrition(
            food,
            entry.quantity,
            entry.unit,
          ),
        }),
      )
    }
    diaryEntries++
  }

  // --- Combos ---------------------------------------------------------------
  // Personal, like the diary: they belong to the person the sample household is
  // built around, not to the Group (ADR-0012).
  let combos = 0
  for (const [order, combo] of SAMPLE_COMBOS.entries()) {
    const comboId = rec.track(
      await ctx.db.insert('combos', {
        userId: ownerUserId,
        name: combo.name,
        order,
      }),
    )
    for (const item of combo.items) {
      const food = item.seedKey ? catalogByKey.get(item.seedKey) : undefined
      if (item.seedKey && !food) {
        throw new Error(
          `Sample combo references unknown Catalog food ${item.seedKey}`,
        )
      }
      const recipeId = item.recipeKey
        ? recipeIds.get(item.recipeKey)
        : undefined
      if (item.recipeKey && !recipeId) {
        throw new Error(
          `Sample combo references unknown recipe ${item.recipeKey}`,
        )
      }
      rec.track(
        await ctx.db.insert('comboItems', {
          comboId,
          foodId: food?._id,
          recipeId,
          label: item.label,
          quantity: item.quantity,
          quantityUnit: item.unit,
          nutrition: item.nutrition,
        }),
      )
    }
    combos++
  }

  // --- Finances -------------------------------------------------------------
  // The House is the container for what a home costs (ADR-0025), so it is
  // seeded first and everything about the mortgage hangs off it.
  const houseId = rec.track(
    await ctx.db.insert('houses', {
      groupId,
      createdByUserId: authors.owner,
      name: SAMPLE_HOUSE.name,
      valueCents: SAMPLE_HOUSE.valueCents,
      valueAsOf: isoDate(now, SAMPLE_HOUSE.valuedDaysAgo),
      boughtOn: isoDate(now, SAMPLE_HOUSE.boughtDaysAgo),
      order: 0,
    }),
  )

  let loanParts = 0
  for (const [order, mortgage] of SAMPLE_MORTGAGES.entries()) {
    const calculationId = rec.track(
      await ctx.db.insert('mortgageCalculations', {
        groupId,
        houseId,
        createdByUserId: authors[mortgage.author],
        updatedByUserId: authors[mortgage.author],
        updatedAt: now,
        name: mortgage.name,
        order,
      }),
    )
    for (const [partOrder, part] of mortgage.parts.entries()) {
      rec.track(
        await ctx.db.insert('loanParts', {
          groupId,
          calculationId,
          kind: part.kind,
          principalCents: part.principalCents,
          annualRatePercent: part.annualRatePercent,
          termMonths: part.termMonths,
          fixedUntil:
            part.fixedInMonths === undefined
              ? undefined
              : isoMonthsAhead(now, part.fixedInMonths),
          expiryRatePercent: part.expiryRatePercent,
          expiryRateOptions: part.expiryRateOptions,
          repayments: part.repayments?.map((repayment) => ({
            kind: repayment.kind,
            amountCents: repayment.amountCents,
            date: isoMonthsAhead(now, repayment.inMonths),
          })),
          charge: part.charge,
          order: partOrder,
        }),
      )
      loanParts++
    }
  }

  rec.track(
    await ctx.db.insert('homeBuyingCosts', {
      groupId,
      houseId,
      updatedByUserId: authors.owner,
      ...SAMPLE_BUYING_COSTS,
    }),
  )

  for (const [order, cost] of SAMPLE_RECURRING_COSTS.entries()) {
    rec.track(
      await ctx.db.insert('recurringCosts', {
        groupId,
        createdByUserId: authors[cost.author],
        name: cost.name,
        amountCents: cost.amountCents,
        frequency: cost.frequency,
        category: cost.category,
        note: cost.note,
        split: cost.split?.map((share) => ({
          userId: authors[share.author],
          percent: share.percent,
        })),
        order,
      }),
    )
  }

  for (const [order, goal] of SAMPLE_SAVINGS_GOALS.entries()) {
    rec.track(
      await ctx.db.insert('savingsGoals', {
        groupId,
        createdByUserId: authors[goal.author],
        name: goal.name,
        targetCents: goal.targetCents,
        targetDate: isoMonthsAhead(now, goal.targetInMonths),
        savedCents: goal.savedCents,
        monthlyCents: goal.monthlyCents,
        updatedByUserId: authors[goal.author],
        updatedAt: now,
        order,
      }),
    )
  }

  rec.track(
    await ctx.db.insert('financeSettings', {
      groupId,
      homeCurrency: SAMPLE_FINANCE_SETTINGS.homeCurrency,
      rates: SAMPLE_FINANCE_SETTINGS.rates.map((rate) => ({
        currency: rate.currency,
        rate: rate.rate,
        asOf: now - rate.hoursAgo * 60 * 60 * 1000,
      })),
    }),
  )

  let holdingTransactions = 0
  for (const [order, holding] of SAMPLE_HOLDINGS.entries()) {
    const holdingId = rec.track(
      await ctx.db.insert('holdings', {
        groupId,
        createdByUserId: authors[holding.author],
        kind: holding.kind,
        symbol: holding.symbol,
        name: holding.name,
        exchange: holding.exchange,
        currency: holding.currency,
        openingDate: isoDate(now, holding.openingDaysAgo),
        openingUnits: holding.openingUnits,
        openingAverageCostCents: holding.openingAverageCostCents,
        lastPriceCents: holding.lastPriceCents,
        lastPriceAt: now - holding.pricedHoursAgo * 60 * 60 * 1000,
        order,
      }),
    )
    for (const entry of holding.transactions) {
      rec.track(
        await ctx.db.insert('holdingTransactions', {
          groupId,
          holdingId,
          createdByUserId: authors[holding.author],
          kind: entry.kind,
          date: isoDate(now, entry.daysAgo),
          units: entry.units,
          pricePerUnitCents: entry.pricePerUnitCents,
          perUnitCents: entry.perUnitCents,
          feeCents: entry.feeCents,
          note: entry.note,
        }),
      )
      holdingTransactions++
    }
  }

  for (const [order, entry] of SAMPLE_NET_WORTH_ENTRIES.entries()) {
    rec.track(
      await ctx.db.insert('netWorthEntries', {
        groupId,
        createdByUserId: authors.owner,
        kind: entry.kind,
        label: entry.label,
        amountCents: entry.amountCents,
        order,
      }),
    )
  }

  await ctx.db.insert('seedRuns', {
    label: SAMPLE_LABEL,
    createdAt: now,
    documentIds: rec.ids,
    restoreDefaultGroup: {
      userId: ownerUserId,
      groupId: previousDefaultGroupId,
    },
  })

  const counts = {
    recipes: SAMPLE_RECIPES.length,
    taskLists: SAMPLE_TASK_LISTS.length,
    tasks: SAMPLE_TASK_LISTS.reduce((n, l) => n + l.tasks.length, 0),
    notes: SAMPLE_NOTES.length,
    babyTasks: SAMPLE_BABY.todos.length + SAMPLE_BABY.questions.length,
    babyEvents: SAMPLE_BABY_EVENTS.length,
    diaryEntries,
    combos,
    housemates: SAMPLE_HOUSEMATES.length,
    userFoods: SAMPLE_USER_FOODS.length,
    mortgages: SAMPLE_MORTGAGES.length,
    loanParts,
    recurringCosts: SAMPLE_RECURRING_COSTS.length,
    savingsGoals: SAMPLE_SAVINGS_GOALS.length,
    holdings: SAMPLE_HOLDINGS.length,
    holdingTransactions,
    netWorthEntries: SAMPLE_NET_WORTH_ENTRIES.length,
    tastingSubjects: SAMPLE_TASTING_SUBJECTS.length,
    tastings,
  }

  // Self-check: the run recorded every row it created. Anything missing here
  // is a row the next reset would orphan, which is the failure mode this
  // bookkeeping exists to prevent — so it fails the seed rather than warning.
  const expectedTracked =
    1 + // group
    1 + // owner membership
    counts.housemates * 2 + // each housemate: a user row and a membership
    counts.recipes +
    counts.taskLists +
    counts.tasks +
    counts.notes +
    1 + // baby
    2 + // the baby's own two lists
    counts.babyTasks +
    counts.babyEvents +
    counts.userFoods +
    counts.tastingSubjects +
    counts.tastings +
    counts.diaryEntries +
    counts.combos +
    SAMPLE_COMBOS.reduce((n, combo) => n + combo.items.length, 0) +
    1 + // the house
    counts.mortgages +
    counts.loanParts +
    1 + // its home-buying costs
    counts.recurringCosts +
    counts.savingsGoals +
    1 + // the Group's finance settings
    counts.holdings +
    counts.holdingTransactions +
    counts.netWorthEntries
  if (rec.ids.length !== expectedTracked) {
    throw new Error(
      `Sample seed self-check failed: recorded ${rec.ids.length} rows, expected ${expectedTracked}`,
    )
  }
  if (diaryEntries !== SAMPLE_DIARY.length) {
    throw new Error(
      `Sample seed self-check failed: ${diaryEntries} diary entries for ${SAMPLE_DIARY.length} fixtures`,
    )
  }

  return { groupId, trackedRows: rec.ids.length, ...counts }
}
