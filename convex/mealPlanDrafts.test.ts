import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  alice,
  bob,
  carol,
  seedGroup,
  seedMember,
  testConvex,
} from '../test/convexHarness'
import { api, internal } from './_generated/api'
import { DAILY_AI_CALLS } from './lib/aiUsage'
import { CONNECTED_APP_REFUSED } from './lib/connectedApps'

/**
 * Plan mijn week (APP-319): one AI call per plan against the daily cap, only
 * recipe ids the model was given, a rules-only fallback that costs nothing,
 * and drafts per Group and week that never overwrite a planned meal and
 * expire after 24 hours.
 */

const WEEK_START = '2026-11-23'
const WEEK = { groupSlug: 'home', weekStart: WEEK_START }
const MON_TO_FRI = ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27']
const PLAN = {
  groupSlug: 'home',
  weekStart: WEEK_START,
  dates: MON_TO_FRI,
  slots: ['dinner' as const],
  locale: 'nl' as const,
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

async function seed() {
  const t = testConvex()
  const ids = await t.run(async (ctx) => {
    const user = (who: typeof alice) =>
      ctx.db.insert('users', {
        clerkId: who.subject,
        name: who.name,
        email: who.email,
      })
    const aliceId = await user(alice)
    const bobId = await user(bob)
    const carolId = await user(carol)
    const home = await seedGroup(ctx, { name: 'Home', slug: 'home', inviteCode: 'home' })
    const other = await seedGroup(ctx, { name: 'Other', slug: 'other', inviteCode: 'other' })
    await seedMember(ctx, home, aliceId, 'admin')
    await seedMember(ctx, home, bobId, 'member')
    await seedMember(ctx, other, carolId, 'admin')
    const recipe = (
      groupId: typeof home,
      title: string,
      prepMinutes: number,
      rating: number,
      ingredients: string[] = ['rijst', 'ui'],
    ) =>
      ctx.db.insert('recipes', {
        groupId,
        sharedGroupIds: [],
        createdByUserId: aliceId,
        title,
        ingredients,
        steps: [],
        tags: [],
        prepMinutes,
        rating,
      })
    const pasta = await recipe(home, 'Pasta pesto', 25, 4)
    const tacos = await recipe(home, 'Tacos met kip', 30, 5)
    const gnocchi = await recipe(home, 'Gnocchi met spinazie', 20, 3, ['gnocchi', 'spinazie'])
    const curry = await recipe(home, 'Curry', 30, 3)
    const soup = await recipe(home, 'Soep', 20, 2)
    const foreign = await recipe(other, 'Foreign soup', 20, 5)
    const toast = await ctx.db.insert('mealEntries', {
      groupId: home,
      title: 'Tosti',
      prepMinutes: 10,
      createdBy: aliceId,
    })
    // Monday is planned: the plan must leave it alone.
    await ctx.db.insert('plannedDinners', {
      groupId: home,
      date: '2026-11-23',
      slot: 'dinner',
      recipeId: pasta,
      title: 'Pasta pesto',
      prepMinutes: 25,
    })
    await ctx.db.insert('groceryStaples', {
      groupId: home,
      name: 'Spinazie',
      key: 'spinazie',
      aisle: 'produce',
      low: true,
      createdBy: aliceId,
    })
    return { aliceId, home, pasta, tacos, gnocchi, curry, soup, foreign, toast }
  })
  return { t, as: t.withIdentity(alice), ...ids }
}

function aiReply(meals: unknown[]) {
  return {
    ok: true,
    json: async () => ({
      content: [{ type: 'tool_use', name: 'propose_week_plan', input: { meals } }],
    }),
  }
}

async function usedToday(t: Awaited<ReturnType<typeof seed>>['t']) {
  return (await t.withIdentity(alice).query(api.aiUsage.today, {})).used
}

describe('mealPlanDrafts.propose', () => {
  test('a valid plan becomes drafts for the empty slots, one call counted', async () => {
    const { t, as, tacos, foreign, gnocchi } = await seed()
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    const fetchMock = vi.fn().mockResolvedValue(
      aiReply([
        { date: '2026-11-24', slot: 'dinner', recipeId: tacos, reason: 'Hoog beoordeeld' },
        { date: '2026-11-25', slot: 'dinner', quickMeal: 'Tosti', reason: 'Zwemles, dus snel' },
        { date: '2026-11-26', slot: 'dinner', recipeId: gnocchi, reason: 'Spinazie in huis' },
        // Invented, from another Group, and a slot nobody asked for: dropped.
        { date: '2026-11-27', slot: 'dinner', recipeId: 'k57invented000000000000000000000', reason: 'x' },
        { date: '2026-11-27', slot: 'dinner', recipeId: foreign, reason: 'x' },
        { date: '2026-11-23', slot: 'dinner', recipeId: tacos, reason: 'over Monday' },
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await as.action(api.mealPlanDrafts.propose, PLAN)
    expect(result).toEqual({ status: 'ai', count: 4, left: DAILY_AI_CALLS - 1, limit: DAILY_AI_CALLS })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(await usedToday(t)).toBe(1)

    const drafts = await as.query(api.mealPlanDrafts.list, WEEK)
    expect(drafts.map((d) => [d.date, d.title, d.source])).toEqual([
      ['2026-11-24', 'Tacos met kip', 'ai'],
      ['2026-11-25', 'Tosti', 'ai'],
      ['2026-11-26', 'Gnocchi met spinazie', 'ai'],
      // The rules fill Friday with a recipe of the Group, never the foreign one.
      ['2026-11-27', 'Curry', 'rules'],
    ])
    expect(drafts[0].reason).toBe('Hoog beoordeeld')
    expect(drafts.some((d) => d.recipeId === foreign)).toBe(false)

    // Monday kept its meal; drafts are not meals for older phones.
    const week = await as.query(api.mealPlan.week, { groupSlug: 'home', from: WEEK_START, to: '2026-11-29' })
    expect(week.meals.map((m) => [m.date, m.title])).toEqual([['2026-11-23', 'Pasta pesto']])
  })

  test('the prompt carries recipes and the week, not names or event titles', async () => {
    const { t, as, home, aliceId } = await seed()
    await t.run(async (ctx) => {
      const calendar = await ctx.db.insert('calendars', {
        groupId: home,
        name: 'Gezin',
        source: 'local',
        createdBy: aliceId,
      })
      await ctx.db.insert('calendarEvents', {
        calendarId: calendar,
        title: 'Zwemles Noor',
        date: '2026-11-25',
        startMinutes: 18 * 60,
        createdBy: aliceId,
      })
    })
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    const fetchMock = vi.fn().mockResolvedValue(aiReply([]))
    vi.stubGlobal('fetch', fetchMock)
    await as.action(api.mealPlanDrafts.propose, { ...PLAN, wish: 'veel groente' })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    const prompt: string = body.messages[0].content
    expect(prompt).toContain('Tacos met kip')
    expect(prompt).toContain('busy evening from 18:00')
    expect(prompt).toContain('max 20 min')
    expect(prompt).toContain('veel groente')
    expect(prompt).toContain('Running low: Spinazie')
    expect(prompt).not.toContain('Zwemles')
    expect(prompt).not.toContain(alice.name)
    expect(prompt).not.toContain('Foreign soup')
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'propose_week_plan' })
  })

  test('over the cap nothing is planned and the model is not asked', async () => {
    const { t, as } = await seed()
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    for (let i = 0; i < DAILY_AI_CALLS; i++)
      await t.mutation(internal.aiUsage.take, { clerkId: alice.subject })

    expect(await as.action(api.mealPlanDrafts.propose, PLAN)).toEqual({
      status: 'limit',
      limit: DAILY_AI_CALLS,
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await as.query(api.mealPlanDrafts.list, WEEK)).toEqual([])
    expect(await as.query(api.aiUsage.today, {})).toEqual({ used: DAILY_AI_CALLS, left: 0, limit: DAILY_AI_CALLS })
  })

  test('when the model fails, the rules plan and the call is given back', async () => {
    const { t, as } = await seed()
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    const result = await as.action(api.mealPlanDrafts.propose, PLAN)
    expect(result).toMatchObject({ status: 'fallback', count: 4, left: DAILY_AI_CALLS })
    expect(await usedToday(t)).toBe(0)
    const drafts = await as.query(api.mealPlanDrafts.list, WEEK)
    expect(drafts.every((d) => d.source === 'fallback' && d.reason === undefined)).toBe(true)
    expect(drafts.map((d) => d.date)).toEqual(MON_TO_FRI.slice(1))
    // The rules never repeat a recipe in the week, Monday's pasta included.
    const titles = drafts.map((d) => d.title)
    expect(new Set(titles).size).toBe(titles.length)
    expect(titles).not.toContain('Pasta pesto')
  })

  test('a reached model with an unusable answer is counted; the rules fill', async () => {
    const { t, as } = await seed()
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ content: [{ type: 'text', text: 'Sorry' }] }) }),
    )
    const result = await as.action(api.mealPlanDrafts.propose, PLAN)
    expect(result).toMatchObject({ count: 4, left: DAILY_AI_CALLS - 1 })
    expect(await usedToday(t)).toBe(1)
    const drafts = await as.query(api.mealPlanDrafts.list, WEEK)
    expect(drafts.every((d) => d.source === 'rules')).toBe(true)
  })

  test('a quick meal the model names that may hold an allergen is dropped; the rules fill', async () => {
    const { t, as, aliceId, home } = await seed()
    await t.run((ctx) =>
      ctx.db.insert('mealPreferences', {
        groupId: home,
        allergens: ['crustaceans'],
        updatedBy: aliceId,
        updatedAt: Date.now(),
      }),
    )
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        aiReply([
          // Certainly shellfish: dropped.
          { date: '2026-11-24', slot: 'dinner', quickMeal: 'Pasta met garnalen', minutes: 15, reason: 'Snel' },
          // The Group's own quick meal: kept.
          { date: '2026-11-25', slot: 'dinner', quickMeal: 'Tosti', reason: 'Snel' },
          // Made up, and a name can't rule shellfish out: dropped.
          { date: '2026-11-26', slot: 'dinner', quickMeal: 'Wraps met hummus', minutes: 15, reason: 'Snel' },
        ]),
      ),
    )
    const result = await as.action(api.mealPlanDrafts.propose, PLAN)
    expect(result).toMatchObject({ status: 'ai', count: 4 })
    const drafts = await as.query(api.mealPlanDrafts.list, WEEK)
    const byDate = new Map(drafts.map((d) => [d.date, d]))
    expect(byDate.get('2026-11-24')).toMatchObject({ source: 'rules' })
    expect(byDate.get('2026-11-24')?.recipeId).toBeDefined()
    expect(byDate.get('2026-11-25')).toMatchObject({ source: 'ai', title: 'Tosti' })
    expect(byDate.get('2026-11-26')).toMatchObject({ source: 'rules' })
    const titles = drafts.map((d) => d.title)
    expect(titles).not.toContain('Pasta met garnalen')
    expect(titles).not.toContain('Wraps met hummus')
  })

  test('a clean quick meal the model names is kept', async () => {
    const { as } = await seed()
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        aiReply([{ date: '2026-11-24', slot: 'dinner', quickMeal: 'Wraps met hummus', minutes: 15, reason: 'Snel' }]),
      ),
    )
    await as.action(api.mealPlanDrafts.propose, PLAN)
    const drafts = await as.query(api.mealPlanDrafts.list, WEEK)
    expect(drafts.find((d) => d.date === '2026-11-24')).toMatchObject({
      source: 'ai',
      title: 'Wraps met hummus',
    })
  })

  test('without a key the plan is the rules plan, and costs nothing', async () => {
    const { t, as } = await seed()
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await as.action(api.mealPlanDrafts.propose, PLAN)).toMatchObject({ status: 'fallback', count: 4 })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await usedToday(t)).toBe(0)
  })

  test('a quick meal already in the week is not proposed again', async () => {
    const { t, as, home, tacos, gnocchi, toast } = await seed()
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    await t.run(async (ctx) => {
      const plan = (
        date: string,
        fields: {
          title: string
          recipeId?: typeof tacos
          mealEntryId?: typeof toast
          prepMinutes?: number
        },
      ) => ctx.db.insert('plannedDinners', { groupId: home, date, slot: 'dinner', ...fields })
      await plan('2026-11-24', { recipeId: tacos, title: 'Tacos met kip' })
      await plan('2026-11-25', { recipeId: gnocchi, title: 'Gnocchi met spinazie' })
      await plan('2026-11-26', { mealEntryId: toast, title: 'Tosti', prepMinutes: 10 })
    })
    // Three evenings, two recipes left (Curry, Soep), and the only quick meal
    // is Thursday's Tosti: the third evening stays empty.
    const result = await as.action(api.mealPlanDrafts.propose, {
      ...PLAN,
      dates: ['2026-11-27', '2026-11-28', '2026-11-29'],
    })
    expect(result).toMatchObject({ status: 'fallback', count: 2 })
    const titles = (await as.query(api.mealPlanDrafts.list, WEEK)).map((d) => d.title)
    expect(titles.sort()).toEqual(['Curry', 'Soep'])
  })

  test('nothing to fill costs nothing', async () => {
    const { t, as } = await seed()
    expect(
      await as.action(api.mealPlanDrafts.propose, { ...PLAN, dates: ['2026-11-23'] }),
    ).toEqual({ status: 'empty' })
    expect(await usedToday(t)).toBe(0)
  })

  test('a connected app and another Group are refused', async () => {
    const { t } = await seed()
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const app = t.withIdentity({ ...alice, client_id: 'mcp-client', scope: 'gather:read gather:write' })
    await expect(app.action(api.mealPlanDrafts.propose, PLAN)).rejects.toThrow(CONNECTED_APP_REFUSED)
    await expect(t.withIdentity(carol).action(api.mealPlanDrafts.propose, PLAN)).rejects.toThrow()
    await expect(t.withIdentity(carol).query(api.mealPlanDrafts.list, WEEK)).rejects.toThrow()
  })
})

describe('mealPlanDrafts accept, discard and expiry', () => {
  async function proposed() {
    const seeded = await seed()
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        aiReply([
          { date: '2026-11-24', slot: 'dinner', recipeId: seeded.tacos, reason: 'Hoog beoordeeld' },
          { date: '2026-11-25', slot: 'dinner', quickMeal: 'Wraps met hummus', minutes: 15, reason: 'Snel' },
          { date: '2026-11-26', slot: 'dinner', quickMeal: 'tosti', reason: 'Snel' },
          { date: '2026-11-27', slot: 'dinner', recipeId: seeded.gnocchi, reason: 'Spinazie' },
        ]),
      ),
    )
    await seeded.as.action(api.mealPlanDrafts.propose, PLAN)
    const drafts = await seeded.as.query(api.mealPlanDrafts.list, WEEK)
    return { ...seeded, drafts }
  }

  test('accept one day writes an ordinary meal; a quick meal by name adds no quick meal', async () => {
    const { t, as, drafts, tacos, toast } = await proposed()
    const [tue, wed, thu] = drafts
    expect(await as.mutation(api.mealPlanDrafts.accept, { groupSlug: 'home', id: tue._id })).toBe('planned')
    expect(await as.mutation(api.mealPlanDrafts.accept, { groupSlug: 'home', id: wed._id })).toBe('planned')
    expect(await as.mutation(api.mealPlanDrafts.accept, { groupSlug: 'home', id: thu._id })).toBe('planned')
    const week = await as.query(api.mealPlan.week, { groupSlug: 'home', from: WEEK_START, to: '2026-11-29' })
    const byDate = Object.fromEntries(week.meals.map((m) => [m.date, m]))
    expect(byDate['2026-11-24']).toMatchObject({ title: 'Tacos met kip', recipeId: tacos })
    expect(byDate['2026-11-25']).toMatchObject({ title: 'Wraps met hummus', prepMinutes: 15 })
    expect(byDate['2026-11-25'].recipeId).toBeUndefined()
    expect(byDate['2026-11-25'].mealEntryId).toBeUndefined()
    // A name the Group keeps is linked to its quick meal.
    expect(byDate['2026-11-26']).toMatchObject({ title: 'Tosti', mealEntryId: toast })
    const entries = await t.run((ctx) => ctx.db.query('mealEntries').collect())
    expect(entries.map((e) => e.title)).toEqual(['Tosti'])
    // The accepted drafts are gone; the rest stay, for every Member.
    expect((await t.withIdentity(bob).query(api.mealPlanDrafts.list, WEEK)).map((d) => d.date)).toEqual(['2026-11-27'])
  })

  test('a slot filled meanwhile is never overwritten', async () => {
    const { as, drafts, curry } = await proposed()
    await as.mutation(api.mealPlan.plan, { groupSlug: 'home', date: '2026-11-24', slot: 'dinner', recipeId: curry })
    // The draft for that slot no longer shows.
    expect((await as.query(api.mealPlanDrafts.list, WEEK)).map((d) => d.date)).not.toContain('2026-11-24')
    expect(await as.mutation(api.mealPlanDrafts.accept, { groupSlug: 'home', id: drafts[0]._id })).toBe('taken')
    const result = await as.mutation(api.mealPlanDrafts.acceptAll, WEEK)
    expect(result).toEqual({ planned: 3, skipped: 0 })
    const week = await as.query(api.mealPlan.week, { groupSlug: 'home', from: WEEK_START, to: '2026-11-29' })
    expect(week.meals.map((m) => [m.date, m.title])).toEqual([
      ['2026-11-23', 'Pasta pesto'],
      ['2026-11-24', 'Curry'],
      ['2026-11-25', 'Wraps met hummus'],
      ['2026-11-26', 'Tosti'],
      ['2026-11-27', 'Gnocchi met spinazie'],
    ])
    expect(await as.query(api.mealPlanDrafts.list, WEEK)).toEqual([])
  })

  test('discard removes the proposal and changes nothing in the week', async () => {
    const { as } = await proposed()
    expect(await as.mutation(api.mealPlanDrafts.discard, WEEK)).toBe(4)
    expect(await as.query(api.mealPlanDrafts.list, WEEK)).toEqual([])
    const week = await as.query(api.mealPlan.week, { groupSlug: 'home', from: WEEK_START, to: '2026-11-29' })
    expect(week.meals).toHaveLength(1)
  })

  test('drafts expire after 24 hours', async () => {
    const { t, as, drafts } = await proposed()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + 23 * 60 * 60 * 1000)
    expect(await as.query(api.mealPlanDrafts.list, WEEK)).toHaveLength(4)
    vi.setSystemTime(Date.now() + 2 * 60 * 60 * 1000)
    expect(await as.query(api.mealPlanDrafts.list, WEEK)).toEqual([])
    expect(await as.mutation(api.mealPlanDrafts.accept, { groupSlug: 'home', id: drafts[1]._id })).toBe('gone')
    expect(await t.mutation(internal.mealPlanDrafts.sweep, {})).toBe(3)
    expect(await t.run((ctx) => ctx.db.query('mealPlanDrafts').collect())).toEqual([])
  })

  test('regenerate one day: one more call, a different recipe', async () => {
    const { t, as, drafts, tacos, curry } = await proposed()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        aiReply([
          // The same recipe again is refused; the rules pick another.
          { date: '2026-11-24', slot: 'dinner', recipeId: tacos, reason: 'Nog een keer' },
        ]),
      ),
    )
    const result = await as.action(api.mealPlanDrafts.regenerate, { groupSlug: 'home', id: drafts[0]._id, locale: 'nl' })
    expect(result).toMatchObject({ status: 'ai', count: 1, left: DAILY_AI_CALLS - 2 })
    const after = await as.query(api.mealPlanDrafts.list, WEEK)
    const tue = after.find((d) => d.date === '2026-11-24')
    expect(tue?.recipeId).toBe(curry)
    expect(tue?.source).toBe('rules')
    expect(after).toHaveLength(4)
    expect(await usedToday(t)).toBe(2)
  })

  test('regenerate with nothing else that fits keeps the draft', async () => {
    const { t, as, drafts, curry, soup, toast } = await proposed()
    await t.run(async (ctx) => {
      await ctx.db.delete(curry)
      await ctx.db.delete(soup)
      await ctx.db.delete(toast)
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(aiReply([])))
    const result = await as.action(api.mealPlanDrafts.regenerate, { groupSlug: 'home', id: drafts[0]._id, locale: 'nl' })
    expect(result).toEqual({ status: 'none' })
    const after = await as.query(api.mealPlanDrafts.list, WEEK)
    expect(after.map((d) => d._id)).toEqual(drafts.map((d) => d._id))
    expect(after[0].title).toBe('Tacos met kip')
  })

  test('regenerate never brings back the quick meal it replaces', async () => {
    const { as, drafts } = await proposed()
    // Wednesday's draft is the made-up "Wraps met hummus"; the model names it again.
    const wed = drafts.find((d) => d.date === '2026-11-25')
    if (!wed) throw new Error('no Wednesday draft')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        aiReply([{ date: '2026-11-25', slot: 'dinner', quickMeal: 'wraps met  Hummus', reason: 'Snel' }]),
      ),
    )
    await as.action(api.mealPlanDrafts.regenerate, { groupSlug: 'home', id: wed._id, locale: 'nl' })
    const after = await as.query(api.mealPlanDrafts.list, WEEK)
    const next = after.find((d) => d.date === '2026-11-25')
    expect(next?.title).not.toBe('Wraps met hummus')
    expect(next?.source).toBe('rules')
  })

  test('another Group cannot accept or discard', async () => {
    const { t, drafts } = await proposed()
    const asCarol = t.withIdentity(carol)
    await expect(asCarol.mutation(api.mealPlanDrafts.accept, { groupSlug: 'other', id: drafts[0]._id })).rejects.toThrow('Proposal not found')
    expect(await asCarol.mutation(api.mealPlanDrafts.discard, { groupSlug: 'other', weekStart: WEEK_START })).toBe(0)
  })
})
