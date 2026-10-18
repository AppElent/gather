import { collectExport, type GatherExport } from '@gather/core/data-export'
import { describe, expect, test } from 'vitest'
import { testConvex } from '../test/convexHarness'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { PAGE_SIZE } from './lib/dataExport'
import schema from './schema'

/**
 * "Export your data", asserted from both ends: everything the person can see
 * is in the file, and nothing that is another Member's own — or a secret —
 * is.
 */

type Harness = ReturnType<typeof testConvex>

const asAlice = {
  subject: 'clerk_alice',
  name: 'Alice',
  email: 'alice@example.com',
}
const asBob = { subject: 'clerk_bob', name: 'Bob', email: 'bob@example.com' }
const asCarol = {
  subject: 'clerk_carol',
  name: 'Carol',
  email: 'carol@example.com',
}

async function signUp(t: Harness, identity: typeof asAlice) {
  await t.withIdentity(identity).mutation(api.users.ensureUser, {})
  const user = await t.withIdentity(identity).query(api.users.me, {})
  if (!user) throw new Error('no user row')
  return user._id
}

function exportAs(t: Harness, identity: typeof asAlice) {
  const as = t.withIdentity(identity)
  let pages = 0
  const run = () =>
    collectExport(
      {
        manifest: () => as.query(api.dataExport.manifest, {}),
        page: (request) => {
          pages++
          return as.query(api.dataExport.page, request)
        },
      },
      { now: new Date('2026-10-18T12:00:00Z') },
    )
  return { run, pages: () => pages }
}

interface Household {
  alice: Id<'users'>
  bob: Id<'users'>
  household: Id<'groups'>
  allotment: Id<'groups'>
}

/**
 * Alice and Bob share a household; Alice also has an allotment of her own;
 * Carol, whom Alice has never met, keeps a Group that Shares a recipe into
 * the household. One row in as many Modules as there are, plus each person's
 * private corners, so that the assertions below have something to find — or
 * to not find.
 */
async function household(t: Harness): Promise<Household> {
  const alice = await signUp(t, asAlice)
  const bob = await signUp(t, asBob)
  const carol = await signUp(t, asCarol)

  return await t.run(async (ctx) => {
    // `ensureUser` provisions a first Group; these fixtures want their own.
    for (const m of await ctx.db.query('memberships').collect()) {
      await ctx.db.delete(m._id)
    }
    for (const g of await ctx.db.query('groups').collect()) {
      await ctx.db.delete(g._id)
    }

    const groupPhoto = await ctx.storage.store(new Blob(['group']))
    const household = await ctx.db.insert('groups', {
      name: 'Household',
      slug: 'household',
      inviteCode: 'invite-household',
      imageId: groupPhoto,
    })
    const allotment = await ctx.db.insert('groups', {
      name: 'Allotment',
      slug: 'allotment',
      inviteCode: 'invite-allotment',
    })
    const carols = await ctx.db.insert('groups', {
      name: 'Carol club',
      slug: 'carol-club',
      inviteCode: 'invite-carol',
    })
    await ctx.db.patch(alice, { defaultGroupId: household })

    await ctx.db.insert('memberships', {
      groupId: household,
      userId: alice,
      role: 'admin',
      pinnedModuleIds: ['alice-pin'],
    })
    await ctx.db.insert('memberships', {
      groupId: household,
      userId: bob,
      role: 'member',
      pinnedModuleIds: ['bob-private-pin'],
      calendarView: 'week',
    })
    await ctx.db.insert('memberships', {
      groupId: allotment,
      userId: alice,
      role: 'admin',
    })
    await ctx.db.insert('memberships', {
      groupId: carols,
      userId: carol,
      role: 'admin',
    })

    // Kitchen.
    const recipePhoto = await ctx.storage.store(new Blob(['jpeg']))
    const recipeId = await ctx.db.insert('recipes', {
      groupId: household,
      sharedGroupIds: [carols],
      createdByUserId: bob,
      title: 'Stamppot',
      imageId: recipePhoto,
      ingredients: ['kale'],
      steps: ['mash'],
      tags: [],
    })
    await ctx.db.insert('recipes', {
      groupId: carols,
      sharedGroupIds: [household],
      createdByUserId: carol,
      title: 'Carol pie',
      ingredients: [],
      steps: [],
      tags: [],
    })
    const mealEntryId = await ctx.db.insert('mealEntries', {
      groupId: household,
      title: 'Takeaway',
      createdBy: alice,
    })
    await ctx.db.insert('plannedDinners', {
      groupId: household,
      date: '2026-10-19',
      recipeId,
      title: 'Stamppot',
    })
    await ctx.db.insert('plannedDinners', {
      groupId: household,
      date: '2026-10-20',
      mealEntryId,
      title: 'Takeaway',
    })
    await ctx.db.insert('pantryEntries', {
      groupId: household,
      title: 'Rice',
      createdBy: bob,
    })

    // Tasks, notes and the calendar.
    const connectionId = await ctx.db.insert('integrationConnections', {
      groupId: household,
      provider: 'todoist',
      accessToken: 'secret-oauth-token',
      accountLabel: 'Todoist',
      connectedBy: bob,
    })
    const chores = await ctx.db.insert('taskLists', {
      groupId: household,
      name: 'Chores',
      provider: 'local',
      order: 0,
    })
    const errands = await ctx.db.insert('taskLists', {
      groupId: household,
      name: 'Errands',
      provider: 'local',
      order: 1,
    })
    await ctx.db.insert('taskLists', {
      groupId: household,
      name: 'Mirrored',
      provider: 'todoist',
      providerConfig: { connectionId, sourceId: 'project-1' },
      order: 2,
    })
    await ctx.db.patch(household, { groceryListId: errands })
    // More than a page across two lists, so the compound cursor has to work.
    for (let i = 0; i < PAGE_SIZE + 5; i++) {
      await ctx.db.insert('tasks', {
        listId: i < PAGE_SIZE + 2 ? chores : errands,
        title: `Task ${i}`,
        done: false,
        createdBy: i % 3 ? alice : bob,
        order: i,
      })
    }
    await ctx.db.insert('notes', {
      groupId: household,
      title: 'Wifi',
      body: 'hunter2',
      createdBy: bob,
      updatedAt: 0,
    })
    const calendarId = await ctx.db.insert('calendars', {
      groupId: household,
      name: 'Family',
      source: 'local',
      createdBy: alice,
    })
    await ctx.db.insert('calendarEvents', {
      calendarId,
      title: 'Dentist',
      date: '2026-10-21',
      createdBy: alice,
      assigneeIds: [bob, carol],
    })

    // The baby log, with a photo on a memory.
    const babyId = await ctx.db.insert('babies', {
      groupId: household,
      name: 'Noor',
      birthDate: '2026-01-01',
      trackedTypes: ['feeding'],
      order: 0,
    })
    const memoryPhoto = await ctx.storage.store(new Blob(['memory']))
    await ctx.db.insert('babyEvents', {
      babyId,
      type: 'memory',
      timestamp: 0,
      loggedBy: bob,
      photoId: memoryPhoto,
      data: { what: 'First laugh' },
    })

    // Tastings.
    const subjectId = await ctx.db.insert('tastingSubjects', {
      groupId: household,
      kind: 'cheese',
      name: 'Comté',
      attributes: {},
      createdByUserId: bob,
    })
    await ctx.db.insert('tastings', {
      subjectId,
      groupId: household,
      rating: 4,
      tastedAt: '2026-10-01',
      attributes: {},
      createdByUserId: bob,
    })

    // Money.
    const houseId = await ctx.db.insert('houses', {
      groupId: household,
      createdByUserId: alice,
      name: 'Home',
      order: 0,
    })
    const calculationId = await ctx.db.insert('mortgageCalculations', {
      groupId: household,
      houseId,
      createdByUserId: alice,
      updatedByUserId: alice,
      updatedAt: 0,
      name: 'Plan A',
      order: 0,
    })
    await ctx.db.insert('loanParts', {
      groupId: household,
      calculationId,
      kind: 'annuity',
      principalCents: 100_000_00,
      annualRatePercent: 4,
      termMonths: 360,
      order: 0,
    })
    await ctx.db.insert('homeBuyingCosts', {
      groupId: household,
      houseId,
      updatedByUserId: alice,
      purchasePriceCents: 1,
      ownMoneyCents: 1,
      mortgageCents: 1,
      mortgageRatePercent: 1,
      mortgageTermMonths: 1,
      transferTaxBand: 'ownHome',
      transferTaxPercent: 2,
    })
    await ctx.db.insert('recurringCosts', {
      groupId: household,
      createdByUserId: alice,
      name: 'Rent',
      amountCents: 100_00,
      frequency: 'monthly',
      category: 'housing',
      split: [
        { userId: alice, percent: 50 },
        { userId: bob, percent: 50 },
      ],
      order: 0,
    })
    await ctx.db.insert('savingsGoals', {
      groupId: household,
      createdByUserId: alice,
      name: 'Holiday',
      targetCents: 1,
      targetDate: '2027-01-01',
      savedCents: 0,
      updatedByUserId: alice,
      updatedAt: 0,
      order: 0,
    })
    await ctx.db.insert('splitScenarios', {
      groupId: household,
      createdByUserId: alice,
      createdAt: 0,
      name: 'Weekend',
      payments: [{ party: { userId: bob, name: 'Bob' }, amountCents: 10 }],
      participants: [{ userId: bob, name: 'Bob' }],
      mode: 'equal',
      owed: [],
      transfers: [],
      totalCents: 10,
    })
    const holdingId = await ctx.db.insert('holdings', {
      groupId: household,
      createdByUserId: alice,
      kind: 'stock',
      symbol: 'ASML',
      name: 'ASML',
      currency: 'EUR',
      openingDate: '2026-01-01',
      openingUnits: 1,
      openingAverageCostCents: 100,
      order: 0,
    })
    await ctx.db.insert('holdingTransactions', {
      groupId: household,
      holdingId,
      createdByUserId: alice,
      kind: 'buy',
      date: '2026-02-01',
      units: 1,
      pricePerUnitCents: 100,
    })
    await ctx.db.insert('financeSettings', {
      groupId: household,
      homeCurrency: 'EUR',
    })
    await ctx.db.insert('netWorthEntries', {
      groupId: household,
      createdByUserId: alice,
      kind: 'asset',
      label: 'Car',
      amountCents: 1,
      order: 0,
    })
    await ctx.db.insert('netWorthSnapshots', {
      groupId: household,
      takenByUserId: alice,
      takenOn: '2026-10-01',
      takenAt: 0,
      rows: [],
      assetsCents: 1,
      liabilitiesCents: 0,
      netCents: 1,
    })

    // The allotment, Alice's alone.
    await ctx.db.insert('notes', {
      groupId: allotment,
      title: 'Seeds',
      body: 'Beans in May',
      createdBy: alice,
      updatedAt: 0,
    })

    // Personal records — Alice's, and Bob's that must stay his.
    for (const [userId, who] of [
      [alice, 'Alice'],
      [bob, 'Bob'],
    ] as const) {
      await ctx.db.insert('consumptionEntries', {
        userId,
        date: '2026-10-18',
        meal: 'lunch',
        label: `${who} diary lunch`,
        quantity: 1,
        quantityUnit: 'serving',
        nutrition: { calories: 500 },
      })
      const comboId = await ctx.db.insert('combos', {
        userId,
        name: `${who} combo`,
        order: 0,
      })
      await ctx.db.insert('comboItems', {
        comboId,
        label: `${who} combo item`,
        quantity: 1,
        quantityUnit: 'serving',
      })
      await ctx.db.insert('aiUsage', { userId, day: '2026-10-18', count: 3 })
      await ctx.db.insert('foods', {
        name: `${who} granola`,
        baseUnit: 'g',
        nutritionPer100: {},
        source: 'manual',
        createdBy: userId,
        searchText: `${who} granola`,
      })
    }
    // A Catalog food, which is nobody's.
    await ctx.db.insert('foods', {
      name: 'Apple',
      baseUnit: 'g',
      nutritionPer100: {},
      source: 'seed',
      seedKey: 'apple',
    })
    await ctx.db.insert('tastingCatalog', {
      seedKey: 'gouda',
      kind: 'cheese',
      name: 'Gouda',
      attributes: {},
    })

    return { alice, bob, household, allotment }
  })
}

async function exported(t: Harness) {
  const fixture = await household(t)
  const data = (await exportAs(t, asAlice).run()) as GatherExport
  return { ...fixture, data, text: JSON.stringify(data) }
}

const groupOf = (data: GatherExport, slug: string) => {
  const group = data.groups.find((g) => g.slug === slug)
  if (!group) throw new Error(`no ${slug} in export`)
  return group.tables
}

describe('the export registry', () => {
  test('states a treatment for every table in the schema', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    const manifest = await t
      .withIdentity(asAlice)
      .query(api.dataExport.manifest, {})
    if (!manifest) throw new Error('no manifest')

    const stated = [
      ...manifest.account,
      ...manifest.group,
      ...manifest.excluded.map((e) => e.table),
    ]
    expect([...stated].sort()).toEqual(Object.keys(schema.tables).sort())
    expect(new Set(stated).size).toBe(stated.length)
  })

  test('is nothing to somebody signed out', async () => {
    const t = testConvex()
    expect(await t.query(api.dataExport.manifest, {})).toBeNull()
    await expect(
      t.query(api.dataExport.page, { table: 'users', cursor: null }),
    ).rejects.toThrow('Not authenticated')
  })
})

describe('what the file contains', () => {
  test('a header that says what it is', async () => {
    const t = testConvex()
    const { data } = await exported(t)
    expect(data.format).toBe('gather.data-export')
    expect(data.version).toBe(1)
    expect(data.exportedAt).toBe('2026-10-18T12:00:00.000Z')
    expect(data.excludedTables).toEqual([
      { table: 'tastingCatalog', reason: 'reference-data' },
      { table: 'seedRuns', reason: 'bookkeeping' },
    ])
    expect(data.omittedFields.integrationConnections).toEqual(['accessToken'])
    expect(data.omittedFields.groups).toContain('inviteCode')
  })

  test('every Group the person is in, and only those', async () => {
    const t = testConvex()
    const { data, text } = await exported(t)
    expect(data.groups.map((g) => g.slug)).toEqual(['allotment', 'household'])
    expect(text).not.toContain('carol-club')
    expect(text).not.toContain('Carol pie')
  })

  test('a row from every included table in the household', async () => {
    const t = testConvex()
    const { data } = await exported(t)
    const household = groupOf(data, 'household')
    for (const [table, rows] of Object.entries(household)) {
      expect(rows.length, table).toBeGreaterThan(0)
    }
    expect(household.tasks).toHaveLength(PAGE_SIZE + 5)
    expect(household.recipes.map((r) => r.title)).toEqual(['Stamppot'])
    expect(groupOf(data, 'allotment').notes.map((n) => n.title)).toEqual([
      'Seeds',
    ])
  })

  test('the person’s own records', async () => {
    const t = testConvex()
    const { data } = await exported(t)
    expect(data.account.users).toHaveLength(1)
    expect(data.account.users[0]).toMatchObject({
      name: 'Alice',
      email: 'alice@example.com',
      defaultGroupId: 'household',
    })
    expect(data.account.consumptionEntries.map((e) => e.label)).toEqual([
      'Alice diary lunch',
    ])
    expect(data.account.combos.map((c) => c.name)).toEqual(['Alice combo'])
    expect(data.account.comboItems.map((c) => c.label)).toEqual([
      'Alice combo item',
    ])
    expect(data.account.aiUsage).toHaveLength(1)
    expect(data.account.foods.map((f) => f.name)).toEqual(['Alice granola'])
  })

  test('people as display names and photos as links', async () => {
    const t = testConvex()
    const { data } = await exported(t)
    const household = groupOf(data, 'household')
    const [recipe] = household.recipes
    expect(recipe.createdByUserId).toBe('Bob')
    expect(recipe).not.toHaveProperty('imageId')
    expect(recipe.imageUrl).toEqual(expect.stringContaining('http'))
    // A Group Alice is not in is dropped from the list, not named.
    expect(recipe.sharedGroupIds).toEqual([])
    expect(household.babyEvents[0].photoUrl).toEqual(
      expect.stringContaining('http'),
    )
    expect(household.groups[0].imageUrl).toEqual(
      expect.stringContaining('http'),
    )
    // Carol is no Member of the household, so she is nobody here.
    expect(household.calendarEvents[0].assigneeIds).toEqual(['Bob', null])
    expect(household.recurringCosts[0].split).toEqual([
      { userId: 'Alice', percent: 50 },
      { userId: 'Bob', percent: 50 },
    ])
  })
})

describe('what the file holds back', () => {
  test('another Member’s personal records', async () => {
    const t = testConvex()
    const { text } = await exported(t)
    expect(text).not.toContain('Bob diary lunch')
    expect(text).not.toContain('Bob combo')
    expect(text).not.toContain('Bob granola')
  })

  test('another Member’s choices in a Group, but not that they are in it', async () => {
    const t = testConvex()
    const { data, text } = await exported(t)
    expect(text).not.toContain('bob-private-pin')
    const members = groupOf(data, 'household').memberships
    expect(members).toContainEqual({ userId: 'Bob', role: 'member' })
    expect(members).toContainEqual(
      expect.objectContaining({
        userId: 'Alice',
        pinnedModuleIds: ['alice-pin'],
      }),
    )
  })

  test('identifiers beyond a display name', async () => {
    const t = testConvex()
    const { text, bob } = await exported(t)
    expect(text).not.toContain('bob@example.com')
    expect(text).not.toContain('clerk_bob')
    expect(text).not.toContain('clerk_alice')
    expect(text).not.toContain(bob)
  })

  test('secrets', async () => {
    const t = testConvex()
    const { data, text } = await exported(t)
    expect(text).not.toContain('secret-oauth-token')
    expect(text).not.toContain('invite-household')
    expect(groupOf(data, 'household').integrationConnections[0]).toMatchObject({
      provider: 'todoist',
      accountLabel: 'Todoist',
      connectedBy: 'Bob',
    })
  })

  test('reference data, bookkeeping and legacy columns', async () => {
    const t = testConvex()
    const { data, text } = await exported(t)
    expect(text).not.toContain('Gouda')
    expect(text).not.toContain('"Apple"')
    expect(groupOf(data, 'household').babies[0]).not.toHaveProperty(
      'trackedTypes',
    )
  })
})

describe('reading a page', () => {
  test('is refused for a Group the person is not in', async () => {
    const t = testConvex()
    await household(t)
    await expect(
      t.withIdentity(asAlice).query(api.dataExport.page, {
        table: 'recipes',
        groupSlug: 'carol-club',
        cursor: null,
      }),
    ).rejects.toThrow('Not a member of that group')
  })

  test('is refused for a table that is not exported, or in the wrong scope', async () => {
    const t = testConvex()
    await household(t)
    const as = t.withIdentity(asAlice)
    await expect(
      as.query(api.dataExport.page, { table: 'seedRuns', cursor: null }),
    ).rejects.toThrow('Not an exported table')
    await expect(
      as.query(api.dataExport.page, {
        table: 'consumptionEntries',
        groupSlug: 'household',
        cursor: null,
      }),
    ).rejects.toThrow('Not an exported table')
    await expect(
      as.query(api.dataExport.page, { table: 'recipes', cursor: null }),
    ).rejects.toThrow('Not an exported table')
  })

  test('stays bounded however much a Group holds', async () => {
    const t = testConvex()
    await household(t)
    const { run, pages } = exportAs(t, asAlice)
    await run()
    const manifest = await t
      .withIdentity(asAlice)
      .query(api.dataExport.manifest, {})
    if (!manifest) throw new Error('no manifest')
    const oneEach =
      manifest.account.length + manifest.groups.length * manifest.group.length
    // The household's tasks need more than one page per list.
    expect(pages()).toBeGreaterThan(oneEach)
  })
})
