import type { Id, TableNames } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import {
  computeFoodEntryNutrition,
  computeRecipeEntryNutrition,
} from '../consumption'
import { getUserByClerkId } from '../sharing'
import { CATALOG_FOODS } from './catalogFoods'
import {
  SAMPLE_BABY,
  SAMPLE_BABY_EVENTS,
  SAMPLE_DIARY,
  SAMPLE_GROUP_NAME,
  SAMPLE_HOUSEMATES,
  SAMPLE_RECIPES,
  SAMPLE_TASK_LISTS,
  SAMPLE_USER_FOOD,
  type SampleAuthor,
} from './sampleHousehold'

/** The one `seedRuns.label` in use. A second kind of run would add its own. */
export const SAMPLE_LABEL = 'sample'

const DAY_MS = 24 * 60 * 60 * 1000

/** `YYYY-MM-DD`, `daysAgo` days before `now`. UTC throughout — Convex has no
 * local timezone, and the app stores plain date strings. */
function isoDate(now: number, daysAgo: number): string {
  return new Date(now - daysAgo * DAY_MS).toISOString().slice(0, 10)
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
      baseUnit: food.baseUnit,
      nutritionPer100: food.nutritionPer100,
      servingSize: food.servingSize,
      servingLabel: food.servingLabel,
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

// ---------------------------------------------------------------------------
// Sample household — dev and preview only
// ---------------------------------------------------------------------------

/**
 * Remove everything previous Sample household runs created.
 *
 * Only what the seed itself inserted: rows the *app* created during a review
 * session are not in `documentIds` and survive. The baby's lazily-created
 * to-do and questions lists (`babies.ensureTodoList`) are the case to expect.
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
    await ctx.db.delete(run._id)
  }

  // The owner's `users` row is deliberately not deleted (it is upserted, so
  // that a real signed-in account survives a reset), but its defaultGroupId
  // may now point at a Group we just removed.
  for (const user of await ctx.db.query('users').collect()) {
    if (user.defaultGroupId && !(await ctx.db.get(user.defaultGroupId))) {
      await ctx.db.patch(user._id, { defaultGroupId: undefined })
    }
  }

  const remaining = await ctx.db
    .query('seedRuns')
    .withIndex('by_label', (q) => q.eq('label', SAMPLE_LABEL))
    .collect()
  if (remaining.length > 0) {
    throw new Error(
      `Sample reset self-check failed: ${remaining.length} run rows survived`,
    )
  }

  return { deleted, runs: runs.length }
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

  // --- Group and members ---------------------------------------------------
  const groupId = rec.track(
    await ctx.db.insert('groups', {
      name: SAMPLE_GROUP_NAME,
      inviteCode: crypto.randomUUID().slice(0, 8),
      type: 'home',
    }),
  )
  rec.track(
    await ctx.db.insert('memberships', {
      groupId,
      userId: ownerUserId,
      role: 'owner',
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
        ownerId: authors[recipe.author],
        sharedGroupIds: [groupId],
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

  // --- Baby ----------------------------------------------------------------
  const babyId = rec.track(
    await ctx.db.insert('babies', {
      groupId,
      name: SAMPLE_BABY.name,
      birthDate: isoDate(now, SAMPLE_BABY.ageInDays),
      sex: SAMPLE_BABY.sex,
      order: 0,
    }),
  )
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

  // --- A user-created food, for contrast with the read-only Catalog --------
  rec.track(
    await ctx.db.insert('foods', {
      ...SAMPLE_USER_FOOD,
      source: 'manual',
      createdBy: authors.nora,
    }),
  )

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
        throw new Error(`Sample diary references unknown recipe ${entry.recipeKey}`)
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
          nutrition: computeRecipeEntryNutrition(recipe.nutrition, entry.servings),
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
          nutrition: computeFoodEntryNutrition(food, entry.quantity, entry.unit),
        }),
      )
    }
    diaryEntries++
  }

  await ctx.db.insert('seedRuns', {
    label: SAMPLE_LABEL,
    createdAt: now,
    documentIds: rec.ids,
  })

  const counts = {
    recipes: SAMPLE_RECIPES.length,
    taskLists: SAMPLE_TASK_LISTS.length,
    tasks: SAMPLE_TASK_LISTS.reduce((n, l) => n + l.tasks.length, 0),
    babyEvents: SAMPLE_BABY_EVENTS.length,
    diaryEntries,
    housemates: SAMPLE_HOUSEMATES.length,
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
    1 + // baby
    counts.babyEvents +
    1 + // the user-created food
    counts.diaryEntries
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
