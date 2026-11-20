import {
  RETAILER_CATEGORIES,
  retailersMatchingNumber,
} from '@gather/core/loyalty-cards'
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
import { applyRetailerCatalog } from './lib/seed/apply'
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
  test('ships at least 75 retailers, each well formed', () => {
    // 78 after APP-198 retired eight stores with nothing national to scan.
    expect(RETAILER_CATALOG.length).toBeGreaterThanOrEqual(75)
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

  test('seeding twice writes nothing the second time', async () => {
    const { t } = await seed()
    const again = await t.mutation(internal.seed.seedRetailerCatalog, {})
    expect(again).toEqual({
      inserted: 0,
      updated: 0,
      unchanged: RETAILER_CATALOG.length,
      retired: 0,
      deduped: 0,
      rows: RETAILER_CATALOG.length,
    })
    // The counters could lie; watch the writes themselves.
    const writes = await t.run(async (ctx) => {
      const spies = [
        vi.spyOn(ctx.db, 'insert'),
        vi.spyOn(ctx.db, 'replace'),
        vi.spyOn(ctx.db, 'patch'),
        vi.spyOn(ctx.db, 'delete'),
      ]
      await applyRetailerCatalog(ctx)
      return spies.reduce((sum, spy) => sum + spy.mock.calls.length, 0)
    })
    expect(writes).toBe(0)
  })

  test('a re-seed writes only the rows that changed', async () => {
    const { t } = await seed()
    const changed = RETAILER_CATALOG.map((entry) =>
      entry.seedKey === 'hema' ? { ...entry, brandColor: '#123456' } : entry,
    )
    const { result, replaced } = await t.run(async (ctx) => {
      const replace = vi.spyOn(ctx.db, 'replace')
      const result = await applyRetailerCatalog(ctx, changed)
      return { result, replaced: replace.mock.calls.length }
    })
    expect(replaced).toBe(1)
    expect(result).toMatchObject({
      inserted: 0,
      updated: 1,
      unchanged: RETAILER_CATALOG.length - 1,
      retired: 0,
    })
    const hema = await t.run((ctx) =>
      ctx.db
        .query('retailerCatalog')
        .withIndex('by_seedKey', (q) => q.eq('seedKey', 'hema'))
        .unique(),
    )
    expect(hema?.brandColor).toBe('#123456')
  })

  test('a re-seed counts a dropped hint or reordered aliases as a change', async () => {
    const { t } = await seed()
    const changed = RETAILER_CATALOG.map((entry) => {
      if (entry.seedKey === 'circle-k') return { ...entry, numberPrefix: undefined }
      if (entry.seedKey === 'albert-heijn') return { ...entry, aliases: [...entry.aliases].reverse() }
      return entry
    })
    const result = await t.run((ctx) => applyRetailerCatalog(ctx, changed))
    expect(result).toMatchObject({ updated: 2, unchanged: RETAILER_CATALOG.length - 2 })
    const circleK = await t.run((ctx) =>
      ctx.db
        .query('retailerCatalog')
        .withIndex('by_seedKey', (q) => q.eq('seedKey', 'circle-k'))
        .unique(),
    )
    expect(circleK?.numberPrefix).toBeUndefined()
  })

  test('a re-seed leaves existing cards unchanged, even when their entry is corrected or retired', async () => {
    const { t, homeId } = await seed()
    const ahCard = await addAhCard(t)
    const jumboCard = await t
      .withIdentity(alice)
      .mutation(api.loyaltyCards.create, {
        ...HOME,
        catalogKey: 'jumbo',
        storeName: 'Jumbo',
        cardNumber: AH_NUMBER,
        barcodeFormat: 'EAN_13',
      })
    const cards = () =>
      t.run((ctx) =>
        ctx.db
          .query('loyaltyCards')
          .withIndex('by_group', (q) => q.eq('groupId', homeId))
          .collect(),
      )
    const before = await cards()

    // Albert Heijn corrected, Jumbo retired: the Catalog changes, the cards do not.
    const corrected = RETAILER_CATALOG.filter(
      (entry) => entry.seedKey !== 'jumbo',
    ).map((entry) =>
      entry.seedKey === 'albert-heijn'
        ? { ...entry, brandColor: '#000000', barcodeFormat: 'QR' as const }
        : entry,
    )
    const result = await t.run((ctx) => applyRetailerCatalog(ctx, corrected))
    expect(result).toMatchObject({ updated: 1, retired: 1 })

    expect(await cards()).toEqual(before)
    // The retired entry's Provenance dangles, and the card still reads.
    const jumbo = await t
      .withIdentity(alice)
      .query(api.loyaltyCards.get, { ...HOME, id: jumboCard })
    expect(jumbo).toMatchObject({ catalogKey: 'jumbo', storeName: 'Jumbo' })
    const ah = await t
      .withIdentity(alice)
      .query(api.loyaltyCards.get, { ...HOME, id: ahCard })
    expect(ah).toMatchObject({ barcodeFormat: 'EAN_13' })
    expect(ah?.brandColor).not.toBe('#000000')
  })

  test('health, wholesale and liquor stores have their own categories', () => {
    const category = (key: string) =>
      RETAILER_CATALOG.find((entry) => entry.seedKey === key)?.category
    expect(['holland-and-barrett', 'vitaminstore'].map(category)).toEqual([
      'health',
      'health',
    ])
    expect(['makro', 'sligro', 'hanos'].map(category)).toEqual([
      'wholesale',
      'wholesale',
      'wholesale',
    ])
    expect(['gall-en-gall', 'mitra'].map(category)).toEqual([
      'liquor',
      'liquor',
    ])
  })

  test('stores with nothing national to scan are retired', () => {
    const keys = RETAILER_CATALOG.map((entry) => entry.seedKey)
    const retired = [
      // APP-152
      'trekpleister',
      'blokker',
      'tango',
      // APP-198
      'spar',
      'da',
      'flying-tiger',
      'jysk',
      'jd-sports',
      'dreamland',
      'discus',
      'loogman',
    ]
    for (const key of retired) {
      expect(keys).not.toContain(key)
    }
  })

  test('no catalog entry uses a category that is not in the list', () => {
    expect(RETAILER_CATEGORIES).not.toContain('pharmacy')
    for (const entry of RETAILER_CATALOG) {
      expect(RETAILER_CATEGORIES).toContain(entry.category)
    }
  })

  test('formats APP-198 sourced from the retailers themselves', () => {
    const format = (key: string) =>
      RETAILER_CATALOG.find((entry) => entry.seedKey === key)
    expect(format('c-en-a')).toMatchObject({ barcodeFormat: 'ITF', formatConfidence: 'sourced' })
    // GAMMA: from a member's own card (QR of the printed number).
    for (const key of ['levis', 'hunkemoller', 'only', 'gamma']) {
      expect(format(key)).toMatchObject({ barcodeFormat: 'QR', formatConfidence: 'sourced' })
    }
    // KARWEI's QR was a placeholder icon; LEGO never decoded, and only a
    // third-party guide gave Action's. All three are guesses again.
    for (const key of ['karwei', 'lego', 'action']) {
      expect(format(key)).toMatchObject({ barcodeFormat: 'CODE_128', formatConfidence: 'guess' })
    }
  })

  test('Air Miles is a savings programme with the EAN-13 of a member pass (APP-262)', () => {
    const airMiles = RETAILER_CATALOG.find((entry) => entry.seedKey === 'air-miles')
    // A member's own Wallet pass: EAN-13 of the 13-digit card number.
    expect(airMiles).toMatchObject({
      name: 'Air Miles',
      category: 'programme',
      barcodeFormat: 'EAN_13',
      formatConfidence: 'sourced',
      numberLength: 13,
    })
  })

  test('a scanned number suggests the retailers whose prefix it carries', () => {
    const suggest = (number: string) =>
      retailersMatchingNumber(RETAILER_CATALOG, number).map(
        (entry) => entry.seedKey,
      )
    expect(suggest(AH_NUMBER)).toEqual(['albert-heijn'])
    // Circle K Reward Club: 13 digits starting 9902 (shop.reward-club.nl).
    expect(suggest('9902123456789')).toEqual(['circle-k'])
    expect(suggest('990212345678')).toEqual([])
  })

  test('at least 44 barcode formats come from a source', () => {
    // APP-152 sourced 31 more; APP-198 added 5 and withdrew 4 weak ones;
    // APP-262 added Air Miles. Lower it only when a source turns out wrong,
    // and say which in the catalog.
    const sourced = RETAILER_CATALOG.filter(
      (entry) => entry.formatConfidence === 'sourced',
    )
    expect(sourced.length).toBeGreaterThanOrEqual(44)
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
    // "Airmiles" folds to one word, so only the alias finds Air Miles.
    expect(await search('airmiles')).toContain('air-miles')
    expect(await search('AIR MILES')).toContain('air-miles')
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

  test('adding or editing a card is not using it (APP-153)', async () => {
    const { t } = await seed()
    const fresh = await addAhCard(t, { holder: 'Nora' })
    const older = await addAhCard(t, { holder: 'Sam' })
    await t
      .withIdentity(alice)
      .mutation(api.loyaltyCards.markUsed, { ...HOME, id: older })
    await t.withIdentity(alice).mutation(api.loyaltyCards.update, {
      ...HOME,
      id: fresh,
      storeName: 'Albert Heijn',
      cardNumber: AH_NUMBER,
      barcodeFormat: 'EAN_13',
      holder: 'Nora',
      note: 'Edited',
    })

    const cards = await t
      .withIdentity(alice)
      .query(api.loyaltyCards.list, HOME)
    expect(cards.map((card) => [card.holder, card.lastUsedAt])).toEqual([
      ['Sam', expect.any(Number)],
      ['Nora', undefined],
    ])
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

describe('reorder (APP-440)', () => {
  async function addCard(t: Harness, storeName: string) {
    return await t.withIdentity(alice).mutation(api.loyaltyCards.create, {
      ...HOME,
      storeName,
      cardNumber: '12345678',
      barcodeFormat: 'CODE_128',
    })
  }
  const names = async (t: Harness, who = alice) =>
    (await t.withIdentity(who).query(api.loyaltyCards.list, HOME)).map(
      (card) => card.storeName,
    )

  test('a Group that never reorders keeps the old order', async () => {
    const { t } = await seed()
    await addCard(t, 'Hema')
    const action = await addCard(t, 'Action')
    await addCard(t, 'Zeeman')
    await t
      .withIdentity(alice)
      .mutation(api.loyaltyCards.markUsed, { ...HOME, id: action })
    expect(await names(t)).toEqual(['Action', 'Hema', 'Zeeman'])
    const orders = await t.run(async (ctx) =>
      (await ctx.db.query('loyaltyCards').collect()).map((card) => card.order ?? null),
    )
    expect(orders).toEqual([null, null, null])
  })

  test('any Member writes one order for the Group, and a new card lands on top', async () => {
    const { t } = await seed()
    const hema = await addCard(t, 'Hema')
    const action = await addCard(t, 'Action')
    const zeeman = await addCard(t, 'Zeeman')
    await t
      .withIdentity(bob)
      .mutation(api.loyaltyCards.reorder, { ...HOME, ids: [zeeman, hema, action] })
    expect(await names(t)).toEqual(['Zeeman', 'Hema', 'Action'])
    expect(await names(t, bob)).toEqual(['Zeeman', 'Hema', 'Action'])

    // Using an arranged card no longer moves it.
    await t
      .withIdentity(alice)
      .mutation(api.loyaltyCards.markUsed, { ...HOME, id: action })
    expect(await names(t)).toEqual(['Zeeman', 'Hema', 'Action'])

    await addCard(t, 'Blokker')
    expect(await names(t)).toEqual(['Blokker', 'Zeeman', 'Hema', 'Action'])
  })

  test('cards left out keep their relative order after the listed ones', async () => {
    const { t } = await seed()
    const hema = await addCard(t, 'Hema')
    await addCard(t, 'Action')
    await addCard(t, 'Zeeman')
    await t
      .withIdentity(alice)
      .mutation(api.loyaltyCards.reorder, { ...HOME, ids: [hema] })
    expect(await names(t)).toEqual(['Hema', 'Action', 'Zeeman'])
  })

  test('a card deleted meanwhile is skipped quietly', async () => {
    const { t } = await seed()
    const hema = await addCard(t, 'Hema')
    const action = await addCard(t, 'Action')
    const gone = await addCard(t, 'Zeeman')
    await t
      .withIdentity(alice)
      .mutation(api.loyaltyCards.remove, { ...HOME, id: gone })
    await t
      .withIdentity(alice)
      .mutation(api.loyaltyCards.reorder, { ...HOME, ids: [gone, action, hema] })
    expect(await names(t)).toEqual(['Action', 'Hema'])
  })

  test('a card of another Group is skipped like a missing one, and left alone', async () => {
    const { t } = await seed()
    const hema = await addCard(t, 'Hema')
    const action = await addCard(t, 'Action')
    const theirs = await t.withIdentity(carol).mutation(api.loyaltyCards.create, {
      ...OTHER,
      storeName: 'Theirs',
      cardNumber: '12345678',
      barcodeFormat: 'CODE_128',
    })
    await t
      .withIdentity(alice)
      .mutation(api.loyaltyCards.reorder, { ...HOME, ids: [theirs, hema, action] })
    expect(await names(t)).toEqual(['Hema', 'Action'])
    const theirOrder = await t.run(
      async (ctx) => (await ctx.db.get(theirs))?.order ?? null,
    )
    expect(theirOrder).toBeNull()
  })

  test('someone outside the Group cannot reorder it', async () => {
    const { t } = await seed()
    const hema = await addCard(t, 'Hema')
    await expect(
      t
        .withIdentity(carol)
        .mutation(api.loyaltyCards.reorder, { ...HOME, ids: [hema] }),
    ).rejects.toThrow()
    await expect(
      t.mutation(api.loyaltyCards.reorder, { ...HOME, ids: [hema] }),
    ).rejects.toThrow()
  })

  test('writes only the rows whose order changed', async () => {
    const { t } = await seed()
    const hema = await addCard(t, 'Hema')
    const action = await addCard(t, 'Action')
    const zeeman = await addCard(t, 'Zeeman')
    await t
      .withIdentity(alice)
      .mutation(api.loyaltyCards.reorder, { ...HOME, ids: [hema, action, zeeman] })
    const before = await t.run(async (ctx) =>
      (await ctx.db.query('loyaltyCards').collect()).map((card) => [
        card._id,
        card._creationTime,
        card.order,
      ]),
    )
    expect(before.map(([, , order]) => order)).toEqual([0, 1, 2])
    await t
      .withIdentity(alice)
      .mutation(api.loyaltyCards.reorder, { ...HOME, ids: [action, hema, zeeman] })
    expect(await names(t)).toEqual(['Action', 'Hema', 'Zeeman'])
    const zeemanOrder = await t.run(
      async (ctx) => (await ctx.db.get(zeeman))?.order,
    )
    expect(zeemanOrder).toBe(2)
  })
})
