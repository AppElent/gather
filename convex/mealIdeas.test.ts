import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  alice,
  carol,
  seedGroup,
  seedMember,
  testConvex,
} from '../test/convexHarness'
import { api, internal } from './_generated/api'
import { DAILY_AI_CALLS } from './lib/aiUsage'
import { CONNECTED_APP_REFUSED } from './lib/connectedApps'

/**
 * Iets anders and Nieuw idee (APP-320): three alternatives from the Group's
 * own recipes, one AI call per ask against the daily cap, allergens filtered
 * before the model sees a recipe, a rules-only answer that costs nothing
 * without the model; a new recipe idea saved as an ordinary Recipe tagged AI,
 * without nutrition, and planned on the day.
 */

const THURSDAY = '2026-11-26'
const SLOT = { groupSlug: 'home', date: THURSDAY, slot: 'dinner' as const }
const ASK = { ...SLOT, locale: 'nl' as const }

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

async function seed() {
  const t = testConvex()
  const ids = await t.run(async (ctx) => {
    const user = (who: typeof alice) =>
      ctx.db.insert('users', { clerkId: who.subject, name: who.name, email: who.email })
    const aliceId = await user(alice)
    const carolId = await user(carol)
    const home = await seedGroup(ctx, { name: 'Home', slug: 'home', inviteCode: 'home' })
    const other = await seedGroup(ctx, { name: 'Other', slug: 'other', inviteCode: 'other' })
    await seedMember(ctx, home, aliceId, 'admin')
    await seedMember(ctx, other, carolId, 'admin')
    await ctx.db.insert('mealPreferences', {
      groupId: home,
      allergens: ['peanuts'],
      updatedBy: aliceId,
      updatedAt: Date.now(),
    })
    const recipe = (
      groupId: typeof home,
      title: string,
      prepMinutes: number,
      rating: number,
      ingredients: string[],
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
    const tacos = await recipe(home, 'Tacos met kip', 30, 5, ['kipfilet', 'tortilla'])
    const teriyaki = await recipe(home, 'Kip teriyaki', 25, 4.5, ['kipdij', 'rijst'])
    const gnocchi = await recipe(home, 'Gnocchi met spinazie', 20, 4, ['gnocchi', 'spinazie'])
    const risotto = await recipe(home, 'Pompoenrisotto', 45, 4, ['rijst', 'pompoen'])
    const sate = await recipe(home, 'Saté met pindasaus', 25, 5, ['kip', 'pindakaas'])
    const wraps = await recipe(home, 'Wraps met hummus', 15, 4, ['wraps', 'hummus', 'komkommer'])
    const foreign = await recipe(other, 'Foreign soup', 20, 5, ['water'])
    const tosti = await ctx.db.insert('mealEntries', {
      groupId: home,
      title: 'Tosti',
      prepMinutes: 10,
      createdBy: aliceId,
    })
    const meal = await ctx.db.insert('plannedDinners', {
      groupId: home,
      date: THURSDAY,
      slot: 'dinner',
      recipeId: tacos,
      title: 'Tacos met kip',
      prepMinutes: 30,
      servings: 3,
      note: 'extra salsa',
    })
    return { aliceId, home, tacos, teriyaki, gnocchi, risotto, sate, wraps, foreign, tosti, meal }
  })
  return { t, as: t.withIdentity(alice), ...ids }
}

function reply(name: string, input: unknown) {
  return {
    ok: true,
    json: async () => ({ content: [{ type: 'tool_use', name, input }] }),
  }
}

async function usedToday(t: Awaited<ReturnType<typeof seed>>['t']) {
  return (await t.withIdentity(alice).query(api.aiUsage.today, {})).used
}

describe('mealIdeas.swap', () => {
  test('three alternatives from the Group, one call counted, the peanut recipe never shown', async () => {
    const { t, as, teriyaki, gnocchi, sate, foreign } = await seed()
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    const fetchMock = vi.fn().mockResolvedValue(
      reply('propose_alternatives', {
        alternatives: [
          { recipeId: teriyaki, reason: 'Met kip · lang niet gegeten' },
          // Peanuts, another Group's and invented: all dropped.
          { recipeId: sate, reason: 'x' },
          { recipeId: foreign, reason: 'x' },
          { recipeId: 'k57invented000000000000000000000', reason: 'x' },
          { recipeId: gnocchi, reason: 'Vleesloos · spinazie in huis' },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await as.action(api.mealIdeas.swap, { ...ASK, wish: 'iets met groente' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(await usedToday(t)).toBe(1)
    if (result.status !== 'ai') throw new Error(result.status)
    expect(result.left).toBe(DAILY_AI_CALLS - 1)
    expect(result.alternatives).toHaveLength(3)
    expect(result.alternatives.slice(0, 2).map((a) => [a.title, a.reason, a.source])).toEqual([
      ['Kip teriyaki', 'Met kip · lang niet gegeten', 'ai'],
      ['Gnocchi met spinazie', 'Vleesloos · spinazie in huis', 'ai'],
    ])
    // The rules fill the third place, never with what is planned now.
    expect(result.alternatives[2].source).toBe('rules')
    const titles = result.alternatives.map((a) => a.title)
    expect(titles).not.toContain('Tacos met kip')
    expect(titles).not.toContain('Saté met pindasaus')
    expect(titles).not.toContain('Foreign soup')

    const prompt: string = JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content
    expect(prompt).toContain('Planned now: "Tacos met kip"')
    expect(prompt).toContain('iets met groente')
    expect(prompt).not.toContain('Saté')
    expect(prompt).not.toContain('Foreign soup')
    expect(prompt).not.toContain(alice.name)
  })

  test('a chip steers the pool: Vleesloos keeps the chicken out', async () => {
    const { as } = await seed()
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const result = await as.action(api.mealIdeas.swap, { ...ASK, chip: 'meatFree' })
    if (result.status !== 'fallback') throw new Error(result.status)
    const titles = result.alternatives.map((a) => a.title)
    expect(titles.length).toBeGreaterThan(0)
    expect(titles.some((title) => /kip/i.test(title))).toBe(false)
  })

  test('Met kip, snel: only chicken within 30 minutes', async () => {
    const { as } = await seed()
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const result = await as.action(api.mealIdeas.swap, { ...ASK, chip: 'chickenQuick' })
    if (result.status !== 'fallback') throw new Error(result.status)
    // Tacos is planned now and Saté has peanuts: only the teriyaki is left.
    expect(result.alternatives.map((a) => a.title)).toEqual(['Kip teriyaki'])
  })

  test('without a key the rules answer three, and it costs nothing', async () => {
    const { t, as } = await seed()
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await as.action(api.mealIdeas.swap, ASK)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result).toMatchObject({ status: 'fallback', left: DAILY_AI_CALLS })
    if (result.status !== 'fallback') throw new Error(result.status)
    expect(result.alternatives).toHaveLength(3)
    expect(result.alternatives.every((a) => a.source === 'rules')).toBe(true)
    expect(await usedToday(t)).toBe(0)
  })

  test('a model that cannot be reached is given back; the rules answer', async () => {
    const { t, as } = await seed()
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    expect(await as.action(api.mealIdeas.swap, ASK)).toMatchObject({ status: 'fallback' })
    expect(await usedToday(t)).toBe(0)
  })

  test('over the cap nothing is asked', async () => {
    const { t, as } = await seed()
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    for (let i = 0; i < DAILY_AI_CALLS; i++)
      await t.mutation(internal.aiUsage.take, { clerkId: alice.subject })
    expect(await as.action(api.mealIdeas.swap, ASK)).toEqual({ status: 'limit', limit: DAILY_AI_CALLS })
    expect(await as.action(api.mealIdeas.idea, ASK)).toEqual({ status: 'limit', limit: DAILY_AI_CALLS })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('a connected app and another Group are refused', async () => {
    const { t, meal, teriyaki } = await seed()
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const app = t.withIdentity({ ...alice, client_id: 'mcp-client', scope: 'gather:read gather:write' })
    await expect(app.action(api.mealIdeas.swap, ASK)).rejects.toThrow(CONNECTED_APP_REFUSED)
    await expect(app.action(api.mealIdeas.idea, ASK)).rejects.toThrow(CONNECTED_APP_REFUSED)
    await expect(
      app.mutation(api.mealIdeas.choose, { ...SLOT, recipeId: teriyaki, replaceId: meal }),
    ).rejects.toThrow(CONNECTED_APP_REFUSED)
    await expect(t.withIdentity(carol).action(api.mealIdeas.swap, ASK)).rejects.toThrow()
    await expect(
      t.withIdentity(carol).mutation(api.mealIdeas.choose, { ...SLOT, recipeId: teriyaki, replaceId: meal }),
    ).rejects.toThrow()
  })
})

describe('mealIdeas.choose and unchoose', () => {
  test('one tap replaces the meal, keeping servings and note; Undo puts it back', async () => {
    const { t, as, meal, teriyaki, tacos } = await seed()
    const chosen = await as.mutation(api.mealIdeas.choose, { ...SLOT, recipeId: teriyaki, replaceId: meal })
    expect(chosen.id).toBe(meal)
    expect(chosen.previous).toMatchObject({ title: 'Tacos met kip', recipeId: tacos })
    let row = await t.run((ctx) => ctx.db.get(meal))
    expect(row).toMatchObject({ title: 'Kip teriyaki', recipeId: teriyaki, servings: 3, note: 'extra salsa' })

    expect(
      await as.mutation(api.mealIdeas.unchoose, {
        groupSlug: 'home',
        id: meal,
        chosen: { recipeId: teriyaki },
        previous: chosen.previous,
      }),
    ).toBe(true)
    row = await t.run((ctx) => ctx.db.get(meal))
    expect(row).toMatchObject({ title: 'Tacos met kip', recipeId: tacos, servings: 3 })
  })

  test('Undo on a quick meal brings its time limit back', async () => {
    const { t, as, meal, teriyaki, tosti } = await seed()
    await t.run((ctx) =>
      ctx.db.patch(meal, {
        title: 'Tosti',
        recipeId: undefined,
        mealEntryId: tosti,
        quickLimit: 20,
      }),
    )
    const chosen = await as.mutation(api.mealIdeas.choose, { ...SLOT, recipeId: teriyaki, replaceId: meal })
    expect(chosen.previous).toMatchObject({ title: 'Tosti', mealEntryId: tosti, quickLimit: 20 })
    expect((await t.run((ctx) => ctx.db.get(meal)))?.quickLimit).toBeUndefined()
    await as.mutation(api.mealIdeas.unchoose, {
      groupSlug: 'home',
      id: meal,
      chosen: { recipeId: teriyaki },
      previous: chosen.previous,
    })
    expect(await t.run((ctx) => ctx.db.get(meal))).toMatchObject({
      title: 'Tosti',
      mealEntryId: tosti,
      quickLimit: 20,
      servings: 3,
    })
  })

  test('Undo after someone changed the meal writes nothing', async () => {
    const { t, as, meal, teriyaki, gnocchi } = await seed()
    const chosen = await as.mutation(api.mealIdeas.choose, { ...SLOT, recipeId: teriyaki, replaceId: meal })
    await as.mutation(api.mealIdeas.choose, { ...SLOT, recipeId: gnocchi, replaceId: meal })
    expect(
      await as.mutation(api.mealIdeas.unchoose, {
        groupSlug: 'home',
        id: meal,
        chosen: { recipeId: teriyaki },
        previous: chosen.previous,
      }),
    ).toBe(false)
    expect((await t.run((ctx) => ctx.db.get(meal)))?.title).toBe('Gnocchi met spinazie')
  })

  test("a proposal's draft slot: the choice is planned, Undo brings the draft back", async () => {
    const { t, as, home, aliceId, wraps, gnocchi } = await seed()
    const friday = '2026-11-27'
    await t.run((ctx) =>
      ctx.db.insert('mealPlanDrafts', {
        groupId: home,
        weekStart: '2026-11-23',
        date: friday,
        slot: 'dinner',
        recipeId: wraps,
        source: 'ai',
        createdBy: aliceId,
        expiresAt: Date.now() + 60_000,
      }),
    )
    const week = { groupSlug: 'home', weekStart: '2026-11-23' }
    expect((await as.query(api.mealPlanDrafts.list, week)).map((d) => d.title)).toEqual(['Wraps met hummus'])

    // The draft's recipe is what is there now: never offered again.
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const swap = await as.action(api.mealIdeas.swap, { ...ASK, date: friday })
    if (swap.status !== 'fallback') throw new Error(swap.status)
    expect(swap.alternatives.map((a) => a.title)).not.toContain('Wraps met hummus')

    const chosen = await as.mutation(api.mealIdeas.choose, { ...SLOT, date: friday, recipeId: gnocchi })
    expect(chosen.previous).toBeNull()
    expect(await as.query(api.mealPlanDrafts.list, week)).toEqual([])
    await as.mutation(api.mealIdeas.unchoose, {
      groupSlug: 'home',
      id: chosen.id,
      chosen: { recipeId: gnocchi },
      previous: null,
    })
    expect((await as.query(api.mealPlanDrafts.list, week)).map((d) => d.title)).toEqual(['Wraps met hummus'])
  })
})

const CURRY = {
  title: 'Kip-pompoencurry met spinazie',
  why: 'Op je wens "met kip, snel". Gebruikt de spinazie die in huis is. Zonder pinda. Ongeveer 520 kcal per portie.',
  minutes: 30,
  ingredients: [
    { name: 'kipdijfilet', quantity: 375, unit: 'g' },
    { name: 'pompoen', quantity: 450, unit: 'g' },
    { name: 'verse spinazie', quantity: 150, unit: 'g' },
    { name: 'kokosmelk', quantity: 400, unit: 'ml' },
    { name: 'ui', quantity: 1 },
  ],
  steps: [
    'Snijd de kip, pompoen en ui in blokjes.',
    'Bak de ui en kip 5 minuten.',
    'Voeg pompoen en kokosmelk toe en laat 15 minuten koken.',
    'Per portie: 520 kcal, 32 g eiwitten.',
    'Schep de spinazie erdoor.',
  ],
}

describe('mealIdeas.idea and saveIdea', () => {
  test('a new recipe as a draft: one call, no nutrition lines', async () => {
    const { t, as } = await seed()
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    const fetchMock = vi.fn().mockResolvedValue(reply('write_recipe', CURRY))
    vi.stubGlobal('fetch', fetchMock)
    const result = await as.action(api.mealIdeas.idea, { ...ASK, chip: 'chickenQuick' })
    expect(await usedToday(t)).toBe(1)
    if (result.status !== 'ai') throw new Error(result.status)
    expect(result.idea.title).toBe('Kip-pompoencurry met spinazie')
    expect(result.idea.prepMinutes).toBe(30)
    expect(result.idea.ingredients[0]).toEqual({ name: 'kipdijfilet', quantity: 375, unit: 'g' })
    expect(result.idea.steps).toHaveLength(4)
    expect(JSON.stringify(result.idea)).not.toMatch(/kcal|eiwit/)
    // The why line claimed calories, so it is dropped.
    expect(result.idea.why).toBeUndefined()

    const prompt: string = JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content
    expect(prompt).toContain('Never give nutrition values')
    expect(prompt).toContain('never use an ingredient with peanuts')
    expect(prompt).toContain('with chicken, and quick')
    // The collection's titles, so the idea is new.
    expect(prompt).toContain('Kip teriyaki')
  })

  test('an idea with peanuts is dropped, and the call still counts', async () => {
    const { t, as } = await seed()
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        reply('write_recipe', {
          ...CURRY,
          ingredients: [...CURRY.ingredients, { name: 'pindakaas', quantity: 2, unit: 'el' }],
        }),
      ),
    )
    expect(await as.action(api.mealIdeas.idea, ASK)).toEqual({
      status: 'none',
      left: DAILY_AI_CALLS - 1,
      limit: DAILY_AI_CALLS,
    })
    expect(await usedToday(t)).toBe(1)
  })

  test('without a key there is no idea, and it costs nothing', async () => {
    const { t, as } = await seed()
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    expect(await as.action(api.mealIdeas.idea, ASK)).toEqual({
      status: 'unavailable',
      left: DAILY_AI_CALLS,
      limit: DAILY_AI_CALLS,
    })
    expect(await usedToday(t)).toBe(0)
  })

  test('Bewaar en zet op donderdag: an ordinary Recipe tagged AI, no nutrition, planned on the day', async () => {
    const { t, as, meal } = await seed()
    const saved = await as.mutation(api.mealIdeas.saveIdea, {
      groupSlug: 'home',
      title: CURRY.title,
      ingredients: ['375 g kipdijfilet', '450 g pompoen', '1 ui'],
      steps: CURRY.steps.filter((step) => !step.includes('kcal')),
      prepMinutes: 30,
      servings: 3,
      plan: { date: THURSDAY, slot: 'dinner', replaceId: meal },
    })
    const recipe = await t.run((ctx) => ctx.db.get(saved.recipeId))
    expect(recipe).toMatchObject({ title: CURRY.title, tags: ['AI'], prepMinutes: 30, servings: 3 })
    expect(recipe?.nutrition).toBeUndefined()
    expect(recipe?.nutritionSource).toBeUndefined()
    expect(saved.mealId).toBe(meal)
    const week = await as.query(api.mealPlan.week, { groupSlug: 'home', from: '2026-11-23', to: '2026-11-29' })
    expect(week.meals.find((m) => m.date === THURSDAY)).toMatchObject({
      title: CURRY.title,
      recipeId: saved.recipeId,
      servings: 3,
    })
    // It is a normal Recipe in the Group: Pick and the planners see it.
    const candidates = await as.query(api.mealPlan.candidates, { groupSlug: 'home' })
    expect(candidates.recipes.map((r) => r.title)).toContain(CURRY.title)
  })

  test('Alleen bewaren saves without planning; a slot taken meanwhile is left alone', async () => {
    const { as } = await seed()
    const only = await as.mutation(api.mealIdeas.saveIdea, {
      groupSlug: 'home',
      title: 'Linzensoep',
      ingredients: ['200 g linzen'],
      steps: ['Kook de linzen.'],
    })
    expect(only.mealId).toBeNull()
    const taken = await as.mutation(api.mealIdeas.saveIdea, {
      groupSlug: 'home',
      title: 'Bonensoep',
      ingredients: ['200 g bonen'],
      steps: ['Kook de bonen.'],
      plan: { date: THURSDAY, slot: 'dinner' },
    })
    expect(taken.mealId).toBeNull()
    const week = await as.query(api.mealPlan.week, { groupSlug: 'home', from: THURSDAY, to: THURSDAY })
    expect(week.meals.map((m) => m.title)).toEqual(['Tacos met kip'])
  })

  test('the meal it was to replace is gone: planned into the empty slot, or only saved', async () => {
    const { t, as, meal } = await seed()
    await t.run((ctx) => ctx.db.delete(meal))
    const planned = await as.mutation(api.mealIdeas.saveIdea, {
      groupSlug: 'home',
      title: 'Linzensoep',
      ingredients: ['200 g linzen'],
      steps: ['Kook de linzen.'],
      plan: { date: THURSDAY, slot: 'dinner', replaceId: meal },
    })
    expect(planned.mealId).not.toBeNull()
    const again = await as.mutation(api.mealIdeas.saveIdea, {
      groupSlug: 'home',
      title: 'Bonensoep',
      ingredients: ['200 g bonen'],
      steps: ['Kook de bonen.'],
      plan: { date: THURSDAY, slot: 'dinner', replaceId: meal },
    })
    expect(again.mealId).toBeNull()
    const week = await as.query(api.mealPlan.week, { groupSlug: 'home', from: THURSDAY, to: THURSDAY })
    expect(week.meals.map((m) => m.title)).toEqual(['Linzensoep'])
  })

  test('saving refuses nutrition lines, an allergen and connected apps', async () => {
    const { t, as } = await seed()
    const base = { groupSlug: 'home', title: 'Soep', ingredients: ['1 ui'], steps: ['Kook.'] }
    await expect(
      as.mutation(api.mealIdeas.saveIdea, { ...base, steps: ['Kook.', '250 kcal per portie.'] }),
    ).rejects.toThrow()
    await expect(
      as.mutation(api.mealIdeas.saveIdea, { ...base, ingredients: ['2 el pindakaas'] }),
    ).rejects.toThrow()
    const app = t.withIdentity({ ...alice, client_id: 'mcp-client', scope: 'gather:read gather:write' })
    await expect(app.mutation(api.mealIdeas.saveIdea, base)).rejects.toThrow(CONNECTED_APP_REFUSED)
  })
})
