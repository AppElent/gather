import { describe, expect, test } from 'vitest'

import { testConvex } from '../test/convexHarness'
import { api } from './_generated/api'

/**
 * The Finances Module through its real queries and mutations.
 *
 * Three things are worth asserting here and nowhere else:
 *
 * - **Group access.** Every table is Group-scoped, and a record outside the
 *   Group the caller named must be indistinguishable from one that does not
 *   exist — otherwise a deep link becomes a way to find out that another
 *   household has a house.
 * - **Immutability.** A saved Shared costs split has no update mutation, and
 *   duplicating a Mortgage calculation must leave the original saying exactly
 *   what it said before (ADR-0025).
 * - **What a Member is allowed to type.** A split ratio that does not add up,
 *   a share belonging to somebody outside the Group, a transaction missing the
 *   field its kind needs.
 */

const alice = { subject: 'clerk_alice', name: 'Alice', email: 'a@example.com' }
const bob = { subject: 'clerk_bob', name: 'Bob', email: 'b@example.com' }

/** Two households. Alice is in the first only, Bob in the second only. */
async function seed() {
  const t = testConvex()

  const ids = await t.run(async (ctx) => {
    const aliceId = await ctx.db.insert('users', {
      clerkId: alice.subject,
      name: 'Alice',
      email: alice.email,
    })
    const bobId = await ctx.db.insert('users', {
      clerkId: bob.subject,
      name: 'Bob',
      email: bob.email,
    })
    const jansen = await ctx.db.insert('groups', {
      name: 'Jansen Household',
      slug: 'jansen',
      isPersonal: false,
      inviteCode: 'jansen',
    })
    const devries = await ctx.db.insert('groups', {
      name: 'De Vries Household',
      slug: 'de-vries',
      isPersonal: false,
      inviteCode: 'devries',
    })
    await ctx.db.insert('memberships', {
      groupId: jansen,
      userId: aliceId,
      role: 'admin',
    })
    await ctx.db.insert('memberships', {
      groupId: devries,
      userId: bobId,
      role: 'admin',
    })
    return { aliceId, bobId, jansen, devries }
  })

  return { t, ...ids }
}

describe('houses', () => {
  test('adding one asks for a name and nothing else', async () => {
    const { t } = await seed()
    await t.withIdentity(alice).mutation(api.houses.create, {
      groupSlug: 'jansen',
      name: 'Kerkstraat 14',
    })

    const houses = await t
      .withIdentity(alice)
      .query(api.houses.list, { groupSlug: 'jansen' })
    expect(houses.map((house) => house.name)).toEqual(['Kerkstraat 14'])
    expect(houses[0].valueCents).toBeUndefined()
    expect(houses[0].calculationCount).toBe(0)
  })

  test('a house in another Group reads as missing, not as forbidden', async () => {
    const { t } = await seed()
    const houseId = await t.withIdentity(alice).mutation(api.houses.create, {
      groupSlug: 'jansen',
      name: 'Kerkstraat 14',
    })

    expect(
      await t
        .withIdentity(bob)
        .query(api.houses.get, { id: houseId, groupSlug: 'de-vries' }),
    ).toBeNull()
  })

  test('someone outside a Group is refused rather than shown nothing', async () => {
    const { t } = await seed()
    await expect(
      t.withIdentity(bob).query(api.houses.list, { groupSlug: 'jansen' }),
    ).rejects.toThrow(/Not a member/)
  })

  test('a value always arrives with the day it was said', async () => {
    const { t } = await seed()
    const houseId = await t.withIdentity(alice).mutation(api.houses.create, {
      groupSlug: 'jansen',
      name: 'Kerkstraat 14',
    })
    await t.withIdentity(alice).mutation(api.houses.update, {
      id: houseId,
      groupSlug: 'jansen',
      valueCents: 45_200_000,
    })

    const house = await t
      .withIdentity(alice)
      .query(api.houses.get, { id: houseId, groupSlug: 'jansen' })
    expect(house?.valueCents).toBe(45_200_000)
    expect(house?.valueAsOf).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test('deleting a house takes its calculations and parts with it', async () => {
    const { t } = await seed()
    const houseId = await t.withIdentity(alice).mutation(api.houses.create, {
      groupSlug: 'jansen',
      name: 'Kerkstraat 14',
    })
    const calculationId = await t
      .withIdentity(alice)
      .mutation(api.mortgages.create, {
        houseId,
        groupSlug: 'jansen',
        name: 'What we pay now',
      })
    await t.withIdentity(alice).mutation(api.mortgages.addPart, {
      calculationId,
      groupSlug: 'jansen',
      kind: 'annuity',
      principalCents: 18_000_000,
      annualRatePercent: 3.9,
      termMonths: 360,
    })

    await t
      .withIdentity(alice)
      .mutation(api.houses.remove, { id: houseId, groupSlug: 'jansen' })

    expect(
      await t
        .withIdentity(alice)
        .query(api.mortgages.get, { id: calculationId, groupSlug: 'jansen' }),
    ).toBeNull()
    expect(
      await t.run(
        async (ctx) => (await ctx.db.query('loanParts').collect()).length,
      ),
    ).toBe(0)
  })
})

describe('mortgage calculations', () => {
  async function withMortgage() {
    const seeded = await seed()
    const houseId = await seeded.t
      .withIdentity(alice)
      .mutation(api.houses.create, {
        groupSlug: 'jansen',
        name: 'Kerkstraat 14',
      })
    const calculationId = await seeded.t
      .withIdentity(alice)
      .mutation(api.mortgages.create, {
        houseId,
        groupSlug: 'jansen',
        name: 'What we pay now',
      })
    await seeded.t.withIdentity(alice).mutation(api.mortgages.addPart, {
      calculationId,
      groupSlug: 'jansen',
      kind: 'annuity',
      principalCents: 18_000_000,
      annualRatePercent: 3.9,
      termMonths: 360,
      fixedUntil: '2031-06-01',
      expiryRatePercent: 5,
    })
    await seeded.t.withIdentity(alice).mutation(api.mortgages.addPart, {
      calculationId,
      groupSlug: 'jansen',
      kind: 'interestOnly',
      principalCents: 7_000_000,
      annualRatePercent: 4.4,
      termMonths: 108,
    })
    return { ...seeded, houseId, calculationId }
  }

  test('a calculation is made of its parts, in order', async () => {
    const { t, calculationId } = await withMortgage()
    const calculation = await t
      .withIdentity(alice)
      .query(api.mortgages.get, { id: calculationId, groupSlug: 'jansen' })
    expect(calculation?.parts.map((part) => part.kind)).toEqual([
      'annuity',
      'interestOnly',
    ])
    expect(calculation?.parts[0].expiryRatePercent).toBe(5)
  })

  test('duplicating copies every part and leaves the original alone', async () => {
    const { t, calculationId } = await withMortgage()
    const copyId = await t
      .withIdentity(alice)
      .mutation(api.mortgages.duplicate, {
        id: calculationId,
        groupSlug: 'jansen',
        name: 'If we overpay',
      })
    await t.withIdentity(alice).mutation(api.mortgages.updatePart, {
      id: (await t
        .withIdentity(alice)
        .query(api.mortgages.get, { id: copyId, groupSlug: 'jansen' }))!
        .parts[0]._id,
      groupSlug: 'jansen',
      kind: 'annuity',
      principalCents: 18_000_000,
      annualRatePercent: 3.9,
      termMonths: 360,
      repayments: [
        { kind: 'monthly', amountCents: 30_000, date: '2026-09-01' },
      ],
    })

    const original = await t
      .withIdentity(alice)
      .query(api.mortgages.get, { id: calculationId, groupSlug: 'jansen' })
    const copy = await t
      .withIdentity(alice)
      .query(api.mortgages.get, { id: copyId, groupSlug: 'jansen' })

    expect(copy?.parts).toHaveLength(2)
    expect(copy?.parts[0].repayments).toHaveLength(1)
    expect(original?.parts[0].repayments).toBeUndefined()
    expect(original?.name).toBe('What we pay now')
  })

  test('a part cannot be added to another Group calculation', async () => {
    const { t, calculationId } = await withMortgage()
    await expect(
      t.withIdentity(bob).mutation(api.mortgages.addPart, {
        calculationId,
        groupSlug: 'de-vries',
        kind: 'annuity',
        principalCents: 1000,
        annualRatePercent: 1,
        termMonths: 12,
      }),
    ).rejects.toThrow(/Not found/)
  })

  test('a part has to have money in it', async () => {
    const { t, calculationId } = await withMortgage()
    await expect(
      t.withIdentity(alice).mutation(api.mortgages.addPart, {
        calculationId,
        groupSlug: 'jansen',
        kind: 'linear',
        principalCents: 0,
        annualRatePercent: 2,
        termMonths: 120,
      }),
    ).rejects.toThrow(/cannot be zero/)
  })
})

describe('home-buying costs', () => {
  test('there is one per house, written whole', async () => {
    const { t } = await seed()
    const houseId = await t.withIdentity(alice).mutation(api.houses.create, {
      groupSlug: 'jansen',
      name: 'Kerkstraat 14',
    })

    const fields = {
      houseId,
      groupSlug: 'jansen',
      purchasePriceCents: 42_500_000,
      ownMoneyCents: 4_500_000,
      mortgageCents: 38_000_000,
      mortgageRatePercent: 3.9,
      mortgageTermMonths: 360,
      transferTaxBand: 'ownHome' as const,
      transferTaxPercent: 2,
    }
    const first = await t
      .withIdentity(alice)
      .mutation(api.houses.saveBuyingCosts, fields)
    const second = await t
      .withIdentity(alice)
      .mutation(api.houses.saveBuyingCosts, {
        ...fields,
        ownMoneyCents: 5_000_000,
      })

    expect(second).toBe(first)
    const house = await t
      .withIdentity(alice)
      .query(api.houses.get, { id: houseId, groupSlug: 'jansen' })
    expect(house?.buyingCosts?.ownMoneyCents).toBe(5_000_000)
  })
})

describe('recurring costs', () => {
  test('a split ratio has to add up to a hundred', async () => {
    const { t, aliceId } = await seed()
    await expect(
      t.withIdentity(alice).mutation(api.recurringCosts.create, {
        groupSlug: 'jansen',
        name: 'Rent',
        amountCents: 72_000,
        frequency: 'monthly',
        category: 'housing',
        split: [{ userId: aliceId, percent: 90 }],
      }),
    ).rejects.toThrow(/add up to 100/)
  })

  test('a share cannot belong to somebody outside the Group', async () => {
    const { t, aliceId, bobId } = await seed()
    await expect(
      t.withIdentity(alice).mutation(api.recurringCosts.create, {
        groupSlug: 'jansen',
        name: 'Rent',
        amountCents: 72_000,
        frequency: 'monthly',
        category: 'housing',
        split: [
          { userId: aliceId, percent: 55 },
          { userId: bobId, percent: 45 },
        ],
      }),
    ).rejects.toThrow(/Not a member/)
  })

  test('a cost with a usable ratio is kept, category and all', async () => {
    const { t, aliceId } = await seed()
    await t.withIdentity(alice).mutation(api.recurringCosts.create, {
      groupSlug: 'jansen',
      name: 'Rent',
      amountCents: 72_000,
      frequency: 'monthly',
      category: 'housing',
      split: [{ userId: aliceId, percent: 100 }],
    })

    const costs = await t
      .withIdentity(alice)
      .query(api.recurringCosts.list, { groupSlug: 'jansen' })
    expect(costs).toHaveLength(1)
    expect(costs[0].category).toBe('housing')
    expect(costs[0].split).toEqual([{ userId: aliceId, percent: 100 }])
  })
})

describe('savings goals', () => {
  test('a goal records who last touched it', async () => {
    const { t, aliceId } = await seed()
    const goalId = await t
      .withIdentity(alice)
      .mutation(api.savingsGoals.create, {
        groupSlug: 'jansen',
        name: 'New kitchen',
        targetCents: 1_500_000,
        targetDate: '2028-03-01',
        savedCents: 640_000,
      })

    const goal = await t
      .withIdentity(alice)
      .query(api.savingsGoals.get, { id: goalId, groupSlug: 'jansen' })
    expect(goal?.updatedByUserId).toBe(aliceId)
    expect(goal?.updatedByName).toBe('Alice')
  })

  test('a target date has to be a date', async () => {
    const { t } = await seed()
    await expect(
      t.withIdentity(alice).mutation(api.savingsGoals.create, {
        groupSlug: 'jansen',
        name: 'New kitchen',
        targetCents: 1_500_000,
        targetDate: 'someday',
      }),
    ).rejects.toThrow(/YYYY-MM-DD/)
  })
})

describe('saved splits', () => {
  const scenario = {
    name: 'Ski trip',
    payments: [
      { party: { name: 'Rae' }, amountCents: 64_000 },
      { party: { name: 'Sam' }, amountCents: 41_000 },
    ],
    participants: [{ name: 'Rae' }, { name: 'Sam' }],
    mode: 'equal' as const,
    owed: [
      { party: { name: 'Rae' }, amountCents: 52_500 },
      { party: { name: 'Sam' }, amountCents: 52_500 },
    ],
    transfers: [
      { from: { name: 'Sam' }, to: { name: 'Rae' }, amountCents: 11_500 },
    ],
    totalCents: 105_000,
  }

  test('a saved split keeps its own frozen figures', async () => {
    const { t } = await seed()
    const id = await t
      .withIdentity(alice)
      .mutation(api.splitScenarios.save, { groupSlug: 'jansen', ...scenario })

    const saved = await t
      .withIdentity(alice)
      .query(api.splitScenarios.get, { id, groupSlug: 'jansen' })
    expect(saved?.transfers).toEqual(scenario.transfers)
    expect(saved?.createdByName).toBe('Alice')
  })

  test('one that does not add up is refused', async () => {
    const { t } = await seed()
    await expect(
      t.withIdentity(alice).mutation(api.splitScenarios.save, {
        groupSlug: 'jansen',
        ...scenario,
        owed: [{ party: { name: 'Rae' }, amountCents: 10_000 }],
      }),
    ).rejects.toThrow(/add up/)
  })

  test('changing one means duplicating it', async () => {
    const { t } = await seed()
    const id = await t
      .withIdentity(alice)
      .mutation(api.splitScenarios.save, { groupSlug: 'jansen', ...scenario })
    const copyId = await t
      .withIdentity(alice)
      .mutation(api.splitScenarios.duplicate, {
        id,
        groupSlug: 'jansen',
        name: 'Ski trip (copy)',
      })

    const all = await t
      .withIdentity(alice)
      .query(api.splitScenarios.list, { groupSlug: 'jansen' })
    expect(all.map((s) => s.name).sort()).toEqual([
      'Ski trip',
      'Ski trip (copy)',
    ])
    expect(copyId).not.toBe(id)
    // There is no update mutation, deliberately.
    expect('update' in api.splitScenarios).toBe(false)
  })
})

describe('holdings', () => {
  async function withHolding() {
    const seeded = await seed()
    const holdingId = await seeded.t
      .withIdentity(alice)
      .mutation(api.holdings.create, {
        groupSlug: 'jansen',
        kind: 'stock',
        symbol: 'asml',
        name: 'ASML Holding NV',
        exchange: 'AMS',
        currency: 'eur',
        openingDate: '2026-01-01',
        openingUnits: 12,
        openingAverageCostCents: 61_240,
      })
    return { ...seeded, holdingId }
  }

  test('a holding keeps a precise instrument rather than a typed ticker', async () => {
    const { t, holdingId } = await withHolding()
    const holding = await t
      .withIdentity(alice)
      .query(api.holdings.get, { id: holdingId, groupSlug: 'jansen' })
    expect(holding?.symbol).toBe('ASML')
    expect(holding?.currency).toBe('EUR')
    expect(holding?.exchange).toBe('AMS')
  })

  test('a price always arrives with the moment it is as at', async () => {
    const { t, holdingId } = await withHolding()
    await t.withIdentity(alice).mutation(api.holdings.setPrice, {
      id: holdingId,
      groupSlug: 'jansen',
      pricePerUnitCents: 65_100,
    })

    const holding = await t
      .withIdentity(alice)
      .query(api.holdings.get, { id: holdingId, groupSlug: 'jansen' })
    expect(holding?.lastPriceCents).toBe(65_100)
    expect(typeof holding?.lastPriceAt).toBe('number')
  })

  test('a buy without a price is refused', async () => {
    const { t, holdingId } = await withHolding()
    await expect(
      t.withIdentity(alice).mutation(api.holdings.addTransaction, {
        holdingId,
        groupSlug: 'jansen',
        kind: 'buy',
        date: '2026-02-14',
        units: 3,
      }),
    ).rejects.toThrow(/price per unit/)
  })

  test('transactions come back in date order whatever order they arrived', async () => {
    const { t, holdingId } = await withHolding()
    await t.withIdentity(alice).mutation(api.holdings.addTransaction, {
      holdingId,
      groupSlug: 'jansen',
      kind: 'dividend',
      date: '2026-06-01',
      perUnitCents: 155,
    })
    await t.withIdentity(alice).mutation(api.holdings.addTransaction, {
      holdingId,
      groupSlug: 'jansen',
      kind: 'buy',
      date: '2026-02-14',
      units: 3,
      pricePerUnitCents: 64_000,
      feeCents: 250,
    })

    const holding = await t
      .withIdentity(alice)
      .query(api.holdings.get, { id: holdingId, groupSlug: 'jansen' })
    expect(holding?.transactions.map((entry) => entry.date)).toEqual([
      '2026-02-14',
      '2026-06-01',
    ])
  })

  test('deleting a holding takes its transactions with it', async () => {
    const { t, holdingId } = await withHolding()
    await t.withIdentity(alice).mutation(api.holdings.addTransaction, {
      holdingId,
      groupSlug: 'jansen',
      kind: 'fee',
      date: '2026-02-14',
      feeCents: 250,
    })
    await t
      .withIdentity(alice)
      .mutation(api.holdings.remove, { id: holdingId, groupSlug: 'jansen' })

    expect(
      await t.run(
        async (ctx) =>
          (await ctx.db.query('holdingTransactions').collect()).length,
      ),
    ).toBe(0)
  })

  test('a Group with no settings still has a home currency', async () => {
    const { t } = await seed()
    const value = await t
      .withIdentity(alice)
      .query(api.holdings.settings, { groupSlug: 'jansen' })
    expect(value.homeCurrency).toBe('EUR')
  })
})

describe('net worth', () => {
  test('a snapshot freezes the rows it was given, derived ones included', async () => {
    const { t } = await seed()
    await t.withIdentity(alice).mutation(api.netWorth.addEntry, {
      groupSlug: 'jansen',
      kind: 'asset',
      label: 'Savings',
      amountCents: 2_140_000,
    })

    const id = await t.withIdentity(alice).mutation(api.netWorth.take, {
      groupSlug: 'jansen',
      takenOn: '2026-08-01',
      rows: [
        {
          kind: 'asset',
          source: 'house',
          label: 'Kerkstraat 14',
          amountCents: 45_200_000,
          asOf: '2026-07-01',
        },
        {
          kind: 'asset',
          source: 'manual',
          label: 'Savings',
          amountCents: 2_140_000,
        },
        {
          kind: 'liability',
          source: 'mortgage',
          label: 'Mortgage',
          amountCents: 19_840_000,
        },
      ],
    })

    const snapshot = await t
      .withIdentity(alice)
      .query(api.netWorth.getSnapshot, { id, groupSlug: 'jansen' })
    expect(snapshot?.netCents).toBe(45_200_000 + 2_140_000 - 19_840_000)
    expect(snapshot?.rows[0].asOf).toBe('2026-07-01')
    expect(snapshot?.takenByName).toBe('Alice')

    // Changing the entry afterwards leaves the snapshot exactly as it was.
    const entries = await t
      .withIdentity(alice)
      .query(api.netWorth.entries, { groupSlug: 'jansen' })
    await t.withIdentity(alice).mutation(api.netWorth.updateEntry, {
      id: entries[0]._id,
      groupSlug: 'jansen',
      amountCents: 9_999_999,
    })
    const again = await t
      .withIdentity(alice)
      .query(api.netWorth.getSnapshot, { id, groupSlug: 'jansen' })
    expect(again?.netCents).toBe(snapshot?.netCents)
  })

  test('a snapshot in another Group reads as missing', async () => {
    const { t } = await seed()
    const id = await t.withIdentity(alice).mutation(api.netWorth.take, {
      groupSlug: 'jansen',
      takenOn: '2026-08-01',
      rows: [],
    })
    expect(
      await t
        .withIdentity(bob)
        .query(api.netWorth.getSnapshot, { id, groupSlug: 'de-vries' }),
    ).toBeNull()
  })
})
