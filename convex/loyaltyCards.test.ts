import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  alice,
  bob,
  carol,
  seedGroup,
  seedMember,
  testConvex,
} from '../test/convexHarness'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { RETAILER_CATALOG } from './lib/seed/retailerCatalog'

/**
 * Loyalty cards through the functions a client calls (APP-141): who may read
 * and write a card, what picking a Catalog retailer copies, the Catalog
 * search, the list order, and that a card's photos go with it.
 */

type Harness = ReturnType<typeof testConvex>

const HOME = { groupSlug: 'home' } as const
const OTHER = { groupSlug: 'other' } as const
/** A valid Bonuskaart-style EAN-13. */
const AH_NUMBER = '2620187342052'

async function seed() {
  const t = testConvex()
  let homeId: Id<'groups'> | undefined
  await t.run(async (ctx) => {
    const ids = await Promise.all(
      [alice, bob, carol].map((person) =>
        ctx.db.insert('users', {
          clerkId: person.subject,
          name: person.name,
          email: person.email,
        }),
      ),
    )
    homeId = await seedGroup(ctx, {
      name: 'Home',
      slug: 'home',
      inviteCode: 'home',
    })
    const other = await seedGroup(ctx, {
      name: 'Other',
      slug: 'other',
      inviteCode: 'other',
    })
    await seedMember(ctx, homeId, ids[0], 'admin')
    await seedMember(ctx, homeId, ids[1], 'member')
    await seedMember(ctx, other, ids[2], 'admin')
  })
  await t.mutation(internal.seed.seedRetailerCatalog, {})
  return { t, homeId: homeId as Id<'groups'> }
}

async function addAhCard(t: Harness, overrides: Record<string, unknown> = {}) {
  return await t.withIdentity(alice).mutation(api.loyaltyCards.create, {
    ...HOME,
    catalogKey: 'albert-heijn',
    storeName: 'Albert Heijn',
    cardNumber: AH_NUMBER,
    barcodeFormat: 'EAN_13',
    ...overrides,
  })
}

async function storePhoto(t: Harness) {
  return await t.run(async (ctx) => await ctx.storage.store(new Blob(['jpg'])))
}

async function photoExists(t: Harness, id: Id<'_storage'>) {
  return await t.run(async (ctx) => (await ctx.storage.getUrl(id)) !== null)
}

describe('the Retailer catalog', () => {
  test('ships at least 80 retailers, each well formed', () => {
    expect(RETAILER_CATALOG.length).toBeGreaterThanOrEqual(80)
    const keys = new Set<string>()
    for (const entry of RETAILER_CATALOG) {
      expect(entry.seedKey).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(keys.has(entry.seedKey)).toBe(false)
      keys.add(entry.seedKey)
      expect(entry.brandColor).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(entry.domain).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/)
      if (entry.formatConfidence === 'guess') {
        expect(entry.barcodeFormat).toBe('CODE_128')
      }
    }
  })

  test('seeding twice changes nothing the second time', async () => {
    const { t } = await seed()
    const again = await t.mutation(internal.seed.seedRetailerCatalog, {})
    expect(again).toMatchObject({
      inserted: 0,
      retired: 0,
      deduped: 0,
      rows: RETAILER_CATALOG.length,
    })
  })

  test('search matches name and aliases, ignoring case and accents', async () => {
    const { t } = await seed()
    const search = (query: string) =>
      t
        .withIdentity(alice)
        .query(api.loyaltyCards.searchCatalog, { query })
        .then((rows) => rows.map((row) => row.seedKey))

    expect((await search('albert'))[0]).toBe('albert-heijn')
    expect((await search('ALBERT HEIJN'))[0]).toBe('albert-heijn')
    // An alias: the Bonuskaart is Albert Heijn's card.
    expect(await search('bonuskaart')).toContain('albert-heijn')
    // Accents fold both ways: typed where the name has none, and left out
    // where it has one.
    expect(await search('hémá')).toContain('hema')
    expect(await search('HUNKEMOLLER')).toContain('hunkemoller')
    expect(await search('zzzz-no-such-store')).toEqual([])
    // An empty query lists the whole Catalog.
    expect((await search('')).length).toBe(RETAILER_CATALOG.length)
  })

  test('is not offered to a signed-out caller', async () => {
    const { t } = await seed()
    expect(
      await t.query(api.loyaltyCards.searchCatalog, { query: 'albert' }),
    ).toEqual([])
  })
})

describe('adding a card', () => {
  test('a Catalog retailer copies its colour and domain onto the card', async () => {
    const { t } = await seed()
    const ah = RETAILER_CATALOG.find((entry) => entry.seedKey === 'albert-heijn')
    const id = await addAhCard(t, {
      // A client cannot choose a Catalog store's colour.
      brandColor: '#123456',
      holder: '  Nora ',
    })

    const card = await t
      .withIdentity(bob)
      .query(api.loyaltyCards.get, { ...HOME, id })
    expect(card).toMatchObject({
      storeName: 'Albert Heijn',
      catalogKey: 'albert-heijn',
      brandColor: ah?.brandColor.toLowerCase(),
      domain: ah?.domain,
      cardNumber: AH_NUMBER,
      barcodeFormat: 'EAN_13',
      holder: 'Nora',
    })
  })

  test('a custom store keeps its own colour and has no Provenance', async () => {
    const { t } = await seed()
    const id = await t.withIdentity(alice).mutation(api.loyaltyCards.create, {
      ...HOME,
      storeName: 'Bakkerij De Graaf',
      brandColor: '#AA3300',
      cardNumber: 'dg-4217',
      barcodeFormat: 'CODE_39',
    })
    const card = await t
      .withIdentity(alice)
      .query(api.loyaltyCards.get, { ...HOME, id })
    expect(card).toMatchObject({
      brandColor: '#aa3300',
      cardNumber: 'DG-4217',
    })
    expect(card?.catalogKey).toBeUndefined()
    expect(card?.domain).toBeUndefined()
  })

  test('a number its barcode cannot encode is refused with its problem', async () => {
    const { t } = await seed()
    await expect(
      addAhCard(t, { cardNumber: '2620187342053' }),
    ).rejects.toMatchObject({ data: { kind: 'loyalty:cardNumber:checkDigit' } })
    await expect(addAhCard(t, { cardNumber: '12345' })).rejects.toMatchObject({
      data: { kind: 'loyalty:cardNumber:length' },
    })
    await expect(addAhCard(t, { cardNumber: '  ' })).rejects.toMatchObject({
      data: { kind: 'loyalty:cardNumber:empty' },
    })
  })

  test('an unknown retailer and an empty store name are refused', async () => {
    const { t } = await seed()
    await expect(
      addAhCard(t, { catalogKey: 'no-such-store' }),
    ).rejects.toMatchObject({ data: { kind: 'loyalty:unknownRetailer' } })
    // An empty key is not "no Catalog entry"; it would be kept as Provenance.
    await expect(addAhCard(t, { catalogKey: '' })).rejects.toMatchObject({
      data: { kind: 'loyalty:unknownRetailer' },
    })
    await expect(addAhCard(t, { storeName: '   ' })).rejects.toMatchObject({
      data: { kind: 'loyalty:needsStore' },
    })
  })

  test('two cards may come from the same retailer', async () => {
    const { t } = await seed()
    await addAhCard(t, { holder: 'Nora' })
    await addAhCard(t, { holder: 'Sam', cardNumber: '2620194503163' })
    const cards = await t
      .withIdentity(alice)
      .query(api.loyaltyCards.list, HOME)
    expect(cards.map((card) => card.holder)).toEqual(['Nora', 'Sam'])
  })

  test('a non-Member cannot add a card to the Group', async () => {
    const { t } = await seed()
    await expect(
      t.withIdentity(carol).mutation(api.loyaltyCards.create, {
        ...HOME,
        storeName: 'HEMA',
        cardNumber: 'X1',
        barcodeFormat: 'CODE_128',
      }),
    ).rejects.toThrow()
  })
})

describe('reading cards', () => {
  test('another Group cannot see a card, and asking looks like "not found"', async () => {
    const { t } = await seed()
    const id = await addAhCard(t)
    expect(
      await t.withIdentity(carol).query(api.loyaltyCards.list, OTHER),
    ).toEqual([])
    expect(
      await t
        .withIdentity(carol)
        .query(api.loyaltyCards.get, { ...OTHER, id }),
    ).toBeNull()
  })

  describe('the list order', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    test('is last used first, then never-used cards by name', async () => {
      vi.setSystemTime(new Date('2026-11-01T10:00:00Z'))
      const { t } = await seed()
      const hema = await t
        .withIdentity(alice)
        .mutation(api.loyaltyCards.create, {
          ...HOME,
          storeName: 'HEMA',
          cardNumber: 'H1',
          barcodeFormat: 'CODE_128',
        })
      await t.withIdentity(alice).mutation(api.loyaltyCards.create, {
        ...HOME,
        storeName: 'Action',
        cardNumber: 'A1',
        barcodeFormat: 'CODE_128',
      })
      const ah = await addAhCard(t)

      await t
        .withIdentity(bob)
        .mutation(api.loyaltyCards.markUsed, { ...HOME, id: hema })
      vi.setSystemTime(new Date('2026-11-02T10:00:00Z'))
      await t
        .withIdentity(bob)
        .mutation(api.loyaltyCards.markUsed, { ...HOME, id: ah })

      const cards = await t
        .withIdentity(alice)
        .query(api.loyaltyCards.list, HOME)
      expect(cards.map((card) => card.storeName)).toEqual([
        'Albert Heijn',
        'HEMA',
        'Action',
      ])
      expect(cards[0].lastUsedAt).toBe(Date.parse('2026-11-02T10:00:00Z'))
    })
  })

  test('markUsed on another Group’s card does nothing, quietly', async () => {
    const { t } = await seed()
    const id = await addAhCard(t)
    await t
      .withIdentity(carol)
      .mutation(api.loyaltyCards.markUsed, { ...OTHER, id })
    const card = await t
      .withIdentity(alice)
      .query(api.loyaltyCards.get, { ...HOME, id })
    expect(card?.lastUsedAt).toBeUndefined()
  })
})

describe('editing and deleting', () => {
  test('any Member may edit; Provenance stays', async () => {
    const { t } = await seed()
    const id = await addAhCard(t)
    await t.withIdentity(bob).mutation(api.loyaltyCards.update, {
      ...HOME,
      id,
      storeName: 'AH',
      cardNumber: AH_NUMBER,
      barcodeFormat: 'EAN_13',
      holder: 'Bob',
    })
    const card = await t
      .withIdentity(alice)
      .query(api.loyaltyCards.get, { ...HOME, id })
    expect(card).toMatchObject({
      storeName: 'AH',
      holder: 'Bob',
      catalogKey: 'albert-heijn',
      domain: 'ah.nl',
    })
  })

  test('editing a card in another Group is refused as not found', async () => {
    const { t } = await seed()
    const id = await addAhCard(t)
    await expect(
      t.withIdentity(carol).mutation(api.loyaltyCards.update, {
        ...OTHER,
        id,
        storeName: 'Mine now',
        cardNumber: AH_NUMBER,
        barcodeFormat: 'EAN_13',
      }),
    ).rejects.toMatchObject({ data: { kind: 'loyalty:notFound' } })
  })

  test('replacing or clearing a photo deletes the old one', async () => {
    const { t } = await seed()
    const front = await storePhoto(t)
    const back = await storePhoto(t)
    const id = await addAhCard(t, { frontPhotoId: front, backPhotoId: back })
    const newFront = await storePhoto(t)

    await t.withIdentity(alice).mutation(api.loyaltyCards.update, {
      ...HOME,
      id,
      storeName: 'Albert Heijn',
      cardNumber: AH_NUMBER,
      barcodeFormat: 'EAN_13',
      frontPhotoId: newFront,
      backPhotoId: null,
    })

    expect(await photoExists(t, front)).toBe(false)
    expect(await photoExists(t, back)).toBe(false)
    expect(await photoExists(t, newFront)).toBe(true)
  })

  test('deleting a card deletes its photos, and deleting it again is quiet', async () => {
    const { t } = await seed()
    const front = await storePhoto(t)
    const back = await storePhoto(t)
    const id = await addAhCard(t, { frontPhotoId: front, backPhotoId: back })

    await t
      .withIdentity(bob)
      .mutation(api.loyaltyCards.remove, { ...HOME, id })
    await t
      .withIdentity(bob)
      .mutation(api.loyaltyCards.remove, { ...HOME, id })

    expect(
      await t.withIdentity(alice).query(api.loyaltyCards.list, HOME),
    ).toEqual([])
    expect(await photoExists(t, front)).toBe(false)
    expect(await photoExists(t, back)).toBe(false)
  })

  test('another Group cannot delete a card', async () => {
    const { t } = await seed()
    const id = await addAhCard(t)
    await t
      .withIdentity(carol)
      .mutation(api.loyaltyCards.remove, { ...OTHER, id })
    expect(
      await t.withIdentity(alice).query(api.loyaltyCards.list, HOME),
    ).toHaveLength(1)
  })
})

describe('when the Group goes', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  test('its cards and their photos go with it', async () => {
    const { t, homeId } = await seed()
    const front = await storePhoto(t)
    const back = await storePhoto(t)
    await addAhCard(t, { frontPhotoId: front, backPhotoId: back })
    await t.withIdentity(bob).mutation(api.groups.leaveGroup, {
      groupId: homeId,
    })

    await t
      .withIdentity(alice)
      .mutation(api.groups.deleteGroup, { groupId: homeId })
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const left = await t.run(async (ctx) =>
      ctx.db.query('loyaltyCards').collect(),
    )
    expect(left).toEqual([])
    expect(await photoExists(t, front)).toBe(false)
    expect(await photoExists(t, back)).toBe(false)
  })
})
