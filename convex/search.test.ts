import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { seedGroup, seedMember, testConvex } from '../test/convexHarness'
import { api } from './_generated/api'

const alice = {
  subject: 'search_alice',
  name: 'Alice',
  email: 'search@example.com',
}

describe('Group search', () => {
  test('returns matching records from the addressed Group in name-first order', async () => {
    const t = testConvex()
    await t.run(async (ctx) => {
      const aliceId = await ctx.db.insert('users', {
        clerkId: alice.subject,
        name: alice.name,
        email: alice.email,
      })
      const groupId = await seedGroup(ctx, {
        name: 'Home',
        slug: 'search-home',
        inviteCode: 'search-home',
      })
      const otherGroupId = await seedGroup(ctx, {
        name: 'Elsewhere',
        slug: 'search-elsewhere',
        inviteCode: 'search-elsewhere',
      })
      await seedMember(ctx, groupId, aliceId, 'admin')
      await seedMember(ctx, otherGroupId, aliceId, 'admin')
      await ctx.db.insert('recipes', {
        groupId,
        sharedGroupIds: [],
        createdByUserId: aliceId,
        title: 'Comté tart',
        ingredients: ['butter'],
        steps: [],
        tags: ['dinner'],
      })
      await ctx.db.insert('notes', {
        groupId,
        title: 'Saturday menu',
        body: 'Serve Comté after dinner.',
        createdBy: aliceId,
        updatedAt: 1,
      })
      await ctx.db.insert('notes', {
        groupId: otherGroupId,
        title: 'Comté elsewhere',
        body: '',
        createdBy: aliceId,
        updatedAt: 1,
      })
    })

    const results = await t
      .withIdentity(alice)
      .query(api.search.group, { groupSlug: 'search-home', query: 'comté' })

    expect(results.map((result) => result.title)).toEqual([
      'Comté tart',
      'Saturday menu',
    ])
    expect(results.map((result) => result.type)).toEqual(['recipe', 'note'])
  })
})

describe('Group search filter fields', () => {
  test("says whether a task is done and who added each record", async () => {
    const t = testConvex()
    const aliceId = await t.run(async (ctx) => {
      const aliceId = await ctx.db.insert('users', {
        clerkId: alice.subject,
        name: alice.name,
        email: alice.email,
      })
      const groupId = await seedGroup(ctx, {
        name: 'Home',
        slug: 'search-filters',
        inviteCode: 'search-filters',
      })
      await seedMember(ctx, groupId, aliceId, 'admin')
      const listId = await ctx.db.insert('taskLists', {
        groupId,
        name: 'Chores',
        provider: 'local',
        order: 0,
      })
      await ctx.db.insert('tasks', {
        listId,
        title: 'Buy milk',
        done: true,
        order: 0,
        createdBy: aliceId,
      })
      await ctx.db.insert('notes', {
        groupId,
        title: 'Milk brands',
        body: '',
        createdBy: aliceId,
        updatedAt: 1,
      })
      return aliceId
    })

    const results = await t.withIdentity(alice).query(api.search.group, {
      groupSlug: 'search-filters',
      query: 'milk',
      accepts: ['task', 'note'],
    })

    expect(results).toMatchObject([
      { title: 'Milk brands', type: 'note', createdBy: aliceId },
      { title: 'Buy milk', type: 'task', done: true, createdBy: aliceId },
    ])
    expect(results[0]).not.toHaveProperty('done')
  })
})

describe('Group search for loyalty cards', () => {
  const bob = {
    subject: 'search_bob',
    name: 'Bob',
    email: 'search-bob@example.com',
  }

  async function seedCards() {
    const t = testConvex()
    await t.run(async (ctx) => {
      const bobId = await ctx.db.insert('users', {
        clerkId: bob.subject,
        name: bob.name,
        email: bob.email,
      })
      const groupId = await seedGroup(ctx, {
        name: 'Cards',
        slug: 'search-cards',
        inviteCode: 'search-cards',
      })
      const otherGroupId = await seedGroup(ctx, {
        name: 'Other cards',
        slug: 'search-other-cards',
        inviteCode: 'search-other-cards',
      })
      await seedMember(ctx, groupId, bobId, 'admin')
      await seedMember(ctx, otherGroupId, bobId, 'admin')
      const card = {
        cardNumber: '2620000000008',
        barcodeFormat: 'EAN_13' as const,
        createdByUserId: bobId,
      }
      await ctx.db.insert('loyaltyCards', {
        ...card,
        groupId,
        storeName: 'Albert Heijn',
        holder: 'Sam',
      })
      await ctx.db.insert('loyaltyCards', {
        ...card,
        groupId,
        storeName: 'Kruidvat',
        holder: 'Samira',
      })
      await ctx.db.insert('loyaltyCards', {
        ...card,
        groupId: otherGroupId,
        storeName: 'Albert Heijn elsewhere',
      })
    })
    return t.withIdentity(bob)
  }

  test('finds a card by its store name and by its holder, in this Group only', async () => {
    const asBob = await seedCards()
    const accepts = ['loyaltyCard' as const]

    const byStore = await asBob.query(api.search.group, {
      groupSlug: 'search-cards',
      query: 'albert',
      accepts,
    })
    expect(byStore).toMatchObject([
      { type: 'loyaltyCard', title: 'Albert Heijn', excerpt: 'Sam' },
    ])

    const byHolder = await asBob.query(api.search.group, {
      groupSlug: 'search-cards',
      query: 'sam',
      accepts,
    })
    expect(byHolder.map((result) => result.title)).toEqual([
      'Kruidvat',
      'Albert Heijn',
    ])
  })

  test('a caller that does not ask for loyalty cards gets none', async () => {
    const asBob = await seedCards()
    const results = await asBob.query(api.search.group, {
      groupSlug: 'search-cards',
      query: 'albert',
    })
    expect(results).toEqual([])
  })
})

describe('Group search narrowed to one Module (APP-613)', () => {
  const carol = {
    subject: 'search_carol',
    name: 'Carol',
    email: 'search-carol@example.com',
  }

  test('finds a recipe Shared into the Group, and not one whose share was withdrawn', async () => {
    const t = testConvex()
    await t.run(async (ctx) => {
      const carolId = await ctx.db.insert('users', {
        clerkId: carol.subject,
        name: carol.name,
        email: carol.email,
      })
      const home = await seedGroup(ctx, {
        name: 'Home',
        slug: 'search-shared-home',
        inviteCode: 'search-shared-home',
      })
      const club = await seedGroup(ctx, {
        name: 'Club',
        slug: 'search-shared-club',
        inviteCode: 'search-shared-club',
      })
      await seedMember(ctx, home, carolId, 'admin')
      const recipe = {
        createdByUserId: carolId,
        ingredients: [],
        steps: [],
        tags: [],
      }
      const shared = await ctx.db.insert('recipes', {
        ...recipe,
        groupId: club,
        sharedGroupIds: [home],
        title: 'Club lasagne',
      })
      // A share row that lags a withdrawn share names a recipe Home no
      // longer sees.
      const withdrawn = await ctx.db.insert('recipes', {
        ...recipe,
        groupId: club,
        sharedGroupIds: [],
        title: 'Club lasagne, withdrawn',
      })
      await ctx.db.insert('recipeShares', { recipeId: shared, groupId: home })
      await ctx.db.insert('recipeShares', { recipeId: withdrawn, groupId: home })
    })

    const results = await t.withIdentity(carol).query(api.search.group, {
      groupSlug: 'search-shared-home',
      query: 'lasagne',
      accepts: ['recipe'],
    })
    expect(results.map((result) => result.title)).toEqual(['Club lasagne'])
  })

  test('reads only the asked Kind, so other tasting Modules cannot crowd it out', async () => {
    const t = testConvex()
    await t.run(async (ctx) => {
      const carolId = await ctx.db.insert('users', {
        clerkId: carol.subject,
        name: carol.name,
        email: carol.email,
      })
      const groupId = await seedGroup(ctx, {
        name: 'Tastings',
        slug: 'search-kinds',
        inviteCode: 'search-kinds',
      })
      await seedMember(ctx, groupId, carolId, 'admin')
      for (let index = 0; index < 40; index += 1)
        await ctx.db.insert('tastingSubjects', {
          groupId,
          kind: 'beer',
          name: `Rouge beer ${index}`,
          attributes: {},
          createdByUserId: carolId,
        })
      await ctx.db.insert('tastingSubjects', {
        groupId,
        kind: 'wine',
        name: 'Rouge wine',
        attributes: {},
        createdByUserId: carolId,
      })
    })

    const asCarol = t.withIdentity(carol)
    const mixed = await asCarol.query(api.search.group, {
      groupSlug: 'search-kinds',
      query: 'rouge',
      accepts: ['tasting'],
    })
    expect(mixed).toHaveLength(30)

    const wines = await asCarol.query(api.search.group, {
      groupSlug: 'search-kinds',
      query: 'rouge',
      accepts: ['tasting'],
      kind: 'wine',
    })
    expect(wines).toMatchObject([{ title: 'Rouge wine', kind: 'wine' }])
  })

  test('reads newest first, so a recent match past the budget is found', async () => {
    const t = testConvex()
    await t.run(async (ctx) => {
      const carolId = await ctx.db.insert('users', {
        clerkId: carol.subject,
        name: carol.name,
        email: carol.email,
      })
      const groupId = await seedGroup(ctx, {
        name: 'Notes',
        slug: 'search-many-notes',
        inviteCode: 'search-many-notes',
      })
      await seedMember(ctx, groupId, carolId, 'admin')
      for (let index = 0; index < 220; index += 1)
        await ctx.db.insert('notes', {
          groupId,
          title: `Note ${index}`,
          body: '',
          createdBy: carolId,
          updatedAt: 1,
        })
      await ctx.db.insert('notes', {
        groupId,
        title: 'Boiler manual',
        body: '',
        createdBy: carolId,
        updatedAt: 1,
      })
    })

    const results = await t.withIdentity(carol).query(api.search.group, {
      groupSlug: 'search-many-notes',
      query: 'boiler',
      accepts: ['note'],
    })
    expect(results.map((result) => result.title)).toEqual(['Boiler manual'])
  })
})

describe('Group search for notes (APP-348)', () => {
  const erin = {
    subject: 'search_erin',
    name: 'Erin',
    email: 'search-erin@example.com',
  }

  test('finds the oldest of many notes, in this Group only, with words apart', async () => {
    const t = testConvex()
    await t.run(async (ctx) => {
      const erinId = await ctx.db.insert('users', {
        clerkId: erin.subject,
        name: erin.name,
        email: erin.email,
      })
      const groupId = await seedGroup(ctx, {
        name: 'Notes',
        slug: 'search-old-notes',
        inviteCode: 'search-old-notes',
      })
      const otherGroupId = await seedGroup(ctx, {
        name: 'Other notes',
        slug: 'search-other-notes',
        inviteCode: 'search-other-notes',
      })
      await seedMember(ctx, groupId, erinId, 'admin')
      await seedMember(ctx, otherGroupId, erinId, 'admin')
      const note = { body: '', createdBy: erinId, updatedAt: 1 }
      await ctx.db.insert('notes', { ...note, groupId, title: 'Boiler: manual' })
      await ctx.db.insert('notes', {
        ...note,
        groupId: otherGroupId,
        title: 'Boiler manual elsewhere',
      })
      for (let index = 0; index < 220; index += 1)
        await ctx.db.insert('notes', { ...note, groupId, title: `Note ${index}` })
    })

    const results = await t.withIdentity(erin).query(api.search.group, {
      groupSlug: 'search-old-notes',
      query: 'manual boiler',
      accepts: ['note'],
    })
    expect(results.map((result) => result.title)).toEqual(['Boiler: manual'])
  })
})

describe('Group search for notes inside words (APP-702)', () => {
  const frank = {
    subject: 'search_frank',
    name: 'Frank',
    email: 'search-frank@example.com',
  }

  test('finds a word inside a compound and in Thai and Hindi, like the other types', async () => {
    const t = testConvex()
    await t.run(async (ctx) => {
      const frankId = await ctx.db.insert('users', {
        clerkId: frank.subject,
        name: frank.name,
        email: frank.email,
      })
      const groupId = await seedGroup(ctx, {
        name: 'Inside',
        slug: 'search-inside-words',
        inviteCode: 'search-inside-words',
      })
      await seedMember(ctx, groupId, frankId, 'admin')
      const note = { groupId, createdBy: frankId, updatedAt: 1 }
      await ctx.db.insert('notes', { ...note, title: 'Menu', body: 'De wijnkaart' })
      await ctx.db.insert('notes', { ...note, title: 'Talen', body: 'ภาษาไทย हिन्दी' })
    })
    const titles = async (query: string) =>
      (
        await t.withIdentity(frank).query(api.search.group, {
          groupSlug: 'search-inside-words',
          query,
          accepts: ['note'],
        })
      ).map((result) => result.title)

    expect(await titles('kaart')).toEqual(['Menu'])
    expect(await titles('wijn kaart')).toEqual(['Menu'])
    expect(await titles('ภาษาไทย')).toEqual(['Talen'])
    expect(await titles('हिन्दी')).toEqual(['Talen'])
  })
})

describe('Group search recipe budget', () => {
  const dan = {
    subject: 'search_dan',
    name: 'Dan',
    email: 'search-dan@example.com',
  }

  test('a Group with no shares keeps the whole recipe budget for its own', async () => {
    const t = testConvex()
    await t.run(async (ctx) => {
      const danId = await ctx.db.insert('users', {
        clerkId: dan.subject,
        name: dan.name,
        email: dan.email,
      })
      const groupId = await seedGroup(ctx, {
        name: 'Kitchen',
        slug: 'search-recipe-budget',
        inviteCode: 'search-recipe-budget',
      })
      await seedMember(ctx, groupId, danId, 'admin')
      const recipe = {
        groupId,
        sharedGroupIds: [],
        createdByUserId: danId,
        ingredients: [],
        steps: [],
        tags: [],
      }
      await ctx.db.insert('recipes', { ...recipe, title: 'Oldest pie' })
      for (let index = 0; index < 199; index += 1)
        await ctx.db.insert('recipes', { ...recipe, title: `Recipe ${index}` })
    })

    const results = await t.withIdentity(dan).query(api.search.group, {
      groupSlug: 'search-recipe-budget',
      query: 'oldest',
      accepts: ['recipe'],
    })
    expect(results.map((result) => result.title)).toEqual(['Oldest pie'])
  })
})

describe('Group search server filters (APP-633)', () => {
  const eve = {
    subject: 'search_eve',
    name: 'Eve',
    email: 'search-eve@example.com',
  }
  const slug = 'search-server-filters'
  const TODAY = '2026-11-25' // a Wednesday
  const accepts = ['task', 'note', 'calendarEvent'] as ('task' | 'note' | 'calendarEvent')[]

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  /** Eve and Sam's Group, with `insert` to add a row at a moment. */
  async function household() {
    const t = testConvex()
    vi.setSystemTime('2026-01-01T12:00:00Z')
    const ids = await t.run(async (ctx) => {
      const eveId = await ctx.db.insert('users', {
        clerkId: eve.subject,
        name: eve.name,
        email: eve.email,
      })
      const samId = await ctx.db.insert('users', {
        clerkId: 'search_sam',
        name: 'Sam',
        email: 'search-sam@example.com',
      })
      const groupId = await seedGroup(ctx, { name: 'Home', slug })
      await seedMember(ctx, groupId, eveId, 'admin')
      await seedMember(ctx, groupId, samId)
      const listId = await ctx.db.insert('taskLists', {
        groupId,
        name: 'Chores',
        provider: 'local',
        order: 0,
      })
      const calendarId = await ctx.db.insert('calendars', {
        groupId,
        name: 'Family',
        source: 'local',
        createdBy: eveId,
      })
      return { eveId, samId, groupId, listId, calendarId }
    })
    const note = async (title: string, at: string, by = ids.eveId) => {
      vi.setSystemTime(at)
      await t.run(async (ctx) => {
        await ctx.db.insert('notes', {
          groupId: ids.groupId,
          title,
          body: '',
          createdBy: by,
          updatedAt: Date.now(),
        })
      })
    }
    const task = async (
      title: string,
      fields: { dueDate?: string; done?: boolean } = {},
    ) => {
      await t.run(async (ctx) => {
        await ctx.db.insert('tasks', {
          listId: ids.listId,
          title,
          done: false,
          order: 0,
          createdBy: ids.eveId,
          ...fields,
        })
      })
    }
    const search = async (filters: {
      createdBy?: string
      when?: 'today' | 'week' | 'month' | 'earlier'
      status?: 'open' | 'done'
      today?: string
      timeZone?: string
    }) =>
      (
        await t.withIdentity(eve).query(api.search.group, {
          groupSlug: slug,
          query: 'milk',
          accepts,
          ...filters,
        })
      )
        .map((row) => row.title)
        .sort()
    return { t, ...ids, note, task, search }
  }

  test('finds the older matches that 30 newer ones crowd out', async () => {
    const { note, search, samId } = await household()
    await note('milk old Sam', '2026-10-02T12:00:00Z', samId)
    await note('milk old Eve', '2026-10-03T12:00:00Z')
    for (let index = 0; index < 35; index += 1)
      await note(`milk ${index}`, '2026-11-24T12:00:00Z')

    const plain = await search({})
    expect(plain).toHaveLength(30)
    expect(plain).not.toContain('milk old Sam')

    const when = { when: 'earlier', today: TODAY, timeZone: 'Europe/Amsterdam' } as const
    expect(await search(when)).toEqual(['milk old Eve', 'milk old Sam'])
    expect(await search({ createdBy: samId })).toEqual(['milk old Sam'])
    expect(await search({ ...when, createdBy: samId })).toEqual(['milk old Sam'])
  })

  test('a filtered search still returns at most 30 rows', async () => {
    const { note, search, eveId } = await household()
    for (let index = 0; index < 35; index += 1)
      await note(`milk ${index}`, '2026-11-24T12:00:00Z')
    expect(await search({ createdBy: eveId })).toHaveLength(30)
  })

  test('Status narrows tasks before the limit and removes no other type', async () => {
    const { note, task, search } = await household()
    await note('milk note', '2026-11-01T12:00:00Z')
    await task('milk done', { done: true })
    for (let index = 0; index < 35; index += 1) await task(`milk ${index}`)

    expect(await search({})).not.toContain('milk done')
    expect(await search({ status: 'done' })).toEqual(['milk done', 'milk note'])
    expect(await search({ status: 'open' })).not.toContain('milk done')
  })

  test('When reads an event’s date, a task’s due date, else the day added', async () => {
    const { t, note, task, search, calendarId, eveId } = await household()
    const event = (title: string, date: string) =>
      t.run(async (ctx) => {
        await ctx.db.insert('calendarEvents', {
          calendarId,
          title,
          date,
          startMinutes: 540,
          endMinutes: 600,
          createdBy: eveId,
        })
      })
    // Oldest first: the harness never lets a creation time go back.
    vi.setSystemTime('2026-10-01T12:00:00Z')
    await task('milk task today', { dueDate: TODAY })
    await task('milk task undated')
    await event('milk event Sunday', '2026-11-29')
    await event('milk event next Monday', '2026-11-30')
    await event('milk event first', '2026-11-01')
    await note('milk note October', '2026-10-31T12:00:00Z')
    await note('milk note Monday', '2026-11-23T12:00:00Z')

    const when = (value: 'today' | 'week' | 'month' | 'earlier') =>
      search({ when: value, today: TODAY, timeZone: 'Europe/Amsterdam' })
    const week = ['milk event Sunday', 'milk note Monday', 'milk task today']
    expect(await when('today')).toEqual(['milk task today'])
    expect(await when('week')).toEqual(week)
    expect(await when('month')).toEqual(
      [...week, 'milk event first', 'milk event next Monday'].sort(),
    )
    expect(await when('earlier')).toEqual(['milk note October', 'milk task undated'])
  })

  test('the day added is the reader’s, not UTC’s', async () => {
    const { note, search } = await household()
    await note('milk late', '2026-11-24T23:30:00Z')
    const on = (today: string, timeZone?: string) =>
      search({ when: 'today', today, timeZone })
    expect(await on(TODAY, 'Europe/Amsterdam')).toEqual(['milk late'])
    expect(await on('2026-11-24', 'America/New_York')).toEqual(['milk late'])
    expect(await on(TODAY, 'America/New_York')).toEqual([])
    // Told nothing, it is the Netherlands' day.
    expect(await on(TODAY)).toEqual(['milk late'])
    expect(await search({ when: 'today' })).toEqual(['milk late'])
    // The zone alone also says which day today is.
    vi.setSystemTime('2026-11-25T06:30:00Z')
    expect(
      await search({ when: 'today', timeZone: 'America/Los_Angeles' }),
    ).toEqual(['milk late'])
  })

  test('refuses a day or a zone that does not exist', async () => {
    const { search } = await household()
    await expect(search({ when: 'today', today: '2026-02-31' })).rejects.toThrow('Invalid date')
    await expect(
      search({ when: 'today', today: TODAY, timeZone: 'Mars/Base' }),
    ).rejects.toThrow('Invalid time zone')
  })

  test('the filters open no Group to a non-member', async () => {
    const { t, eveId } = await household()
    const args = { groupSlug: slug, query: 'milk', createdBy: eveId }
    await expect(t.query(api.search.group, args)).rejects.toThrow()
    await expect(
      t
        .withIdentity({ subject: 'search_stranger' })
        .query(api.search.group, args),
    ).rejects.toThrow()
  })
})

describe('Group search past the newest rows (APP-758)', () => {
  const gail = {
    subject: 'search_gail',
    name: 'Gail',
    email: 'search-gail@example.com',
  }
  type Type = 'recipe' | 'tasting' | 'task' | 'calendarEvent'
  const TYPES: Type[] = ['recipe', 'tasting', 'task', 'calendarEvent']

  /** Two Groups of Gail's, each with a row of `title` older than the scan. */
  async function seedOld(type: Type) {
    const t = testConvex()
    await t.run(async (ctx) => {
      const gailId = await ctx.db.insert('users', {
        clerkId: gail.subject,
        name: gail.name,
        email: gail.email,
      })
      for (const [slug, suffix] of [
        ['search-old-home', ''],
        ['search-old-other', ' elsewhere'],
      ] as const) {
        const groupId = await seedGroup(ctx, {
          name: slug,
          slug,
          inviteCode: slug,
        })
        await seedMember(ctx, groupId, gailId, 'admin')
        const listId = await ctx.db.insert('taskLists', {
          groupId,
          name: 'Chores',
          provider: 'local',
          order: 0,
        })
        const calendarId = await ctx.db.insert('calendars', {
          groupId,
          name: 'Family',
          source: 'local',
          createdBy: gailId,
        })
        const add = async (title: string, kind: 'wine' | 'beer' = 'wine') => {
          if (type === 'recipe')
            await ctx.db.insert('recipes', {
              groupId,
              sharedGroupIds: [],
              createdByUserId: gailId,
              title,
              ingredients: [],
              steps: [],
              tags: [],
            })
          else if (type === 'tasting')
            await ctx.db.insert('tastingSubjects', {
              groupId,
              kind,
              name: title,
              attributes: {},
              createdByUserId: gailId,
            })
          else if (type === 'task')
            await ctx.db.insert('tasks', {
              listId,
              title,
              done: false,
              order: 0,
              createdBy: gailId,
            })
          else
            await ctx.db.insert('calendarEvents', {
              calendarId,
              title,
              date: '2026-01-01',
              createdBy: gailId,
            })
        }
        await add(`Oude wijnkaart: Boiler${suffix}`)
        const newer = type === 'recipe' || type === 'tasting' ? 200 : 50
        for (let index = 0; index < newer - 1; index += 1)
          await add(`Row ${index}`)
        await add('Nieuwe dranklijst', 'beer')
        if (type === 'recipe') await add('Nieuwe -- map')
      }
    })
    return async (query: string, kind?: 'wine' | 'beer') =>
      (
        await t.withIdentity(gail).query(api.search.group, {
          groupSlug: 'search-old-home',
          query,
          accepts: [type],
          kind,
        })
      ).map((row) => row.title)
  }

  test.each(TYPES)('finds an old %s by word, in this Group only', async (type) => {
    const search = await seedOld(type)
    const old = ['Oude wijnkaart: Boiler']
    expect(await search('boiler')).toEqual(old) // a whole word
    expect(await search('wijnk')).toEqual(old) // the start of the last one
    expect(await search('boiler oude')).toEqual(old) // every word, apart
    expect(await search('elsewhere')).toEqual([]) // another Group's
    expect(await search('boiler dranklijst')).toEqual([]) // not only one word
    // Inside a word only on the newest rows, as before.
    expect(await search('lijst')).toEqual(['Nieuwe dranklijst'])
    // Read by the scan and by the index, returned once.
    expect(await search('dranklijst')).toEqual(['Nieuwe dranklijst'])
  })

  test('narrows old tastings to the asked Kind', async () => {
    const search = await seedOld('tasting')
    expect(await search('boiler', 'wine')).toEqual(['Oude wijnkaart: Boiler'])
    expect(await search('boiler', 'beer')).toEqual([])
  })

  test('a search with no searchable word still scans', async () => {
    const search = await seedOld('recipe')
    expect(await search('--')).toEqual(['Nieuwe -- map'])
  })

  test('filters an old match and keeps the ranking', async () => {
    const t = testConvex()
    const samId = await t.run(async (ctx) => {
      const [gailId, samId] = await Promise.all([
        ctx.db.insert('users', {
          clerkId: gail.subject,
          name: gail.name,
          email: gail.email,
        }),
        ctx.db.insert('users', {
          clerkId: 'search_old_sam',
          name: 'Sam',
          email: 'search-old-sam@example.com',
        }),
      ])
      const slug = 'search-old-filters'
      const groupId = await seedGroup(ctx, { name: 'Home', slug })
      await seedMember(ctx, groupId, gailId, 'admin')
      const listId = await ctx.db.insert('taskLists', {
        groupId,
        name: 'Chores',
        provider: 'local',
        order: 0,
      })
      const task = { listId, order: 0, createdBy: gailId }
      await ctx.db.insert('tasks', {
        ...task,
        title: 'Milk',
        done: true,
        dueDate: '2020-03-01',
        createdBy: samId,
      })
      for (let index = 0; index < 60; index += 1)
        await ctx.db.insert('tasks', {
          ...task,
          title: `Buy milk ${index}`,
          done: false,
        })
      return samId
    })
    const search = async (filters: {
      createdBy?: string
      status?: 'open' | 'done'
      when?: 'today'
      today?: string
    }) =>
      (
        await t.withIdentity(gail).query(api.search.group, {
          groupSlug: 'search-old-filters',
          query: 'milk',
          accepts: ['task'],
          ...filters,
        })
      ).map((row) => row.title)

    const plain = await search({})
    expect(plain).toHaveLength(30)
    expect(plain[0]).toBe('Milk') // an exact title ranks first, however old
    expect(await search({ createdBy: samId })).toEqual(['Milk'])
    expect(await search({ status: 'done' })).toEqual(['Milk'])
    expect(await search({ status: 'open' })).not.toContain('Milk')
    expect(await search({ when: 'today', today: '2020-03-01' })).toEqual(['Milk'])
  })
})

describe('Group search filters inside the index reads (APP-787)', () => {
  const finn = {
    subject: 'search_finn',
    name: 'Finn',
    email: 'search-finn@example.com',
  }
  const slug = 'search-index-filters'
  type Type = 'recipe' | 'tasting' | 'task' | 'calendarEvent'
  const BUDGET: Record<Type, number> = {
    recipe: 100,
    tasting: 100,
    task: 50,
    calendarEvent: 50,
  }
  // The scan of the newest rows, which the wanted row must also be behind.
  const SCAN: Record<Type, number> = {
    recipe: 200,
    tasting: 200,
    task: 50,
    calendarEvent: 50,
  }
  const TYPES = Object.keys(BUDGET) as Type[]

  /**
   * `wanted` sits behind more than the index budget of Finn's older matches
   * (the test search returns ties oldest first, Convex newest first) and more
   * than the scan of newer rows. `wanted` is Sam's, and a task is done.
   */
  async function seed(type: Type) {
    const t = testConvex()
    const ids = await t.run(async (ctx) => {
      const user = (subject: string, name: string) =>
        ctx.db.insert('users', {
          clerkId: subject,
          name,
          email: `${subject}@example.com`,
        })
      const finnId = await user(finn.subject, finn.name)
      const samId = await user('search_finn_sam', 'Sam')
      const strangerId = await user('search_finn_stranger', 'Stranger')
      const groupId = await seedGroup(ctx, { name: 'Home', slug })
      const otherId = await seedGroup(ctx, {
        name: 'Other',
        slug: `${slug}-other`,
        inviteCode: `${slug}-other`,
      })
      for (const id of [groupId, otherId])
        for (const userId of [finnId, samId])
          await seedMember(ctx, id, userId, 'admin')
      const parents = async (id: typeof groupId) => ({
        groupId: id,
        listId: await ctx.db.insert('taskLists', {
          groupId: id,
          name: 'Chores',
          provider: 'local',
          order: 0,
        }),
        calendarId: await ctx.db.insert('calendars', {
          groupId: id,
          name: 'Family',
          source: 'local',
          createdBy: finnId,
        }),
      })
      const home = await parents(groupId)
      const other = await parents(otherId)
      const add = async (
        where: typeof home,
        title: string,
        by: typeof finnId,
        { done = false, kind = 'wine' as 'wine' | 'beer' } = {},
      ) => {
        if (type === 'recipe')
          await ctx.db.insert('recipes', {
            groupId: where.groupId,
            sharedGroupIds: [],
            createdByUserId: by,
            title,
            ingredients: [],
            steps: [],
            tags: [],
          })
        else if (type === 'tasting')
          await ctx.db.insert('tastingSubjects', {
            groupId: where.groupId,
            kind,
            name: title,
            attributes: {},
            createdByUserId: by,
          })
        else if (type === 'task')
          await ctx.db.insert('tasks', {
            listId: where.listId,
            title,
            done,
            order: 0,
            createdBy: by,
          })
        else
          await ctx.db.insert('calendarEvents', {
            calendarId: where.calendarId,
            title,
            date: '2026-01-01',
            createdBy: by,
          })
      }
      for (let index = 0; index < BUDGET[type] + 5; index += 1)
        await add(home, `Cocoa ${index}`, finnId)
      await add(home, 'Wanted cocoa', samId, { done: true })
      await add(home, 'Beer cocoa', samId, { done: true, kind: 'beer' })
      await add(home, 'Stranger cocoa', strangerId)
      await add(other, 'Elsewhere cocoa', samId, { done: true })
      for (let index = 0; index < SCAN[type]; index += 1)
        await add(home, `Row ${index}`, finnId)
      return { finnId, samId, strangerId, groupId }
    })
    const search = async (filters: {
      createdBy?: string
      status?: 'open' | 'done'
      kind?: 'wine' | 'beer'
    }) =>
      (
        await t.withIdentity(finn).query(api.search.group, {
          groupSlug: slug,
          query: 'cocoa',
          accepts: [type],
          ...filters,
        })
      ).map((row) => row.title)
    return { search, ...ids }
  }

  test.each(TYPES)(
    "Who finds a Member's old %s behind the index budget, in this Group only",
    async (type) => {
      const { search, samId } = await seed(type)
      expect((await search({ createdBy: samId })).sort()).toEqual([
        'Beer cocoa',
        'Wanted cocoa',
      ])
    },
  )

  test.each(TYPES)('without a filter the %s rows stay as read', async (type) => {
    const { search } = await seed(type)
    const rows = await search({})
    expect(rows).toHaveLength(30)
    expect(rows).not.toContain('Wanted cocoa')
  })

  test.each(TYPES)('an unusable Who finds no %s and does not throw', async (type) => {
    const { search, groupId, strangerId } = await seed(type)
    for (const createdBy of ['nobody', groupId, strangerId])
      expect(await search({ createdBy })).toEqual([])
    // An empty one is no filter, as before.
    expect(await search({ createdBy: '' })).toHaveLength(30)
  })

  test('Who and Kind narrow tastings together', async () => {
    const { search, samId } = await seed('tasting')
    expect(await search({ createdBy: samId, kind: 'wine' })).toEqual([
      'Wanted cocoa',
    ])
  })

  test('Status finds an old done task behind the index budget', async () => {
    const { search, samId, finnId } = await seed('task')
    const done = ['Beer cocoa', 'Wanted cocoa']
    expect((await search({ status: 'done' })).sort()).toEqual(done)
    expect((await search({ status: 'done', createdBy: samId })).sort()).toEqual(
      done,
    )
    expect(await search({ status: 'done', createdBy: finnId })).toEqual([])
    expect(await search({ status: 'open', createdBy: samId })).toEqual([])
  })

  test('Status finds an old open task behind the index budget', async () => {
    const t = await openBehindDone()
    const rows = await t.withIdentity(finn).query(api.search.group, {
      groupSlug: slug,
      query: 'cocoa',
      accepts: ['task'],
      status: 'open',
    })
    expect(rows.map((row) => row.title)).toEqual(['Wanted cocoa'])
  })

  async function openBehindDone() {
    const t = testConvex()
    await t.run(async (ctx) => {
      const finnId = await ctx.db.insert('users', {
        clerkId: finn.subject,
        name: finn.name,
        email: finn.email,
      })
      const groupId = await seedGroup(ctx, { name: 'Home', slug })
      await seedMember(ctx, groupId, finnId, 'admin')
      const listId = await ctx.db.insert('taskLists', {
        groupId,
        name: 'Chores',
        provider: 'local',
        order: 0,
      })
      const task = { listId, order: 0, createdBy: finnId }
      for (let index = 0; index < 55; index += 1)
        await ctx.db.insert('tasks', { ...task, title: `Cocoa ${index}`, done: true })
      await ctx.db.insert('tasks', { ...task, title: 'Wanted cocoa', done: false })
      for (let index = 0; index < 50; index += 1)
        await ctx.db.insert('tasks', { ...task, title: `Row ${index}`, done: true })
    })
    return t
  }
})
