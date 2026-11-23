import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  alice,
  bob,
  carol,
  modules,
  seedGroup,
  seedMember,
  testConvex,
} from '../test/convexHarness'
import {
  ENERGY_GROUP_TABLES,
  ENERGY_SECRETS,
  energyRowsOf,
  insertEnergyHousehold,
} from '../test/energyFixture'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import schema from './schema'

/**
 * The Energy Module's shell (APP-492): adding the Group's address, reading it
 * back, and what happens to it when its House or its Group goes.
 */

type Harness = ReturnType<typeof testConvex>

const HOME = { groupSlug: 'home' } as const
const OTHER = { groupSlug: 'other' } as const

async function seed() {
  const t = testConvex()
  const ids = await t.run(async (ctx) => {
    const [aliceId, bobId, carolId] = await Promise.all(
      [alice, bob, carol].map((person) =>
        ctx.db.insert('users', {
          clerkId: person.subject,
          name: person.name,
          email: person.email,
        }),
      ),
    )
    const homeId = await seedGroup(ctx, {
      name: 'Home',
      slug: 'home',
      inviteCode: 'home',
    })
    const otherId = await seedGroup(ctx, {
      name: 'Other',
      slug: 'other',
      inviteCode: 'other',
    })
    await seedMember(ctx, homeId, aliceId, 'admin')
    await seedMember(ctx, homeId, bobId, 'member')
    await seedMember(ctx, otherId, carolId, 'admin')
    return { aliceId, bobId, carolId, homeId, otherId }
  })
  return { t, ...ids }
}

async function addHouse(
  t: Harness,
  groupId: Id<'groups'>,
  userId: Id<'users'>,
  name = 'Dorpsstraat 1',
) {
  return await t.run((ctx) =>
    ctx.db.insert('houses', { groupId, createdByUserId: userId, name, order: 0 }),
  )
}

describe('an empty Module', () => {
  test('has no address, for any Member', async () => {
    const { t } = await seed()
    expect(await t.withIdentity(bob).query(api.energy.overview, HOME)).toBeNull()
  })

  test('is not readable from outside the Group', async () => {
    const { t } = await seed()
    await expect(
      t.withIdentity(carol).query(api.energy.overview, HOME),
    ).rejects.toThrow()
  })
})

describe('adding the first address', () => {
  test('with meter readings saves the address and that source', async () => {
    const { t, aliceId } = await seed()
    await t.withIdentity(alice).mutation(api.energy.createSite, {
      ...HOME,
      name: '  Thuis  ',
      source: { kind: 'manual', label: 'Meterstanden' },
    })

    const overview = await t.withIdentity(bob).query(api.energy.overview, HOME)
    expect(overview?.site).toMatchObject({ name: 'Thuis' })
    expect(overview?.site.houseId).toBeUndefined()
    expect(overview?.sources).toEqual([
      expect.objectContaining({
        kind: 'manual',
        label: 'Meterstanden',
        status: 'ok',
      }),
    ])
    const [site] = await t.run((ctx) => ctx.db.query('energySites').collect())
    expect(site).toMatchObject({ createdByUserId: aliceId, order: 0 })
  })

  test('with Home Assistant saves the address alone, to connect later', async () => {
    const { t } = await seed()
    await t.withIdentity(alice).mutation(api.energy.createSite, {
      ...HOME,
      name: 'Thuis',
      source: { kind: 'homeAssistant' },
    })
    const overview = await t.withIdentity(alice).query(api.energy.overview, HOME)
    expect(overview?.site.name).toBe('Thuis')
    expect(overview?.sources).toEqual([])
  })

  test('links a House of the same Group', async () => {
    const { t, homeId, aliceId } = await seed()
    const houseId = await addHouse(t, homeId, aliceId)
    await t.withIdentity(alice).mutation(api.energy.createSite, {
      ...HOME,
      name: 'Thuis',
      houseId,
      source: { kind: 'homeAssistant' },
    })
    const overview = await t.withIdentity(alice).query(api.energy.overview, HOME)
    expect(overview?.site.houseId).toBe(houseId)
  })

  test('refuses a House of another Group as not found, saving nothing', async () => {
    const { t, otherId, carolId } = await seed()
    const theirs = await addHouse(t, otherId, carolId)
    await expect(
      t.withIdentity(alice).mutation(api.energy.createSite, {
        ...HOME,
        name: 'Thuis',
        houseId: theirs,
        source: { kind: 'manual', label: 'Meterstanden' },
      }),
    ).rejects.toThrow('energy:houseNotFound')
    expect(await t.run((ctx) => ctx.db.query('energySites').collect())).toEqual(
      [],
    )
  })

  test('refuses an empty or too long name, and an empty source label', async () => {
    const { t } = await seed()
    const as = t.withIdentity(alice)
    await expect(
      as.mutation(api.energy.createSite, {
        ...HOME,
        name: '   ',
        source: { kind: 'homeAssistant' },
      }),
    ).rejects.toThrow('energy:needsName')
    await expect(
      as.mutation(api.energy.createSite, {
        ...HOME,
        name: 'x'.repeat(61),
        source: { kind: 'homeAssistant' },
      }),
    ).rejects.toThrow('energy:tooLong')
    await expect(
      as.mutation(api.energy.createSite, {
        ...HOME,
        name: 'Thuis',
        source: { kind: 'manual', label: '  ' },
      }),
    ).rejects.toThrow('energy:needsName')
    expect(await t.run((ctx) => ctx.db.query('energySites').collect())).toEqual(
      [],
    )
    expect(
      await t.run((ctx) => ctx.db.query('energySources').collect()),
    ).toEqual([])
  })

  test('is refused for somebody outside the Group', async () => {
    const { t } = await seed()
    await expect(
      t.withIdentity(carol).mutation(api.energy.createSite, {
        ...HOME,
        name: 'Thuis',
        source: { kind: 'homeAssistant' },
      }),
    ).rejects.toThrow()
  })

  test('stays in its Group', async () => {
    const { t } = await seed()
    await t.withIdentity(alice).mutation(api.energy.createSite, {
      ...HOME,
      name: 'Thuis',
      source: { kind: 'homeAssistant' },
    })
    expect(
      await t.withIdentity(carol).query(api.energy.overview, OTHER),
    ).toBeNull()
  })
})

describe('the overview', () => {
  test('never carries a source’s token', async () => {
    const { t, homeId, aliceId } = await seed()
    await t.run((ctx) => insertEnergyHousehold(ctx, homeId, aliceId))
    const overview = await t.withIdentity(bob).query(api.energy.overview, HOME)
    expect(overview?.sources).toHaveLength(1)
    expect(overview?.sources[0]).not.toHaveProperty('secret')
    expect(overview?.sources[0]).not.toHaveProperty('baseUrl')
    expect(JSON.stringify(overview)).not.toContain(ENERGY_SECRETS.source)
  })

  test('opens on the first address in the Group’s order', async () => {
    const { t, homeId, aliceId } = await seed()
    await t.run(async (ctx) => {
      await ctx.db.insert('energySites', {
        groupId: homeId,
        name: 'Vakantiehuis',
        createdByUserId: aliceId,
        order: 1,
      })
      await ctx.db.insert('energySites', {
        groupId: homeId,
        name: 'Thuis',
        createdByUserId: aliceId,
        order: 0,
      })
    })
    const overview = await t.withIdentity(alice).query(api.energy.overview, HOME)
    expect(overview?.site.name).toBe('Thuis')
  })
})

describe('when the linked House goes', () => {
  test('the address stays and only loses the link', async () => {
    const { t, homeId, aliceId } = await seed()
    const houseId = await addHouse(t, homeId, aliceId)
    await t.withIdentity(alice).mutation(api.energy.createSite, {
      ...HOME,
      name: 'Thuis',
      houseId,
      source: { kind: 'manual', label: 'Meterstanden' },
    })

    await t
      .withIdentity(bob)
      .mutation(api.houses.remove, { ...HOME, id: houseId })

    const overview = await t.withIdentity(alice).query(api.energy.overview, HOME)
    expect(overview?.site.name).toBe('Thuis')
    expect(overview?.site.houseId).toBeUndefined()
    expect(overview?.sources).toHaveLength(1)
  })
})

describe('when the Group goes', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  test('every Energy row of it goes, its account prices too; market prices stay', async () => {
    const { t, homeId, otherId, aliceId, carolId } = await seed()
    const ours = await t.run((ctx) => insertEnergyHousehold(ctx, homeId, aliceId))
    const theirs = await t.run((ctx) =>
      insertEnergyHousehold(ctx, otherId, carolId),
    )
    await t.withIdentity(bob).mutation(api.groups.leaveGroup, {
      groupId: homeId,
    })

    await t
      .withIdentity(alice)
      .mutation(api.groups.deleteGroup, { groupId: homeId })
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const left = await t.run((ctx) => energyRowsOf(ctx, homeId))
    expect(left).toEqual(
      Object.fromEntries(ENERGY_GROUP_TABLES.map((table) => [table, 0])),
    )
    const prices = await t.run((ctx) => ctx.db.query('energyPrices').collect())
    const ids = prices.map((price) => price._id)
    expect(ids).not.toContain(ours.accountPriceId)
    expect(ids).toContain(ours.marketPriceId)
    // The other Group keeps all of its own.
    expect(ids).toContain(theirs.accountPriceId)
    const kept = await t.run((ctx) => energyRowsOf(ctx, otherId))
    for (const table of ENERGY_GROUP_TABLES) {
      expect(kept[table], table).toBeGreaterThan(0)
    }
  })

  test('a year of hours and many readings go a page at a time (APP-495)', async () => {
    // Convex's own limits per transaction apply, so one that deletes
    // everything at once fails here as it would live.
    const limited = convexTest({ schema, modules, transactionLimits: true })
    const ids = await limited.run(async (ctx) => {
      const aliceId = await ctx.db.insert('users', {
        clerkId: alice.subject,
        name: alice.name,
        email: alice.email,
      })
      const homeId = await seedGroup(ctx, { name: 'Home', slug: 'home' })
      await seedMember(ctx, homeId, aliceId, 'admin')
      await insertEnergyHousehold(ctx, homeId, aliceId)
      const [channel] = await ctx.db.query('energyChannels').collect()
      if (!channel) throw new Error('expected a channel')
      return { homeId, channelId: channel._id }
    })
    // Three channel-years of hours, in writes as small as a sync's.
    const HOURS = 3 * 365 * 24
    const CHUNK = 5_000
    for (let start = 0; start < HOURS; start += CHUNK) {
      await limited.run(async (ctx) => {
        for (let hour = start; hour < Math.min(HOURS, start + CHUNK); hour += 1) {
          await ctx.db.insert('energyIntervals', {
            groupId: ids.homeId,
            channelId: ids.channelId,
            hourStart: hour * 3_600_000,
            amount: 1,
            estimated: false,
          })
        }
      })
    }
    await limited.run(async (ctx) => {
      for (let at = 0; at < 2_500; at += 1) {
        await ctx.db.insert('energyReadings', {
          groupId: ids.homeId,
          channelId: ids.channelId,
          at,
          value: at,
        })
      }
    })
    await limited
      .withIdentity(alice)
      .mutation(api.groups.deleteGroup, { groupId: ids.homeId })
    expect(await limited.run((ctx) => ctx.db.get(ids.homeId))).toBeNull()
    await limited.finishAllScheduledFunctions(vi.runAllTimers)
    const steps = await limited.run((ctx) =>
      ctx.db.system.query('_scheduled_functions').collect(),
    )
    const purges = steps.filter((each) => each.name.includes('purgeEnergyRows'))
    expect(purges.length).toBeGreaterThanOrEqual(26 + 3)
    expect(purges.every((each) => each.state.kind === 'success')).toBe(true)
    const left = await limited.run((ctx) => energyRowsOf(ctx, ids.homeId))
    expect(Object.values(left).every((count) => count === 0)).toBe(true)
  }, 120_000)

  test('a year of account prices goes a page at a time (APP-493)', async () => {
    const limited = convexTest({ schema, modules, transactionLimits: true })
    const ids = await limited.run(async (ctx) => {
      const aliceId = await ctx.db.insert('users', {
        clerkId: alice.subject,
        name: alice.name,
        email: alice.email,
      })
      const homeId = await seedGroup(ctx, { name: 'Home', slug: 'home' })
      await seedMember(ctx, homeId, aliceId, 'admin')
      return { homeId, ...(await insertEnergyHousehold(ctx, homeId, aliceId)) }
    })
    const QUARTERS = 365 * 96
    const CHUNK = 5_000
    for (let start = 0; start < QUARTERS; start += CHUNK) {
      await limited.run(async (ctx) => {
        for (let at = start; at < Math.min(QUARTERS, start + CHUNK); at += 1) {
          await ctx.db.insert('energyPrices', {
            provider: 'tibber',
            feedId: ids.feedId,
            carrier: 'electricity',
            start: at * 900_000,
            minutes: 15,
            eurPerUnit: 0.3,
          })
        }
      })
    }
    await limited
      .withIdentity(alice)
      .mutation(api.groups.deleteGroup, { groupId: ids.homeId })
    // The key goes with the Group, before the prices do.
    expect(await limited.run((ctx) => ctx.db.get(ids.feedId))).toBeNull()
    await limited.finishAllScheduledFunctions(vi.runAllTimers)
    const steps = await limited.run((ctx) =>
      ctx.db.system.query('_scheduled_functions').collect(),
    )
    const purges = steps.filter((each) => each.name.includes('purgeAccountPrices'))
    expect(purges.length).toBeGreaterThanOrEqual(36)
    expect(purges.every((each) => each.state.kind === 'success')).toBe(true)
    const prices = await limited.run((ctx) => ctx.db.query('energyPrices').collect())
    expect(prices.map((price) => price._id)).toEqual([ids.marketPriceId])
  }, 120_000)
})

describe('when a Member deletes their account', () => {
  /** The purge is a chain of scheduled steps; drain it (see accounts.test). */
  async function settle(t: Harness) {
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0))
      await t.finishInProgressScheduledFunctions()
    }
  }

  test('a Group only they were in goes with all its Energy rows', async () => {
    const { t, otherId, carolId } = await seed()
    const theirs = await t.run((ctx) =>
      insertEnergyHousehold(ctx, otherId, carolId),
    )

    await t.withIdentity(carol).mutation(api.accounts.deleteAccount, {})
    await settle(t)

    const left = await t.run((ctx) => energyRowsOf(ctx, otherId))
    expect(Object.values(left).every((count) => count === 0)).toBe(true)
    const prices = await t.run((ctx) => ctx.db.query('energyPrices').collect())
    expect(prices.map((price) => price._id)).toEqual([theirs.marketPriceId])
  })

  test('a Group others are still in keeps its address', async () => {
    const { t, homeId, aliceId } = await seed()
    await t.run((ctx) => insertEnergyHousehold(ctx, homeId, aliceId))

    await t.withIdentity(alice).mutation(api.accounts.deleteAccount, {})
    await settle(t)

    const left = await t.run((ctx) => energyRowsOf(ctx, homeId))
    for (const table of ENERGY_GROUP_TABLES) {
      expect(left[table], table).toBeGreaterThan(0)
    }
  })
})
