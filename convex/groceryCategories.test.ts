import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { alice, bob, carol, seedGroup, seedMember, testConvex } from '../test/convexHarness'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import {
  GROCERY_AI_DAILY_BUDGET,
  GROCERY_AI_GROUP_DAILY_BUDGET,
  GROCERY_HISTORY_WINDOW,
  PENDING_STALE_MS,
} from './lib/groceryCategories'

/**
 * Grocery aisles (APP-353), through the real mutations: an item added to a
 * Group's grocery list gets its aisle from the dictionary at once; an unknown
 * one waits in `other` for one question to the model, whose answer is shared;
 * a Member's correction wins for their Group, and three Groups agreeing move
 * the shared answer.
 */

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

beforeEach(() => {
  vi.useFakeTimers()
})

const PEOPLE = [alice, bob, carol] as const
const SLUGS = ['jansen', 'de-vries', 'bakker'] as const

/** Three Groups, one Member each, each with a grocery list and a chores list. */
async function seed() {
  const t = testConvex()
  const ids = await t.run(async (ctx) => {
    const groups: {
      groupId: Id<'groups'>
      groceries: Id<'taskLists'>
      chores: Id<'taskLists'>
    }[] = []
    for (const [index, person] of PEOPLE.entries()) {
      const userId = await ctx.db.insert('users', {
        clerkId: person.subject,
        name: person.name,
        email: person.email,
      })
      const groupId = await seedGroup(ctx, { name: SLUGS[index], slug: SLUGS[index] })
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
      groups.push({ groupId, groceries, chores })
    }
    return groups
  })
  return { t, groups: ids }
}

function modelAnswers(aisle: string) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      content: [{ type: 'tool_use', name: 'choose_aisle', input: { aisle } }],
    }),
  })
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function addItem(
  t: Awaited<ReturnType<typeof seed>>['t'],
  index: number,
  listId: Id<'taskLists'>,
  title: string,
) {
  return (await t.withIdentity(PEOPLE[index]).mutation(api.tasks.add, {
    listId,
    groupSlug: SLUGS[index],
    title,
  })) as Id<'tasks'>
}

async function categoryOf(t: Awaited<ReturnType<typeof seed>>['t'], taskId: Id<'tasks'>) {
  return (await t.run((ctx) => ctx.db.get(taskId)))?.category
}

describe('aisle on add', () => {
  test('a known item gets its aisle from the dictionary, without the model', async () => {
    const { t, groups } = await seed()
    const fetchMock = modelAnswers('other')
    const milk = await addItem(t, 0, groups[0].groceries, '2 liter halfvolle melk')
    const nappies = await addItem(t, 0, groups[0].groceries, 'Pampers luiers')
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await categoryOf(t, milk)).toBe('dairy')
    expect(await categoryOf(t, nappies)).toBe('care_baby')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('an item on another list gets no aisle', async () => {
    const { t, groups } = await seed()
    const task = await addItem(t, 0, groups[0].chores, 'melk')
    expect(await categoryOf(t, task)).toBeUndefined()
  })

  test('an unknown item waits in other, then moves to the model’s aisle', async () => {
    const { t, groups } = await seed()
    const fetchMock = modelAnswers('pasta_world')
    const task = await addItem(t, 0, groups[0].groceries, 'doenjang')
    expect(await categoryOf(t, task)).toBe('other')

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await categoryOf(t, task)).toBe('pasta_world')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // The model saw the name and nothing about the Group or the person.
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.model).toBe('claude-haiku-5-5')
    const prompt: string = body.messages[0].content
    expect(prompt).toContain('"doenjang"')
    expect(prompt).not.toContain(SLUGS[0])
    expect(prompt).not.toContain(alice.name)
    expect(body.tools[0].input_schema.properties.aisle.enum).toContain('pasta_world')

    const cache = await t.run((ctx) => ctx.db.query('groceryCategoryCache').collect())
    expect(cache).toMatchObject([{ aisle: 'pasta_world', source: 'ai' }])
    expect(Object.keys(cache[0]).sort()).not.toContain('groupId')
  })

  // The runtime walk-through in the PR (APP-353): five names the dictionary
  // does not know, each in Overig at once and in its aisle once the
  // scheduled question is answered. The model is a stand-in that answers per
  // name, because no key exists yet.
  test('five unknown items move from other to their aisles', async () => {
    const { t, groups } = await seed()
    const answers: Record<string, string> = {
      doenjang: 'pasta_world',
      kibbeling: 'meat_fish',
      ponzu: 'pasta_world',
      desem: 'bakery',
      labneh: 'dairy',
    }
    const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
      const prompt: string = JSON.parse(init.body).messages[0].content
      const name = Object.keys(answers).find((key) => prompt.includes(`"${key}"`))
      return {
        ok: true,
        json: async () => ({
          content: [
            { type: 'tool_use', name: 'choose_aisle', input: { aisle: answers[name ?? ''] } },
          ],
        }),
      }
    })
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.stubGlobal('fetch', fetchMock)

    const titles = ['doenjang', '2 bakjes kibbeling', 'ponzu', 'desem', 'labneh']
    const added: Id<'tasks'>[] = []
    for (const title of titles) added.push(await addItem(t, 0, groups[0].groceries, title))
    const before = await Promise.all(added.map((id) => categoryOf(t, id)))
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    const after = await Promise.all(added.map((id) => categoryOf(t, id)))

    console.log(
      titles
        .map((title, index) => `${title.padEnd(20)} ${before[index]} → ${after[index]}`)
        .join('\n'),
    )
    expect(before).toEqual(['other', 'other', 'other', 'other', 'other'])
    expect(after).toEqual(['pasta_world', 'meat_fish', 'pasta_world', 'bakery', 'dairy'])
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  test('the model is asked once per name, whoever adds it', async () => {
    const { t, groups } = await seed()
    const fetchMock = modelAnswers('pasta_world')
    const first = await addItem(t, 0, groups[0].groceries, 'doenjang')
    const second = await addItem(t, 1, groups[1].groceries, 'Doenjang')
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(await categoryOf(t, first)).toBe('pasta_world')
    expect(await categoryOf(t, second)).toBe('pasta_world')

    // Answered names come from the cache at once.
    const third = await addItem(t, 2, groups[2].groceries, 'doenjang')
    expect(await categoryOf(t, third)).toBe('pasta_world')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('over the daily budget an item stays in other and the model is not reached', async () => {
    const { t, groups } = await seed()
    const fetchMock = modelAnswers('pasta_world')
    await t.run(async (ctx) => {
      await ctx.db.insert('groceryAiUsage', {
        day: new Date().toISOString().slice(0, 10),
        count: GROCERY_AI_DAILY_BUDGET,
      })
    })
    const task = await addItem(t, 0, groups[0].groceries, 'doenjang')
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await categoryOf(t, task)).toBe('other')
    expect(fetchMock).not.toHaveBeenCalled()
    // The claim is given up, so tomorrow's item may ask again.
    expect(await t.run((ctx) => ctx.db.query('groceryCategoryCache').collect())).toEqual([])
  })

  test('one Group cannot spend more than its share of the day’s questions', async () => {
    const { t, groups } = await seed()
    const fetchMock = modelAnswers('pasta_world')
    const day = new Date().toISOString().slice(0, 10)
    await t.run(async (ctx) => {
      await ctx.db.insert('groceryAiGroupUsage', {
        groupId: groups[0].groupId,
        day,
        count: GROCERY_AI_GROUP_DAILY_BUDGET,
      })
    })
    const spent = await addItem(t, 0, groups[0].groceries, 'doenjang')
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await categoryOf(t, spent)).toBe('other')
    expect(fetchMock).not.toHaveBeenCalled()

    // Another Group still has its own share, and the answer is shared.
    const other = await addItem(t, 1, groups[1].groceries, 'doenjang')
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await categoryOf(t, other)).toBe('pasta_world')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const usage = await t.run((ctx) => ctx.db.query('groceryAiGroupUsage').collect())
    expect(usage.map((row) => [row.groupId, row.count])).toEqual([
      [groups[0].groupId, GROCERY_AI_GROUP_DAILY_BUDGET],
      [groups[1].groupId, 1],
    ])
    expect(
      (await t.run((ctx) => ctx.db.query('groceryAiUsage').collect()))[0].count,
    ).toBe(1)
  })

  test('the Group’s share is taken when the question is asked, not when it is scheduled', async () => {
    const { t, groups } = await seed()
    const fetchMock = modelAnswers('pasta_world')
    const day = new Date().toISOString().slice(0, 10)
    await addItem(t, 0, groups[0].groceries, 'doenjang')
    // Spent between scheduling and asking: the run refuses and gives up.
    await t.run(async (ctx) => {
      await ctx.db.insert('groceryAiGroupUsage', {
        groupId: groups[0].groupId,
        day,
        count: GROCERY_AI_GROUP_DAILY_BUDGET,
      })
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await t.run((ctx) => ctx.db.query('groceryCategoryCache').collect())).toEqual([])
  })

  test('items waiting on a question move when the answer comes in, however late', async () => {
    const { t, groups } = await seed()
    let answer: (value: unknown) => void = () => {}
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          answer = resolve
        }),
    )
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.stubGlobal('fetch', fetchMock)
    const first = await addItem(t, 0, groups[0].groceries, 'doenjang')
    const second = await addItem(t, 1, groups[1].groceries, 'doenjang')
    const third = await addItem(t, 0, groups[0].groceries, '2 potjes doenjang')
    expect(
      (await t.run((ctx) => ctx.db.query('groceryCategoryCache').collect()))[0]
        .waitingTaskIds,
    ).toEqual([second, third])

    // Far longer than the old 6 × 30 s wait.
    const running = t.finishAllScheduledFunctions(vi.runAllTimers)
    await vi.advanceTimersByTimeAsync(PENDING_STALE_MS / 2)
    answer({
      ok: true,
      json: async () => ({
        content: [{ type: 'tool_use', name: 'choose_aisle', input: { aisle: 'pasta_world' } }],
      }),
    })
    await running
    expect(fetchMock).toHaveBeenCalledTimes(1)
    for (const task of [first, second, third])
      expect(await categoryOf(t, task)).toBe('pasta_world')
    const [row] = await t.run((ctx) => ctx.db.query('groceryCategoryCache').collect())
    expect(row.waitingTaskIds).toBeUndefined()
  })

  test('without an API key the item stays in other', async () => {
    const { t, groups } = await seed()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const task = await addItem(t, 0, groups[0].groceries, 'doenjang')
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await categoryOf(t, task)).toBe('other')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('a name that looks like more than a product never leaves the server', async () => {
    const { t, groups } = await seed()
    const fetchMock = modelAnswers('household')
    const task = await addItem(t, 0, groups[0].groceries, 'doenjang van tante 0612345678')
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await categoryOf(t, task)).toBe('other')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('corrections', () => {
  test('a Group’s correction wins for that Group only', async () => {
    const { t, groups } = await seed()
    modelAnswers('other')
    const task = await addItem(t, 0, groups[0].groceries, 'melk')
    await t.withIdentity(alice).mutation(api.tasks.update, {
      taskId: task,
      groupSlug: SLUGS[0],
      category: 'drinks',
    })
    expect(await categoryOf(t, task)).toBe('drinks')

    const again = await addItem(t, 0, groups[0].groceries, '1 pak melk')
    expect(await categoryOf(t, again)).toBe('drinks')
    const elsewhere = await addItem(t, 1, groups[1].groceries, 'melk')
    expect(await categoryOf(t, elsewhere)).toBe('dairy')
  })

  test('three Groups agreeing move the shared answer', async () => {
    const { t, groups } = await seed()
    modelAnswers('snacks')
    const tasks: Id<'tasks'>[] = []
    for (const index of [0, 1, 2]) {
      tasks.push(await addItem(t, index, groups[index].groceries, 'doenjang'))
      await t.finishAllScheduledFunctions(vi.runAllTimers)
    }
    const cached = async () =>
      (await t.run((ctx) => ctx.db.query('groceryCategoryCache').collect()))[0]
    expect(await cached()).toMatchObject({ aisle: 'snacks', source: 'ai' })

    for (const index of [0, 1]) {
      await t.withIdentity(PEOPLE[index]).mutation(api.tasks.update, {
        taskId: tasks[index],
        groupSlug: SLUGS[index],
        category: 'pasta_world',
      })
    }
    expect(await cached()).toMatchObject({ aisle: 'snacks', source: 'ai' })
    await t.withIdentity(PEOPLE[2]).mutation(api.tasks.update, {
      taskId: tasks[2],
      groupSlug: SLUGS[2],
      category: 'pasta_world',
    })
    expect(await cached()).toMatchObject({ aisle: 'pasta_world', source: 'consensus' })
  })

  test('three Groups agreeing teach the cache even when the model was never asked', async () => {
    const { t, groups } = await seed()
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    vi.stubGlobal('fetch', vi.fn())
    for (const index of [0, 1, 2]) {
      const task = await addItem(t, index, groups[index].groceries, 'doenjang')
      await t.finishAllScheduledFunctions(vi.runAllTimers)
      expect(await categoryOf(t, task)).toBe('other')
      await t.withIdentity(PEOPLE[index]).mutation(api.tasks.update, {
        taskId: task,
        groupSlug: SLUGS[index],
        category: 'pasta_world',
      })
    }
    expect(
      await t.run((ctx) => ctx.db.query('groceryCategoryCache').collect()),
    ).toMatchObject([{ name: 'doenjang', aisle: 'pasta_world', source: 'consensus' }])
  })

  test('three Groups cannot overturn an answer more Groups chose', async () => {
    const { t, groups } = await seed()
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    await t.run(async (ctx) => {
      for (const n of [1, 2, 3, 4]) {
        const groupId = await seedGroup(ctx, { name: `g${n}`, slug: `g${n}` })
        const userId = await ctx.db.insert('users', {
          clerkId: `u${n}`,
          name: `U${n}`,
          email: `u${n}@example.com`,
        })
        await ctx.db.insert('groceryCategoryOverrides', {
          groupId,
          name: 'doenjang',
          aisle: 'snacks',
          updatedBy: userId,
          updatedAt: 0,
        })
      }
      await ctx.db.insert('groceryCategoryCache', {
        name: 'doenjang',
        aisle: 'snacks',
        source: 'consensus',
        askedAt: 0,
        answeredAt: 0,
      })
    })
    for (const index of [0, 1, 2]) {
      const task = await addItem(t, index, groups[index].groceries, 'doenjang')
      await t.withIdentity(PEOPLE[index]).mutation(api.tasks.update, {
        taskId: task,
        groupSlug: SLUGS[index],
        category: 'pasta_world',
      })
    }
    expect(
      (await t.run((ctx) => ctx.db.query('groceryCategoryCache').collect()))[0],
    ).toMatchObject({ aisle: 'snacks' })
  })

  test('a Member’s choice while the question is out is not undone by the answer', async () => {
    const { t, groups } = await seed()
    modelAnswers('pasta_world')
    const task = await addItem(t, 0, groups[0].groceries, 'doenjang')
    await t.withIdentity(alice).mutation(api.tasks.update, {
      taskId: task,
      groupSlug: SLUGS[0],
      category: 'other',
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await categoryOf(t, task)).toBe('other')
  })

  test('a waiting item follows the Group’s choice, not the late answer', async () => {
    const { t, groups } = await seed()
    modelAnswers('pasta_world')
    const first = await addItem(t, 0, groups[0].groceries, 'doenjang')
    const second = await addItem(t, 0, groups[0].groceries, 'doenjang')
    await t.withIdentity(alice).mutation(api.tasks.update, {
      taskId: first,
      groupSlug: SLUGS[0],
      category: 'snacks',
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await categoryOf(t, first)).toBe('snacks')
    expect(await categoryOf(t, second)).toBe('snacks')
  })

  test('an aisle sent for an item on another list is ignored', async () => {
    const { t, groups } = await seed()
    const task = await addItem(t, 0, groups[0].chores, 'melk')
    await t.withIdentity(alice).mutation(api.tasks.update, {
      taskId: task,
      groupSlug: SLUGS[0],
      category: 'drinks',
    })
    expect(await categoryOf(t, task)).toBeUndefined()
    expect(
      await t.run((ctx) => ctx.db.query('groceryCategoryOverrides').collect()),
    ).toEqual([])
  })

  test('a new grocery list’s starter items get their aisles', async () => {
    const { t } = await seed()
    const listId = await t.withIdentity(alice).mutation(api.taskLists.create, {
      name: 'Boodschappen',
      provider: 'local',
      groupSlug: SLUGS[0],
      idempotencyKey: crypto.randomUUID(),
      kind: 'groceries',
      starterTasks: ['melk', 'brood'],
    })
    const items = await t.run((ctx) =>
      ctx.db
        .query('tasks')
        .withIndex('by_list', (q) => q.eq('listId', listId))
        .collect(),
    )
    expect(items.map((item) => [item.title, item.category])).toEqual([
      ['melk', 'dairy'],
      ['brood', 'bakery'],
    ])
  })

  test('a renamed item gets the aisle of its new name', async () => {
    const { t, groups } = await seed()
    modelAnswers('other')
    const task = await addItem(t, 0, groups[0].groceries, 'melk')
    await t.withIdentity(alice).mutation(api.tasks.update, {
      taskId: task,
      groupSlug: SLUGS[0],
      title: 'brood',
    })
    expect(await categoryOf(t, task)).toBe('bakery')
  })

  test('an item moved onto the grocery list gets an aisle', async () => {
    const { t, groups } = await seed()
    const task = await addItem(t, 0, groups[0].chores, 'appels')
    await t.withIdentity(alice).mutation(api.tasks.moveToList, {
      taskId: task,
      groupSlug: SLUGS[0],
      listId: groups[0].groceries,
    })
    expect(await categoryOf(t, task)).toBe('produce')
  })
})

describe('access', () => {
  test('a signed-out caller can neither add nor correct', async () => {
    const { t, groups } = await seed()
    const task = await addItem(t, 0, groups[0].groceries, 'melk')
    await expect(
      t.mutation(api.tasks.add, {
        listId: groups[0].groceries,
        groupSlug: SLUGS[0],
        title: 'melk',
      }),
    ).rejects.toThrow()
    await expect(
      t.mutation(api.tasks.update, {
        taskId: task,
        groupSlug: SLUGS[0],
        category: 'drinks',
      }),
    ).rejects.toThrow()
    const overrides = await t.run((ctx) =>
      ctx.db.query('groceryCategoryOverrides').collect(),
    )
    expect(overrides).toEqual([])
  })

  test('a Member of another Group cannot correct this Group’s item', async () => {
    const { t, groups } = await seed()
    const task = await addItem(t, 0, groups[0].groceries, 'melk')
    await expect(
      t.withIdentity(bob).mutation(api.tasks.update, {
        taskId: task,
        groupSlug: SLUGS[1],
        category: 'drinks',
      }),
    ).rejects.toThrow('Task not found')
    expect(await categoryOf(t, task)).toBe('dairy')
  })

  test('the budget counter is not a public function', () => {
    expect(Object.keys(api)).not.toContain('groceryCategories')
    expect(internal.groceryCategories.takeBudget).toBeDefined()
  })
})

describe('history window', () => {
  test('an add reads only the list’s newest items for history', async () => {
    const { t, groups } = await seed()
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const listId = groups[0].groceries
    // An old item the Group put in drinks, then a full window of newer ones.
    await t.run(async (ctx) => {
      const userId = (await ctx.db.query('users').first())!._id
      await ctx.db.insert('tasks', {
        listId,
        title: 'doenjang',
        done: true,
        createdBy: userId,
        order: 0,
        category: 'drinks',
      })
      for (let index = 1; index <= GROCERY_HISTORY_WINDOW; index++)
        await ctx.db.insert('tasks', {
          listId,
          title: `item ${index}`,
          done: true,
          createdBy: userId,
          order: index,
          category: 'other',
        })
    })
    const added = await addItem(t, 0, listId, 'doenjang')
    const task = await t.run((ctx) => ctx.db.get(added))
    // Out of the window: not history any more, so the name is unknown again.
    expect(task?.category).toBe('other')
    // And it still goes to the end of the list.
    expect(task?.order).toBe(GROCERY_HISTORY_WINDOW + 1)
  })

  test('an item inside the window is the Group’s history', async () => {
    const { t, groups } = await seed()
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const listId = groups[0].groceries
    await t.run(async (ctx) => {
      const userId = (await ctx.db.query('users').first())!._id
      await ctx.db.insert('tasks', {
        listId,
        title: 'doenjang',
        done: true,
        createdBy: userId,
        order: 5,
        category: 'drinks',
      })
    })
    expect(await categoryOf(t, await addItem(t, 0, listId, 'Doenjang'))).toBe('drinks')
  })
})
