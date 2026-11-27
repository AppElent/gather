import { WISH_MAX } from '@gather/core/week-plan'
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
    expect(result).toEqual({
      planned: 3,
      skipped: 0,
      slots: [
        { date: '2026-11-25', slot: 'dinner' },
        { date: '2026-11-26', slot: 'dinner' },
        { date: '2026-11-27', slot: 'dinner' },
      ],
    })
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

describe('APP-460 follow-ups', () => {
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

  test('accept all counts only the drafts the bar showed, and names the slots it planned', async () => {
    const { t, as, drafts, tacos } = await proposed()
    // Tuesday's recipe is gone: list hides its draft, so the bar says 3.
    await t.run((ctx) => ctx.db.delete(tacos))
    expect(await as.query(api.mealPlanDrafts.list, WEEK)).toHaveLength(3)
    const result = await as.mutation(api.mealPlanDrafts.acceptAll, WEEK)
    expect(result.planned + result.skipped).toBe(3)
    expect(result).toMatchObject({ planned: 3, skipped: 0 })
    expect(result.slots.map((s) => s.date)).toEqual(['2026-11-25', '2026-11-26', '2026-11-27'])
    // The hidden draft goes too.
    expect(await t.run((ctx) => ctx.db.query('mealPlanDrafts').collect())).toEqual([])
    expect(drafts).toHaveLength(4)
  })

  test('a regenerate whose draft was discarded meanwhile inserts nothing', async () => {
    const { t, as, drafts } = await proposed()
    await t.run((ctx) => ctx.db.delete(drafts[0]._id))
    const count = await t.withIdentity(alice).mutation(internal.mealPlanDrafts.write, {
      groupSlug: 'home',
      weekStart: WEEK_START,
      picks: [{ date: '2026-11-24', slot: 'dinner', quickMeal: 'Soep', source: 'rules' }],
      replace: { kind: 'draft', id: drafts[0]._id },
    })
    expect(count).toBe(0)
    const after = await as.query(api.mealPlanDrafts.list, WEEK)
    expect(after.map((d) => d.date)).toEqual(['2026-11-25', '2026-11-26', '2026-11-27'])
  })

  test('a whole-week plan with nothing that fits keeps the open proposal', async () => {
    const { as, drafts } = await proposed()
    const count = await t_write(as, [])
    expect(count).toBe(0)
    expect((await as.query(api.mealPlanDrafts.list, WEEK)).map((d) => d._id)).toEqual(
      drafts.map((d) => d._id),
    )
  })

  test('regenerate asks with the wishes from the start sheet', async () => {
    const { as, drafts } = await proposed()
    const fetchMock = vi.fn().mockResolvedValue(aiReply([]))
    vi.stubGlobal('fetch', fetchMock)
    await as.action(api.mealPlanDrafts.regenerate, {
      groupSlug: 'home',
      id: drafts[0]._id,
      locale: 'nl',
      wishes: ['moreVeg'],
      wish: 'iets met pompoen',
    })
    const prompt: string = JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content
    expect(prompt).toContain('lots of vegetables')
    expect(prompt).toContain('iets met pompoen')
  })

  describe('the wishes stay with the proposal (APP-679)', () => {
    const ASKED = { wishes: ['moreVeg' as const, 'moreVeg' as const], wish: '  iets  met pompoen ' }
    type T = Awaited<ReturnType<typeof seed>>['t']
    const stored = async (t: T) =>
      (await t.run((ctx) => ctx.db.query('mealPlanDrafts').collect())).map((d) => ({
        date: d.date,
        wishes: d.wishes,
        wish: d.wish,
      }))
    async function asked() {
      const seeded = await proposed()
      await seeded.as.action(api.mealPlanDrafts.propose, { ...PLAN, ...ASKED })
      const drafts = await seeded.as.query(api.mealPlanDrafts.list, WEEK)
      const fetchMock = vi.fn().mockResolvedValue(aiReply([]))
      vi.stubGlobal('fetch', fetchMock)
      const prompt = (): string => JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content
      return { ...seeded, drafts, prompt }
    }

    test('propose keeps the cleaned wishes on every row', async () => {
      const { t } = await asked()
      const rows = await stored(t)
      expect(rows).toHaveLength(4)
      for (const row of rows) expect(row).toMatchObject({ wishes: ['moreVeg'], wish: 'iets met pompoen' })
    })

    test.each([
      ['nothing', {}],
      ['empty wishes', { wishes: [], wish: ' ' }],
    ])('regenerate sent %s by another Member uses the stored wishes and keeps them', async (_, sent) => {
      const { t, drafts, prompt } = await asked()
      const result = await t
        .withIdentity(bob)
        .action(api.mealPlanDrafts.regenerate, { groupSlug: 'home', id: drafts[0]._id, locale: 'nl', ...sent })
      expect(result).toMatchObject({ count: 1 })
      expect(prompt()).toContain('lots of vegetables')
      expect(prompt()).toContain('iets met pompoen')
      const rows = await stored(t)
      expect(rows).toHaveLength(4)
      for (const row of rows) expect(row).toMatchObject({ wishes: ['moreVeg'], wish: 'iets met pompoen' })
    })

    test('regenerate sent wishes uses those alone, and its new row keeps them', async () => {
      const { t, as, drafts, prompt } = await asked()
      await as.action(api.mealPlanDrafts.regenerate, {
        groupSlug: 'home',
        id: drafts[0]._id,
        locale: 'nl',
        wish: 'iets met prei',
      })
      expect(prompt()).toContain('iets met prei')
      expect(prompt()).not.toContain('lots of vegetables')
      const rows = await stored(t)
      expect(rows.find((r) => r.date === drafts[0].date)).toEqual({ date: drafts[0].date, wishes: undefined, wish: 'iets met prei' })
      expect(rows.filter((r) => r.wish === 'iets met pompoen')).toHaveLength(3)
    })

    test('regenerate sent only chips drops the stored free text, and a second one keeps those chips', async () => {
      const { as, drafts, prompt, t } = await asked()
      const regenerate = { groupSlug: 'home', id: drafts[0]._id, locale: 'nl' as const }
      await as.action(api.mealPlanDrafts.regenerate, { ...regenerate, wishes: ['somethingNew'] })
      expect(prompt()).not.toContain('iets met pompoen')
      const next = (await as.query(api.mealPlanDrafts.list, WEEK)).find((d) => d.date === drafts[0].date)
      if (!next) throw new Error('no new draft')
      const result = await as.action(api.mealPlanDrafts.regenerate, { ...regenerate, id: next._id })
      expect(result).toMatchObject({ count: 1 })
      expect((await stored(t)).find((r) => r.date === next.date)).toMatchObject({
        wishes: ['somethingNew'],
        wish: undefined,
      })
    })

    test('list returns them on every draft', async () => {
      const { as } = await asked()
      const drafts = await as.query(api.mealPlanDrafts.list, WEEK)
      expect(drafts).toHaveLength(4)
      for (const draft of drafts) expect(draft).toMatchObject({ wishes: ['moreVeg'], wish: 'iets met pompoen' })
    })

    test('a plan that places nothing keeps the old wishes', async () => {
      const { t, as, drafts } = await asked()
      // Nothing to plan, then nothing that fits: the old rows and their wishes stay.
      expect(
        await as.action(api.mealPlanDrafts.propose, { ...PLAN, dates: ['2026-11-23'], wishes: ['somethingNew'] }),
      ).toEqual({ status: 'empty' })
      await t.run(async (ctx) => {
        for (const table of ['recipes', 'mealEntries'] as const)
          for (const row of await ctx.db.query(table).collect()) await ctx.db.delete(row._id)
      })
      await as.action(api.mealPlanDrafts.propose, { ...PLAN, wishes: ['somethingNew'], wish: 'iets anders' })
      const result = await as.action(api.mealPlanDrafts.regenerate, {
        groupSlug: 'home',
        id: drafts[0]._id,
        locale: 'nl',
        wishes: ['somethingNew'],
      })
      expect(result).toEqual({ status: 'none' })
      const rows = await stored(t)
      expect(rows).toHaveLength(4)
      for (const row of rows) expect(row).toMatchObject({ wishes: ['moreVeg'], wish: 'iets met pompoen' })
    })

    test('the rules fallback keeps the wishes too', async () => {
      const { t, as } = await seed()
      vi.stubEnv('ANTHROPIC_API_KEY', '')
      await as.action(api.mealPlanDrafts.propose, { ...PLAN, ...ASKED })
      const rows = await t.run((ctx) => ctx.db.query('mealPlanDrafts').collect())
      expect(rows.length).toBeGreaterThan(0)
      for (const row of rows) {
        expect(row.source).toBe('fallback')
        expect(row).toMatchObject({ wishes: ['moreVeg'], wish: 'iets met pompoen' })
      }
      const [draft] = await as.query(api.mealPlanDrafts.list, WEEK)
      await as.action(api.mealPlanDrafts.regenerate, { groupSlug: 'home', id: draft._id, locale: 'nl' })
      for (const row of await stored(t)) expect(row).toMatchObject({ wishes: ['moreVeg'], wish: 'iets met pompoen' })
    })

    test('a free-text wish over WISH_MAX is cut', async () => {
      const { t, as } = await asked()
      await as.action(api.mealPlanDrafts.propose, { ...PLAN, wish: `${'x'.repeat(WISH_MAX + 50)}` })
      const rows = await stored(t)
      expect(rows.length).toBeGreaterThan(0)
      for (const row of rows) expect(row.wish).toBe('x'.repeat(WISH_MAX))
    })

    test('a new plan replaces the stored wishes', async () => {
      const { t, as } = await asked()
      await as.action(api.mealPlanDrafts.propose, { ...PLAN, wishes: ['somethingNew'] })
      const rows = await stored(t)
      expect(rows).toHaveLength(4)
      for (const row of rows) expect(row).toMatchObject({ wishes: ['somethingNew'], wish: undefined })
    })

    test.each([
      ['no wishes', {}],
      ['empty wishes', { wishes: [] }],
    ])('a plan sent %s (a phone from before) stores none and regenerate asks without', async (_, sent) => {
      const { t, as, prompt } = await asked()
      await as.action(api.mealPlanDrafts.propose, { ...PLAN, ...sent })
      for (const row of await stored(t)) {
        expect(row.wishes).toBeUndefined()
        expect(row.wish).toBeUndefined()
      }
      const [draft] = await as.query(api.mealPlanDrafts.list, WEEK)
      const result = await as.action(api.mealPlanDrafts.regenerate, { groupSlug: 'home', id: draft._id, locale: 'nl' })
      expect(result).toMatchObject({ status: 'ai' })
      expect(prompt()).not.toContain('Wish for this week')
    })
  })

  test('a 2xx answer that is not JSON is given back; the rules plan', async () => {
    const { t, as } = await seed()
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token <')
        },
      }),
    )
    const result = await as.action(api.mealPlanDrafts.propose, PLAN)
    expect(result).toMatchObject({ status: 'fallback', left: DAILY_AI_CALLS })
    expect(await usedToday(t)).toBe(0)
  })

  test('drafts say "controleer zelf" for an allergy a made-up quick meal or recipe cannot rule out', async () => {
    const { t, as, aliceId, home, tacos } = await proposed()
    await t.run(async (ctx) => {
      await ctx.db.insert('mealPreferences', {
        groupId: home,
        allergens: ['crustaceans'],
        updatedBy: aliceId,
        updatedAt: Date.now(),
      })
      // Without ingredients, the matcher can't clear the recipe either.
      await ctx.db.patch(tacos, { ingredients: [] })
    })
    const drafts = await as.query(api.mealPlanDrafts.list, WEEK)
    const byDate = Object.fromEntries(drafts.map((d) => [d.date, d.check]))
    expect(byDate['2026-11-24']).toMatchObject({ kind: 'allergen', id: 'crustaceans', uncertain: true })
    // A name the AI made up can't be cleared; the Group's own Tosti is a dish it knows (APP-477).
    expect(byDate['2026-11-25']).toMatchObject({ kind: 'allergen', id: 'crustaceans', uncertain: true })
    expect(byDate['2026-11-26']).toBeUndefined()
    // Gnocchi lists its ingredients, none of them shellfish.
    expect(byDate['2026-11-27']).toBeUndefined()
  })
})

function t_write(
  as: Awaited<ReturnType<typeof seed>>['as'],
  picks: { date: string; slot: 'dinner'; quickMeal?: string; source: 'rules' }[],
) {
  return as.mutation(internal.mealPlanDrafts.write, {
    groupSlug: 'home',
    weekStart: WEEK_START,
    picks,
    replace: { kind: 'week' },
  })
}
