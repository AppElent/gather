import { describe, expect, test } from 'vitest'
import {
  alice,
  bob,
  seedGroup,
  seedMember,
  testConvex,
} from '../test/convexHarness'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

/**
 * Sections inside a list (APP-357), through the real functions.
 *
 * Alice is in both households and Bob only in De Vries, so every write is
 * checked against the list's own Group, not "some Group the caller is in".
 */

const JANSEN = 'jansen-household'
const DE_VRIES = 'de-vries-household'

async function seed() {
  const t = testConvex()
  const ids = await t.run(async (ctx) => {
    const aliceId = await ctx.db.insert('users', {
      clerkId: alice.subject,
      name: 'Alice',
      email: alice.email,
    })
    const bobId = await ctx.db.insert('users', {
      clerkId: bob.subject,
      name: 'Bob',
      email: bob.email,
    })
    const jansen = await seedGroup(ctx, {
      name: 'Jansen Household',
      slug: JANSEN,
      inviteCode: 'jansen',
    })
    const devries = await seedGroup(ctx, {
      name: 'De Vries Household',
      slug: DE_VRIES,
      inviteCode: 'devries',
    })
    await seedMember(ctx, jansen, aliceId, 'admin')
    await seedMember(ctx, devries, aliceId, 'member')
    await seedMember(ctx, devries, bobId, 'admin')
    // A list from before sections: no `sections`, tasks with no `sectionId`.
    const list = await ctx.db.insert('taskLists', {
      groupId: jansen,
      name: 'Old list',
      provider: 'local',
      order: 0,
    })
    const other = await ctx.db.insert('taskLists', {
      groupId: jansen,
      name: 'Other list',
      provider: 'local',
      order: 1,
    })
    const task = (title: string, order: number) =>
      ctx.db.insert('tasks', {
        listId: list,
        title,
        done: false,
        createdBy: aliceId,
        order,
      })
    const a = await task('A', 0)
    const b = await task('B', 1)
    const c = await task('C', 2)
    return { list, other, a, b, c }
  })
  return { t, as: t.withIdentity(alice), ...ids }
}

async function refusal(run: Promise<unknown>): Promise<string> {
  try {
    await run
    return 'no refusal'
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

async function sectionsOf(
  as: ReturnType<ReturnType<typeof testConvex>['withIdentity']>,
  listId: Id<'taskLists'>,
) {
  const lists = await as.query(api.taskLists.list, { groupSlug: JANSEN })
  return lists.find((list) => list._id === listId)?.sections ?? []
}

describe('a list from before sections', () => {
  test('reads as no sections, and its tasks have none', async () => {
    const { as, list } = await seed()
    expect(await sectionsOf(as, list)).toEqual([])
    const tasks = await as.query(api.tasks.listByList, {
      listId: list,
      groupSlug: JANSEN,
    })
    expect(tasks.every((task) => task.sectionId === undefined)).toBe(true)
  })
})

describe('managing sections', () => {
  test('add, rename and reorder', async () => {
    const { as, list } = await seed()
    const kitchen = await as.mutation(api.taskSections.add, {
      listId: list,
      groupSlug: JANSEN,
      name: '  Kitchen ',
    })
    const bath = await as.mutation(api.taskSections.add, {
      listId: list,
      groupSlug: JANSEN,
      name: 'Bathroom',
    })
    expect(kitchen).not.toBe(bath)
    expect(await sectionsOf(as, list)).toEqual([
      { id: kitchen, name: 'Kitchen' },
      { id: bath, name: 'Bathroom' },
    ])

    await as.mutation(api.taskSections.rename, {
      listId: list,
      groupSlug: JANSEN,
      sectionId: kitchen,
      name: 'Keuken',
    })
    await as.mutation(api.taskSections.reorder, {
      listId: list,
      groupSlug: JANSEN,
      sectionIds: [bath, kitchen],
    })
    expect(await sectionsOf(as, list)).toEqual([
      { id: bath, name: 'Bathroom' },
      { id: kitchen, name: 'Keuken' },
    ])
  })

  test('refuses an empty or too long name, and a reorder that drops one', async () => {
    const { as, list } = await seed()
    const add = (name: string) =>
      refusal(
        as.mutation(api.taskSections.add, {
          listId: list,
          groupSlug: JANSEN,
          name,
        }),
      )
    expect(await add('   ')).toContain('A section needs a name')
    expect(await add('x'.repeat(81))).toContain('A section needs a name')
    const one = await as.mutation(api.taskSections.add, {
      listId: list,
      groupSlug: JANSEN,
      name: 'One',
    })
    await as.mutation(api.taskSections.add, {
      listId: list,
      groupSlug: JANSEN,
      name: 'Two',
    })
    expect(
      await refusal(
        as.mutation(api.taskSections.reorder, {
          listId: list,
          groupSlug: JANSEN,
          sectionIds: [one, one],
        }),
      ),
    ).toContain('every section exactly once')
    expect(
      await refusal(
        as.mutation(api.taskSections.rename, {
          listId: list,
          groupSlug: JANSEN,
          sectionId: 'nope',
          name: 'X',
        }),
      ),
    ).toContain('Section not found')
  })

  test('refuses more than thirty sections', async () => {
    const { as, list } = await seed()
    for (let i = 0; i < 30; i++) {
      await as.mutation(api.taskSections.add, {
        listId: list,
        groupSlug: JANSEN,
        name: `S${i}`,
      })
    }
    expect(
      await refusal(
        as.mutation(api.taskSections.add, {
          listId: list,
          groupSlug: JANSEN,
          name: 'One too many',
        }),
      ),
    ).toContain('Too many sections')
  })

  test('deleting a section keeps its tasks, under No section', async () => {
    const { as, list, a, b } = await seed()
    const kitchen = await as.mutation(api.taskSections.add, {
      listId: list,
      groupSlug: JANSEN,
      name: 'Kitchen',
    })
    await as.mutation(api.tasks.setSection, {
      taskId: a,
      groupSlug: JANSEN,
      sectionId: kitchen,
    })
    await as.mutation(api.tasks.setSection, {
      taskId: b,
      groupSlug: JANSEN,
      sectionId: kitchen,
    })
    await as.mutation(api.taskSections.remove, {
      listId: list,
      groupSlug: JANSEN,
      sectionId: kitchen,
    })
    expect(await sectionsOf(as, list)).toEqual([])
    const tasks = await as.query(api.tasks.listByList, {
      listId: list,
      groupSlug: JANSEN,
    })
    expect(tasks.map((task) => task.title).sort()).toEqual(['A', 'B', 'C'])
    expect(tasks.every((task) => task.sectionId === undefined)).toBe(true)
  })

  test('only a Member of the list’s own Group may change its sections', async () => {
    const { t, list } = await seed()
    const asBob = t.withIdentity(bob)
    // Bob is not in Jansen at all.
    expect(
      await refusal(
        asBob.mutation(api.taskSections.add, {
          listId: list,
          groupSlug: JANSEN,
          name: 'Sneaky',
        }),
      ),
    ).not.toBe('no refusal')
    // Naming his own Group does not reach a list in another one.
    expect(
      await refusal(
        asBob.mutation(api.taskSections.add, {
          listId: list,
          groupSlug: DE_VRIES,
          name: 'Sneaky',
        }),
      ),
    ).toContain('List not found')
    // Alice is in both, and still has to name the list's own Group.
    expect(
      await refusal(
        t.withIdentity(alice).mutation(api.taskSections.add, {
          listId: list,
          groupSlug: DE_VRIES,
          name: 'Wrong Group',
        }),
      ),
    ).toContain('List not found')
    for (const run of [
      asBob.mutation(api.taskSections.rename, {
        listId: list,
        groupSlug: DE_VRIES,
        sectionId: 'x',
        name: 'x',
      }),
      asBob.mutation(api.taskSections.reorder, {
        listId: list,
        groupSlug: DE_VRIES,
        sectionIds: [],
      }),
      asBob.mutation(api.taskSections.remove, {
        listId: list,
        groupSlug: DE_VRIES,
        sectionId: 'x',
      }),
    ]) {
      expect(await refusal(run)).toContain('List not found')
    }
  })

  test('a linked list has no sections', async () => {
    const { t, as } = await seed()
    const linked = await t.run(async (ctx) => {
      const group = await ctx.db
        .query('groups')
        .withIndex('by_slug', (q) => q.eq('slug', JANSEN))
        .unique()
      return await ctx.db.insert('taskLists', {
        groupId: group!._id,
        name: 'Notion',
        provider: 'notion',
        order: 2,
      })
    })
    expect(
      await refusal(
        as.mutation(api.taskSections.add, {
          listId: linked,
          groupSlug: JANSEN,
          name: 'X',
        }),
      ),
    ).toContain('read-only')
  })
})

describe('tasks in sections', () => {
  test('a task is added to a section, moved, and moved out again', async () => {
    const { as, list, a } = await seed()
    const kitchen = await as.mutation(api.taskSections.add, {
      listId: list,
      groupSlug: JANSEN,
      name: 'Kitchen',
    })
    const added = await as.mutation(api.tasks.add, {
      listId: list,
      groupSlug: JANSEN,
      title: 'Wipe the counter',
      sectionId: kitchen,
    })
    await as.mutation(api.tasks.setSection, {
      taskId: a,
      groupSlug: JANSEN,
      sectionId: kitchen,
    })
    let tasks = await as.query(api.tasks.listByList, {
      listId: list,
      groupSlug: JANSEN,
    })
    const byId = (id: Id<'tasks'>) => tasks.find((task) => task._id === id)
    expect(byId(added)?.sectionId).toBe(kitchen)
    expect(byId(a)?.sectionId).toBe(kitchen)
    // Moved in, it goes last.
    expect(byId(a)?.order).toBeGreaterThan(byId(added)?.order ?? 0)

    await as.mutation(api.tasks.setSection, {
      taskId: a,
      groupSlug: JANSEN,
      sectionId: null,
    })
    tasks = await as.query(api.tasks.listByList, {
      listId: list,
      groupSlug: JANSEN,
    })
    expect(byId(a)?.sectionId).toBeUndefined()
  })

  test('a section the list does not have is refused on a move and ignored on an add', async () => {
    const { as, list, a } = await seed()
    expect(
      await refusal(
        as.mutation(api.tasks.setSection, {
          taskId: a,
          groupSlug: JANSEN,
          sectionId: 'not-a-section',
        }),
      ),
    ).toContain('Section not found')
    const added = await as.mutation(api.tasks.add, {
      listId: list,
      groupSlug: JANSEN,
      title: 'From an offline phone',
      sectionId: 'deleted-meanwhile',
    })
    const tasks = await as.query(api.tasks.listByList, {
      listId: list,
      groupSlug: JANSEN,
    })
    expect(tasks.find((task) => task._id === added)?.sectionId).toBeUndefined()
  })

  test('a task cannot be moved into a section from another Group', async () => {
    const { t, a } = await seed()
    expect(
      await refusal(
        t.withIdentity(bob).mutation(api.tasks.setSection, {
          taskId: a,
          groupSlug: DE_VRIES,
          sectionId: null,
        }),
      ),
    ).toContain('Task not found')
  })

  test('a drag in Reorder mode moves tasks between sections', async () => {
    const { as, list, a, b, c } = await seed()
    const kitchen = await as.mutation(api.taskSections.add, {
      listId: list,
      groupSlug: JANSEN,
      name: 'Kitchen',
    })
    await as.mutation(api.tasks.reorder, {
      listId: list,
      groupSlug: JANSEN,
      ids: [c, a, b],
      sectionIds: [null, kitchen, kitchen],
    })
    const tasks = await as.query(api.tasks.listByList, {
      listId: list,
      groupSlug: JANSEN,
    })
    expect(tasks.map((task) => [task.title, task.sectionId])).toEqual([
      ['C', undefined],
      ['A', kitchen],
      ['B', kitchen],
    ])
  })

  test('a reorder naming a section deleted meanwhile files the task under No section', async () => {
    const { as, list, a, b, c } = await seed()
    const kitchen = await as.mutation(api.taskSections.add, {
      listId: list,
      groupSlug: JANSEN,
      name: 'Kitchen',
    })
    // Another phone deletes Kitchen while this one is still in Reorder mode.
    await as.mutation(api.taskSections.remove, {
      listId: list,
      groupSlug: JANSEN,
      sectionId: kitchen,
    })
    await as.mutation(api.tasks.reorder, {
      listId: list,
      groupSlug: JANSEN,
      ids: [a, b, c],
      sectionIds: [kitchen, kitchen, null],
    })
    const tasks = await as.query(api.tasks.listByList, {
      listId: list,
      groupSlug: JANSEN,
    })
    expect(tasks.map((task) => [task.title, task.sectionId])).toEqual([
      ['A', undefined],
      ['B', undefined],
      ['C', undefined],
    ])
  })

  test('a reorder from an app older than sections leaves sections alone', async () => {
    const { as, list, a, b, c } = await seed()
    const kitchen = await as.mutation(api.taskSections.add, {
      listId: list,
      groupSlug: JANSEN,
      name: 'Kitchen',
    })
    await as.mutation(api.tasks.setSection, {
      taskId: a,
      groupSlug: JANSEN,
      sectionId: kitchen,
    })
    await as.mutation(api.tasks.reorder, {
      listId: list,
      groupSlug: JANSEN,
      ids: [a, c, b],
    })
    const tasks = await as.query(api.tasks.listByList, {
      listId: list,
      groupSlug: JANSEN,
    })
    expect(tasks.find((task) => task._id === a)?.sectionId).toBe(kitchen)
    expect(
      await refusal(
        as.mutation(api.tasks.reorder, {
          listId: list,
          groupSlug: JANSEN,
          ids: [a, b, c],
          sectionIds: [null],
        }),
      ),
    ).toContain('Every task needs its section')
  })

  test('moving a task to another list leaves its section behind', async () => {
    const { as, list, other, a } = await seed()
    const kitchen = await as.mutation(api.taskSections.add, {
      listId: list,
      groupSlug: JANSEN,
      name: 'Kitchen',
    })
    await as.mutation(api.tasks.setSection, {
      taskId: a,
      groupSlug: JANSEN,
      sectionId: kitchen,
    })
    await as.mutation(api.tasks.moveToList, {
      taskId: a,
      groupSlug: JANSEN,
      listId: other,
    })
    const tasks = await as.query(api.tasks.listByList, {
      listId: other,
      groupSlug: JANSEN,
    })
    expect(tasks[0]?.sectionId).toBeUndefined()
  })
})

describe('a template’s starter items arrive in sections', () => {
  test('the sections and their items, in order', async () => {
    const { as } = await seed()
    const listId = await as.mutation(api.taskLists.create, {
      groupSlug: JANSEN,
      name: 'Huishouden',
      provider: 'local',
      kind: 'chores',
      starterSections: [
        { name: 'Keuken', tasks: ['Kliko aan de straat', 'Koelkast uitsoppen'] },
        { name: 'Badkamer', tasks: ['Handdoeken wassen'] },
      ],
    })
    const sections = await sectionsOf(as, listId)
    expect(sections.map((section) => section.name)).toEqual([
      'Keuken',
      'Badkamer',
    ])
    const tasks = await as.query(api.tasks.listByList, {
      listId,
      groupSlug: JANSEN,
    })
    expect(
      tasks.map((task) => [
        task.title,
        sections.find((s) => s.id === task.sectionId)?.name,
      ]),
    ).toEqual([
      ['Kliko aan de straat', 'Keuken'],
      ['Koelkast uitsoppen', 'Keuken'],
      ['Handdoeken wassen', 'Badkamer'],
    ])
  })

  test('refuses both shapes at once, and too many items across sections', async () => {
    const { as } = await seed()
    const make = (fields: object) =>
      refusal(
        as.mutation(api.taskLists.create, {
          groupSlug: JANSEN,
          name: 'Bad',
          provider: 'local',
          ...fields,
        }),
      )
    expect(
      await make({
        starterTasks: ['x'],
        starterSections: [{ name: 'A', tasks: ['y'] }],
      }),
    ).toContain('not both')
    expect(
      await make({
        starterSections: [
          { name: 'A', tasks: Array.from({ length: 30 }, () => 'x') },
          { name: 'B', tasks: Array.from({ length: 30 }, () => 'x') },
        ],
      }),
    ).toContain('Too many starter tasks')
    expect(await make({ starterSections: [{ name: ' ', tasks: [] }] })).toContain(
      'A section needs a name',
    )
  })
})
