import { declinedEventTypes } from '@gather/core/domain'
import { SAMPLE_GROUP_NAME } from '@gather/core/groups'
import type { Id, TableNames } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import { destroyGroup } from '../groupCascade'
import { allocateGroupSlug } from '../groupSlugs'
import { getUserByClerkId } from '../sharing'
import { auxListNames } from '../taskLists'
import {
  SAMPLE_BABY,
  SAMPLE_BABY_EVENTS,
  SAMPLE_BUYING_COSTS,
  SAMPLE_HOLDINGS,
  SAMPLE_HOUSE,
  SAMPLE_HOUSEMATES,
  SAMPLE_KITCHEN,
  SAMPLE_MORTGAGES,
  SAMPLE_NET_WORTH_ENTRIES,
  SAMPLE_NOTES,
  SAMPLE_RECIPES,
  SAMPLE_RECURRING_COSTS,
  SAMPLE_SAVINGS_GOALS,
  SAMPLE_SPLIT_SCENARIOS,
  SAMPLE_TASK_LISTS,
  SAMPLE_TASTING_SUBJECTS,
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
 * Reconcile the `tastingCatalog` against `TASTING_CATALOG` (#199).
 *
 * ADR-0004's rules: the seed always wins, retired fixtures go, and a
 * duplicated `seedKey` collapses rather than failing a deploy. Retiring an
 * entry is safe: nothing in a Group ever points at one of these rows
 * (ADR-0024). A household that materialised it keeps its own copy,
 * `catalogKey` and all.
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
 * Remove everything previous Sample household runs created.
 *
 * The recorded ids are not enough on their own. A row the *app* created inside
 * the Sample household — a task added to a seeded list, a note, a cost, the
 * baby's lazily-created lists — is not in `documentIds`, and would be left in
 * the database but unreachable. So a recorded Group goes through `destroyGroup`,
 * which reaches everything it contains, and then the rest of the recorded rows
 * go by id: the housemates.
 *
 * Content that is *not* contained by the Sample household survives: a recipe
 * living in a real Group is only un-shared from the deleted one, and a real
 * person's own account is left alone.
 */
export async function resetSample(ctx: MutationCtx) {
  const runs = await ctx.db
    .query('seedRuns')
    .withIndex('by_label', (q) => q.eq('label', SAMPLE_LABEL))
    .collect()

  const alive = async (id: Id<TableNames> | undefined) =>
    id !== undefined && (await ctx.db.get(id)) !== null

  const recorded = runs.flatMap((run) => run.documentIds as Id<TableNames>[])
  let deleted = 0
  for (const id of recorded) {
    if (await alive(id)) deleted++
  }
  for (const id of recorded) {
    const groupId = ctx.db.normalizeId('groups', id)
    if (groupId) await destroyGroup(ctx, groupId)
  }
  for (const id of recorded) {
    if (await alive(id)) await ctx.db.delete(id)
  }

  // What a deleted housemate leaves behind outside the Sample Group.
  let orphaned = 0
  for (const membership of await ctx.db.query('memberships').collect()) {
    if (!(await alive(membership.userId))) {
      await ctx.db.delete(membership._id)
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
      // Allocated the same way a real Group's is: a hand-written slug here
      // would be the one Group whose slug could collide.
      slug: await allocateGroupSlug(ctx, {
        name: SAMPLE_GROUP_NAME,
      }),
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
        // `createdByUserId` is attribution and confers nothing (GLOSSARY.md).
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

  // --- Kitchen -------------------------------------------------------------
  // These modules are all Group-scoped, so they belong beside the Group's
  // task lists and recipes rather than in a second, private sample fixture.
  const groceryList = await ctx.db
    .query('taskLists')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .filter((q) => q.eq(q.field('name'), SAMPLE_KITCHEN.groceryList))
    .unique()
  if (groceryList)
    await ctx.db.patch(groupId, { groceryListId: groceryList._id })
  const mealIds = new Map<string, Id<'mealEntries'>>()
  for (const meal of SAMPLE_KITCHEN.meals) {
    const id = rec.track(
      await ctx.db.insert('mealEntries', {
        groupId,
        title: meal.title,
        prepMinutes: meal.prepMinutes,
        createdBy: authors[meal.author],
      }),
    )
    mealIds.set(meal.title, id)
  }
  for (const dinner of SAMPLE_KITCHEN.dinners) {
    const recipeId = dinner.recipe ? recipeIds.get(dinner.recipe) : undefined
    const mealEntryId = dinner.meal ? mealIds.get(dinner.meal) : undefined
    const source = recipeId
      ? SAMPLE_RECIPES.find((recipe) => recipe.key === dinner.recipe)
      : SAMPLE_KITCHEN.meals.find((meal) => meal.title === dinner.meal)
    if (!source || (!recipeId && !mealEntryId))
      throw new Error('Sample dinner source missing')
    rec.track(
      await ctx.db.insert('plannedDinners', {
        groupId,
        date: isoDate(now, -dinner.daysAhead),
        recipeId,
        mealEntryId,
        title: source.title,
        prepMinutes: source.prepMinutes,
        quickLimit: dinner.quickLimit,
      }),
    )
  }
  for (const entry of SAMPLE_KITCHEN.pantry)
    rec.track(
      await ctx.db.insert('pantryEntries', {
        groupId,
        title: entry.title,
        quantity: entry.quantity,
        createdBy: authors[entry.author],
      }),
    )
  for (const fixture of SAMPLE_KITCHEN.calendars) {
    const calendarId = rec.track(
      await ctx.db.insert('calendars', {
        groupId,
        name: fixture.name,
        color: fixture.color,
        source: 'local',
        createdBy: authors[fixture.author],
      }),
    )
    for (const event of fixture.events)
      rec.track(
        await ctx.db.insert('calendarEvents', {
          calendarId,
          title: event.title,
          date: isoDate(now, -event.daysAhead),
          startMinutes:
            'startMinutes' in event ? event.startMinutes : undefined,
          endMinutes: 'endMinutes' in event ? event.endMinutes : undefined,
          allDay: 'allDay' in event ? event.allDay : undefined,
          assigneeIds: event.assignees?.map((author) => authors[author]),
          location: 'location' in event ? event.location : undefined,
          notes: 'notes' in event ? event.notes : undefined,
          createdBy: authors[event.author],
        }),
      )
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
      name: auxListNames(SAMPLE_BABY.name).todos,
      provider: 'local',
      order: listOrder++,
    }),
  )
  const babyQuestionsListId = rec.track(
    await ctx.db.insert('taskLists', {
      groupId,
      name: auxListNames(SAMPLE_BABY.name).questions,
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

  const ownerName = (await ctx.db.get(ownerUserId))?.name ?? 'Sample owner'
  const authorNames = {
    owner: ownerName,
    ...Object.fromEntries(
      SAMPLE_HOUSEMATES.map((mate) => [mate.key, mate.name]),
    ),
  } as Record<SampleAuthor, string>
  const splitParty = (author: SampleAuthor) => ({
    userId: authors[author],
    name: authorNames[author],
  })
  for (const scenario of SAMPLE_SPLIT_SCENARIOS) {
    rec.track(
      await ctx.db.insert('splitScenarios', {
        groupId,
        createdByUserId: authors[scenario.author],
        createdAt: now - scenario.daysAgo * DAY_MS,
        name: scenario.name,
        payments: scenario.payments.map((payment) => ({
          party: splitParty(payment.author),
          amountCents: payment.amountCents,
          label: payment.label,
        })),
        participants: scenario.participants.map(splitParty),
        mode: scenario.mode,
        owed: scenario.owed.map((share) => ({
          party: splitParty(share.author),
          amountCents: share.amountCents,
        })),
        transfers: scenario.transfers.map((transfer) => ({
          from: splitParty(transfer.from),
          to: splitParty(transfer.to),
          amountCents: transfer.amountCents,
        })),
        totalCents: scenario.totalCents,
      }),
    )
  }

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
    mealEntries: SAMPLE_KITCHEN.meals.length,
    dinners: SAMPLE_KITCHEN.dinners.length,
    pantryEntries: SAMPLE_KITCHEN.pantry.length,
    calendars: SAMPLE_KITCHEN.calendars.length,
    calendarEvents: SAMPLE_KITCHEN.calendars.reduce(
      (count, calendar) => count + calendar.events.length,
      0,
    ),
    babyTasks: SAMPLE_BABY.todos.length + SAMPLE_BABY.questions.length,
    babyEvents: SAMPLE_BABY_EVENTS.length,
    housemates: SAMPLE_HOUSEMATES.length,
    mortgages: SAMPLE_MORTGAGES.length,
    loanParts,
    recurringCosts: SAMPLE_RECURRING_COSTS.length,
    savingsGoals: SAMPLE_SAVINGS_GOALS.length,
    splitScenarios: SAMPLE_SPLIT_SCENARIOS.length,
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
    counts.mealEntries +
    counts.dinners +
    counts.pantryEntries +
    counts.calendars +
    counts.calendarEvents +
    counts.notes +
    1 + // baby
    2 + // the baby's own two lists
    counts.babyTasks +
    counts.babyEvents +
    counts.tastingSubjects +
    counts.tastings +
    1 + // the house
    counts.mortgages +
    counts.loanParts +
    1 + // its home-buying costs
    counts.recurringCosts +
    counts.savingsGoals +
    counts.splitScenarios +
    counts.holdings +
    counts.holdingTransactions +
    counts.netWorthEntries
  if (rec.ids.length !== expectedTracked) {
    throw new Error(
      `Sample seed self-check failed: recorded ${rec.ids.length} rows, expected ${expectedTracked}`,
    )
  }

  return { groupId, trackedRows: rec.ids.length, ...counts }
}
