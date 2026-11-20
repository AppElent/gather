import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  alice,
  bob,
  seedGroup,
  seedMember,
  testConvex,
} from '../test/convexHarness'
import { api, internal } from './_generated/api'
import { DAILY_AI_CALLS } from './lib/aiUsage'

/**
 * A recipe's ingredients onto a grocery list (APP-312): merged into what is
 * already there, the rest added with their aisle and the recipe as the note;
 * and the AI fallback for the lines the phone could not read, counted against
 * the person's daily cap.
 */

const SLUG = 'jansen'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

async function seed() {
  const t = testConvex()
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', {
      clerkId: alice.subject,
      name: alice.name,
      email: alice.email,
    })
    const groupId = await seedGroup(ctx, { name: SLUG, slug: SLUG })
    await seedMember(ctx, groupId, userId, 'admin')
    const groceries = await ctx.db.insert('taskLists', {
      groupId,
      name: 'Boodschappen',
      provider: 'local',
      order: 0,
    })
    const chores = await ctx.db.insert('taskLists', {
      groupId,
      name: 'Klusjes',
      provider: 'local',
      order: 1,
    })
    await ctx.db.patch(groupId, { groceryListId: groceries })
    const eggs = await ctx.db.insert('tasks', {
      listId: groceries,
      title: 'Eieren',
      done: false,
      createdBy: userId,
      order: 0,
      quantity: 10,
      category: 'dairy',
    })
    const onions = await ctx.db.insert('tasks', {
      listId: groceries,
      title: 'ui',
      done: false,
      createdBy: userId,
      order: 1,
      notes: 'De rode',
    })
    const boughtFeta = await ctx.db.insert('tasks', {
      listId: groceries,
      title: 'Feta',
      done: true,
      createdBy: userId,
      order: 2,
    })
    return { groceries, chores, eggs, onions, boughtFeta }
  })
  return { t, as: t.withIdentity(alice), ...ids }
}

describe('groceryLines.add', () => {
  test('merges into open items with the same name, and adds the rest', async () => {
    const { t, as, groceries, eggs, onions } = await seed()
    const result = await as.mutation(api.groceryLines.add, {
      groupSlug: SLUG,
      listId: groceries,
      source: 'Shakshuka met feta',
      lines: [
        { title: 'Eieren', quantity: 6 },
        { title: 'Ui', quantity: 1 },
        { title: 'Feta', quantity: 200, unit: 'g' },
        { title: 'Tomatenblokjes', quantity: 2, unit: 'blik' },
      ],
    })
    expect(result).toEqual({ added: 2, merged: 2, covered: 0 })

    const rows = await t.run((ctx) =>
      ctx.db
        .query('tasks')
        .withIndex('by_list', (q) => q.eq('listId', groceries))
        .collect(),
    )
    const byTitle = (title: string, done = false) =>
      rows.find((row) => row.title === title && row.done === done)
    // 10 eggs and 6 more, with the recipe as the note it did not have.
    expect(rows.find((row) => row._id === eggs)).toMatchObject({
      quantity: 16,
      notes: 'Shakshuka met feta',
    })
    // A note someone wrote stays theirs.
    expect(rows.find((row) => row._id === onions)).toMatchObject({
      quantity: 2,
      notes: 'De rode',
    })
    // The checked feta was bought: a new one goes on the list.
    expect(byTitle('Feta')).toMatchObject({
      quantity: 200,
      unit: 'g',
      notes: 'Shakshuka met feta',
      category: 'cheese_deli',
    })
    expect(byTitle('Tomatenblokjes')).toMatchObject({
      quantity: 2,
      unit: 'blik',
      category: 'tins_sauces',
      order: 4,
    })
    expect(rows).toHaveLength(5)
  })

  test('the week menu tops up: a second run for the same week adds nothing', async () => {
    const { t, as, groceries, eggs, onions } = await seed()
    const week = {
      groupSlug: SLUG,
      listId: groceries,
      source: 'Weekmenu 23 tot 29 november',
      lines: [
        // 10 eggs are on the list: the week's 12 make it 12, not 22.
        { title: 'Eieren', quantity: 12, topUp: true, source: 'Shakshuka di, Omelet do' },
        // "ui" has no amount, so it is one: the week's 2 make it 2.
        { title: 'Ui', quantity: 2, topUp: true, source: 'Shakshuka · di' },
        { title: 'Feta', quantity: 200, unit: 'g' as const, topUp: true, source: 'Shakshuka · di' },
      ],
    }
    expect(await as.mutation(api.groceryLines.add, week)).toEqual({ added: 1, merged: 2, covered: 0 })
    const after = await t.run((ctx) =>
      ctx.db
        .query('tasks')
        .withIndex('by_list', (q) => q.eq('listId', groceries))
        .collect(),
    )
    expect(after.find((row) => row._id === eggs)).toMatchObject({
      quantity: 12,
      notes: 'Shakshuka di, Omelet do',
    })
    expect(after.find((row) => row._id === onions)).toMatchObject({ quantity: 2, notes: 'De rode' })
    expect(after.find((row) => row.title === 'Feta' && !row.done)).toMatchObject({
      quantity: 200,
      unit: 'g',
      notes: 'Shakshuka · di',
    })

    // The same week again: everything is there already.
    expect(await as.mutation(api.groceryLines.add, week)).toEqual({ added: 0, merged: 0, covered: 3 })
    const again = await t.run((ctx) =>
      ctx.db
        .query('tasks')
        .withIndex('by_list', (q) => q.eq('listId', groceries))
        .collect(),
    )
    expect(again).toEqual(after)
  })

  test('a name twice in one add is one item', async () => {
    const { t, as, groceries } = await seed()
    await as.mutation(api.groceryLines.add, {
      groupSlug: SLUG,
      listId: groceries,
      lines: [
        { title: 'Melk', quantity: 500, unit: 'ml' },
        { title: 'melk', quantity: 1, unit: 'l' },
      ],
    })
    const milk = await t.run((ctx) =>
      ctx.db
        .query('tasks')
        .withIndex('by_list', (q) => q.eq('listId', groceries))
        .filter((q) => q.eq(q.field('title'), 'Melk'))
        .collect(),
    )
    expect(milk).toHaveLength(1)
    expect(milk[0]).toMatchObject({ quantity: 1500, unit: 'ml' })
  })

  test('refuses a list that is not a grocery list', async () => {
    const { as, chores } = await seed()
    await expect(
      as.mutation(api.groceryLines.add, {
        groupSlug: SLUG,
        listId: chores,
        lines: [{ title: 'Eieren' }],
      }),
    ).rejects.toThrow('This is not a grocery list')
  })

  test('refuses an amount out of bounds', async () => {
    const { as, groceries } = await seed()
    await expect(
      as.mutation(api.groceryLines.add, {
        groupSlug: SLUG,
        listId: groceries,
        lines: [{ title: 'Eieren', quantity: -1 }],
      }),
    ).rejects.toThrow('That is not an amount')
  })

  test('refuses someone outside the Group', async () => {
    const { t, groceries } = await seed()
    await t.withIdentity(bob).mutation(api.users.ensureUser, {})
    await expect(
      t.withIdentity(bob).mutation(api.groceryLines.add, {
        groupSlug: SLUG,
        listId: groceries,
        lines: [{ title: 'Eieren' }],
      }),
    ).rejects.toThrow()
  })
})

function aiReply(items: unknown[]) {
  return {
    ok: true,
    json: async () => ({
      content: [
        { type: 'tool_use', name: 'read_grocery_lines', input: { items } },
      ],
    }),
  }
}

describe('groceryLines.aisles', () => {
  test('answers like the list: the Group’s override, the list’s history, then the dictionary', async () => {
    const { t, as, groceries } = await seed()
    await t.run(async (ctx) => {
      const group = await ctx.db
        .query('groups')
        .withIndex('by_slug', (q) => q.eq('slug', SLUG))
        .unique()
      const user = await ctx.db.query('users').first()
      if (!group || !user) throw new Error('seed')
      // The Group files "Penne" under snacks, whatever the dictionary says.
      await ctx.db.insert('groceryCategoryOverrides', {
        groupId: group._id,
        name: 'penne',
        aisle: 'snacks',
        updatedBy: user._id,
        updatedAt: 0,
      })
      // The list's history: "Doenjang" was last put under tins_sauces.
      await ctx.db.insert('tasks', {
        listId: groceries,
        title: 'Doenjang',
        done: true,
        createdBy: user._id,
        order: 9,
        category: 'tins_sauces',
      })
    })
    const aisles = await as.query(api.groceryLines.aisles, {
      groupSlug: SLUG,
      listId: groceries,
      titles: ['Penne', 'Doenjang', 'Eieren', 'Zzqxv'],
    })
    expect(aisles).toEqual(['snacks', 'tins_sauces', 'dairy', 'other'])
  })

  test('refuses a list that is not a grocery list, and someone outside the Group', async () => {
    const { t, as, chores, groceries } = await seed()
    await expect(
      as.query(api.groceryLines.aisles, {
        groupSlug: SLUG,
        listId: chores,
        titles: ['Eieren'],
      }),
    ).rejects.toThrow()
    await t.withIdentity(bob).mutation(api.users.ensureUser, {})
    await expect(
      t.withIdentity(bob).query(api.groceryLines.aisles, {
        groupSlug: SLUG,
        listId: groceries,
        titles: ['Eieren'],
      }),
    ).rejects.toThrow()
    await expect(
      t.query(api.groceryLines.aisles, {
        groupSlug: SLUG,
        listId: groceries,
        titles: ['Eieren'],
      }),
    ).rejects.toThrow()
  })
})

describe('groceryLines.read', () => {
  async function signedUp() {
    const t = testConvex()
    await t.withIdentity(alice).mutation(api.users.ensureUser, {})
    return t
  }

  test('reads the lines in one call and says how many calls today used', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    const fetchMock = vi.fn().mockResolvedValue(
      aiReply([
        { index: 1, name: 'citroen', quantity: 1 },
        { index: 2, name: 'basilicum', quantity: 1, unit: 'bos' },
        { index: 9, name: 'nothing' },
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)
    const t = await signedUp()

    const result = await t
      .withIdentity(alice)
      .action(api.groceryLines.read, {
        lines: ['sap van 1 citroen', 'een handje basilicum', 'iets vreemds'],
      })
    expect(result).toEqual({
      status: 'read',
      used: 1,
      limit: DAILY_AI_CALLS,
      lines: [
        { name: 'Citroen', quantity: 1 },
        { name: 'Basilicum', quantity: 1, unit: 'bos' },
        null,
      ],
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  test('over the cap the provider is not reached', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const t = await signedUp()
    for (let i = 0; i < DAILY_AI_CALLS; i++)
      await t.mutation(internal.aiUsage.take, { clerkId: alice.subject })

    const result = await t
      .withIdentity(alice)
      .action(api.groceryLines.read, { lines: ['sap van 1 citroen'] })
    expect(result).toEqual({ status: 'limit', limit: DAILY_AI_CALLS })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('without a key, or without an answer, nothing is read', async () => {
    const t = await signedUp()
    expect(
      await t
        .withIdentity(alice)
        .action(api.groceryLines.read, { lines: ['sap van 1 citroen'] }),
    ).toEqual({ status: 'unavailable' })

    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    expect(
      await t
        .withIdentity(alice)
        .action(api.groceryLines.read, { lines: ['sap van 1 citroen'] }),
    ).toEqual({ status: 'unavailable' })
  })
})
