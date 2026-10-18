import { isAiLimitReached } from '@gather/core/ai-limit'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { testConvex } from '../test/convexHarness'
import { api, internal } from './_generated/api'
import { DAILY_AI_CALLS } from './lib/aiUsage'

/**
 * The daily cap on AI calls, asserted through the counter and through both
 * actions that spend from it.
 *
 * The actions are the point: a counter nobody consults caps nothing, so each
 * test that matters here proves the provider was *not* reached.
 */

const asAlice = {
  subject: 'clerk_alice',
  name: 'Alice',
  email: 'a@example.com',
}
const asBob = { subject: 'clerk_bob', name: 'Bob', email: 'b@example.com' }

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

async function signUp(identity: typeof asAlice) {
  const t = testConvex()
  await t.withIdentity(identity).mutation(api.users.ensureUser, {})
  return t
}

async function usedToday(t: ReturnType<typeof testConvex>) {
  const rows = await t.run((ctx) => ctx.db.query('aiUsage').collect())
  return rows.map((row) => row.count)
}

/** Spend `n` calls as the given person, straight against the counter. */
async function spend(
  t: ReturnType<typeof testConvex>,
  clerkId: string,
  n: number,
) {
  for (let i = 0; i < n; i++) {
    await t.mutation(internal.aiUsage.take, { clerkId })
  }
}

const estimateReply = {
  ok: true,
  json: async () => ({
    content: [
      {
        type: 'tool_use',
        name: 'estimate_nutrition',
        input: { found: true, calories: 400, protein: 20 },
      },
    ],
  }),
}

describe('aiUsage.take', () => {
  test('allows exactly the daily limit, then refuses', async () => {
    const t = await signUp(asAlice)
    for (let i = 0; i < DAILY_AI_CALLS; i++) {
      expect(
        await t.mutation(internal.aiUsage.take, { clerkId: 'clerk_alice' }),
      ).toBe(true)
    }
    expect(
      await t.mutation(internal.aiUsage.take, { clerkId: 'clerk_alice' }),
    ).toBe(false)
    expect(await usedToday(t)).toEqual([DAILY_AI_CALLS])
  })

  test('counts each person on their own', async () => {
    const t = await signUp(asAlice)
    await t.withIdentity(asBob).mutation(api.users.ensureUser, {})
    await spend(t, 'clerk_alice', DAILY_AI_CALLS)
    expect(
      await t.mutation(internal.aiUsage.take, { clerkId: 'clerk_bob' }),
    ).toBe(true)
  })

  test('starts a fresh count on the next UTC day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-18T23:59:00Z'))
    const t = await signUp(asAlice)
    await spend(t, 'clerk_alice', DAILY_AI_CALLS)
    expect(
      await t.mutation(internal.aiUsage.take, { clerkId: 'clerk_alice' }),
    ).toBe(false)

    vi.setSystemTime(new Date('2026-10-19T00:01:00Z'))
    expect(
      await t.mutation(internal.aiUsage.take, { clerkId: 'clerk_alice' }),
    ).toBe(true)
  })

  test('refuses a caller with no user row', async () => {
    const t = testConvex()
    await expect(
      t.mutation(internal.aiUsage.take, { clerkId: 'clerk_nobody' }),
    ).rejects.toThrow()
  })
})

describe('recipeNutrition.estimateNutrition', () => {
  test('spends a call and returns the estimate', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    const fetchMock = vi.fn().mockResolvedValue(estimateReply)
    vi.stubGlobal('fetch', fetchMock)
    const t = await signUp(asAlice)

    const result = await t
      .withIdentity(asAlice)
      .action(api.recipeNutrition.estimateNutrition, {
        ingredients: ['200g pasta'],
      })

    expect(result).toMatchObject({ calories: 400, protein: 20 })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(await usedToday(t)).toEqual([1])
  })

  test('throws aiLimitReached without reaching the provider', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    const fetchMock = vi.fn().mockResolvedValue(estimateReply)
    vi.stubGlobal('fetch', fetchMock)
    const t = await signUp(asAlice)
    await spend(t, 'clerk_alice', DAILY_AI_CALLS)

    await expect(
      t.withIdentity(asAlice).action(api.recipeNutrition.estimateNutrition, {
        ingredients: ['200g pasta'],
      }),
    ).rejects.toSatisfy(isAiLimitReached)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await usedToday(t)).toEqual([DAILY_AI_CALLS])
  })
})

describe('recipeImport.importFromUrl', () => {
  async function aliceAndSlug() {
    const t = await signUp(asAlice)
    const id = await t
      .withIdentity(asAlice)
      .mutation(api.groups.createGroup, { name: 'Household' })
    const slug = await t.run(async (ctx) => (await ctx.db.get(id))?.slug)
    if (!slug) throw new Error('group was not created')
    return { t, slug }
  }

  const page = (body: string) =>
    ({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => body,
      blob: async () => new Blob([]),
    }) as unknown as Response

  const jsonLd = `<html><script type="application/ld+json">${JSON.stringify({
    '@type': 'Recipe',
    name: 'Stamppot',
    recipeIngredient: ['kale', 'potatoes'],
    recipeInstructions: ['mash'],
  })}</script></html>`

  test('a page with JSON-LD is free and returns the recipe', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(page(jsonLd)))
    const { t, slug } = await aliceAndSlug()
    await spend(t, 'clerk_alice', DAILY_AI_CALLS)

    const result = await t
      .withIdentity(asAlice)
      .action(api.recipeImport.importFromUrl, {
        url: 'https://example.com/stamppot',
        groupSlug: slug,
      })

    expect(result).toMatchObject({ title: 'Stamppot' })
    expect(result).not.toHaveProperty('ok')
    expect(await usedToday(t)).toEqual([DAILY_AI_CALLS])
  })

  test('the AI fallback throws aiLimitReached once the budget is spent', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    const fetchMock = vi
      .fn()
      .mockResolvedValue(page('<html><body>no recipe</body></html>'))
    vi.stubGlobal('fetch', fetchMock)
    const { t, slug } = await aliceAndSlug()
    await spend(t, 'clerk_alice', DAILY_AI_CALLS)

    await expect(
      t.withIdentity(asAlice).action(api.recipeImport.importFromUrl, {
        url: 'https://example.com/nothing',
        groupSlug: slug,
      }),
    ).rejects.toSatisfy(isAiLimitReached)
    // The page itself was fetched; the provider was not.
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://example.com/nothing')
  })

  test('the AI fallback spends a call', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) =>
        url.startsWith('https://api.anthropic.com')
          ? ({
              ok: true,
              json: async () => ({
                content: [
                  {
                    type: 'tool_use',
                    name: 'extract_recipe',
                    input: {
                      found: true,
                      title: 'Soup',
                      ingredients: ['water'],
                      steps: ['boil'],
                    },
                  },
                ],
              }),
            } as unknown as Response)
          : page('<html><body>soup: water, boil</body></html>'),
      ),
    )
    const { t, slug } = await aliceAndSlug()

    const result = await t
      .withIdentity(asAlice)
      .action(api.recipeImport.importFromUrl, {
        url: 'https://example.com/soup',
        groupSlug: slug,
      })

    expect(result).toMatchObject({ title: 'Soup' })
    expect(await usedToday(t)).toEqual([1])
  })
})
