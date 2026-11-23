import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  alice as asAlice,
  bob as asBob,
  carol as asCarol,
  seedGroup,
  seedMember,
  testConvex,
} from '../test/convexHarness'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

/**
 * One responsible Member per task (APP-302), through the real functions.
 *
 * Alice and Bob share the Household; Bob is also in the Club, and Carol only
 * in the Club. Every push is counted at Expo's door, because that is the only
 * thing a person notices; the in-app notice is the task's `assignmentNotice`.
 */

type Harness = ReturnType<typeof testConvex>

interface Sent {
  to: string
  title: string
  body: string
}

function stubExpo() {
  const sent: Sent[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body))
      if (url.endsWith('/push/send')) {
        const data = (body as Sent[]).map((message, index) => {
          sent.push(message)
          return { status: 'ok', id: `ticket-${sent.length}-${index}` }
        })
        return Response.json({ data })
      }
      return Response.json({ data: {} })
    }),
  )
  return sent
}

const HOUSE = 'house'
const CLUB = 'club'

async function world(t: Harness) {
  for (const who of [asAlice, asBob, asCarol])
    await t.withIdentity(who).mutation(api.users.ensureUser, {})
  return await t.run(async (ctx) => {
    const idOf = async (subject: string) => {
      const row = await ctx.db
        .query('users')
        .withIndex('by_clerkId', (q) => q.eq('clerkId', subject))
        .unique()
      if (!row) throw new Error('no user')
      return row._id
    }
    const alice = await idOf(asAlice.subject)
    const bob = await idOf(asBob.subject)
    const carol = await idOf(asCarol.subject)
    const house = await seedGroup(ctx, { name: 'Household', slug: HOUSE })
    const club = await seedGroup(ctx, { name: 'Club', slug: CLUB })
    await seedMember(ctx, house, alice, 'admin')
    await seedMember(ctx, house, bob)
    await seedMember(ctx, club, bob, 'admin')
    await seedMember(ctx, club, carol, 'admin')
    const chores = await ctx.db.insert('taskLists', {
      groupId: house,
      name: 'Chores',
      provider: 'local',
      order: 0,
    })
    const clubList = await ctx.db.insert('taskLists', {
      groupId: club,
      name: 'Club jobs',
      provider: 'local',
      order: 0,
    })
    const taskId = await ctx.db.insert('tasks', {
      listId: chores,
      title: 'Take out the bins',
      done: false,
      createdBy: alice,
      order: 0,
    })
    const clubTask = await ctx.db.insert('tasks', {
      listId: clubList,
      title: 'Mow the field',
      done: false,
      createdBy: carol,
      order: 0,
    })
    return { alice, bob, carol, house, club, chores, taskId, clubTask }
  })
}

async function phone(t: Harness, who: typeof asBob, locale: 'en' | 'nl') {
  await t.withIdentity(who).mutation(api.notifications.registerDevice, {
    token: `ExponentPushToken[${who.name}-${locale}]`,
    platform: 'ios',
    locale,
  })
}

async function taskOf(t: Harness, id: Id<'tasks'>) {
  return await t.run(async (ctx) => ctx.db.get(id))
}

async function drain(t: Harness) {
  await t.finishAllScheduledFunctions(vi.runAllTimers)
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('assigning a task', () => {
  test('to someone else leaves them a notice and pushes it in their language', async () => {
    const t = testConvex()
    const w = await world(t)
    await phone(t, asBob, 'en')
    await phone(t, asBob, 'nl')
    const sent = stubExpo()

    await t.withIdentity(asAlice).mutation(api.tasks.update, {
      taskId: w.taskId,
      groupSlug: HOUSE,
      assigneeId: w.bob,
      dueDate: '2026-12-01',
    })
    await drain(t)

    const task = await taskOf(t, w.taskId)
    expect(task?.assigneeId).toBe(w.bob)
    expect(task?.assignmentNotice?.by).toBe(w.alice)
    expect(sent.map(({ to, title, body }) => ({ to, title, body }))).toEqual([
      {
        to: 'ExponentPushToken[Bob-en]',
        title: 'Household',
        body: 'Alice gave you a task: Take out the bins, Tue 1 Dec',
      },
      {
        to: 'ExponentPushToken[Bob-nl]',
        title: 'Household',
        body: 'Alice gaf je een taak: Take out the bins, di 1 dec',
      },
    ])
  })

  test('says no date when the task has none, and works on create', async () => {
    const t = testConvex()
    const w = await world(t)
    await phone(t, asBob, 'en')
    const sent = stubExpo()

    const id = await t.withIdentity(asAlice).mutation(api.tasks.add, {
      listId: w.chores,
      groupSlug: HOUSE,
      title: 'Water the plants',
      assigneeId: w.bob,
      idempotencyKey: 'f1b5a3c2-6f1e-4b4e-9d1a-2b3c4d5e6f70',
    })
    await drain(t)

    expect((await taskOf(t, id))?.assigneeId).toBe(w.bob)
    expect(sent.map((m) => m.body)).toEqual([
      'Alice gave you a task: Water the plants',
    ])
  })

  test('to yourself, clearing, or the same person again tells nobody', async () => {
    const t = testConvex()
    const w = await world(t)
    await phone(t, asAlice, 'en')
    await phone(t, asBob, 'en')
    const sent = stubExpo()
    const asA = t.withIdentity(asAlice)
    const base = { taskId: w.taskId, groupSlug: HOUSE }

    await asA.mutation(api.tasks.update, { ...base, assigneeId: w.alice })
    expect((await taskOf(t, w.taskId))?.assignmentNotice).toBeUndefined()

    await asA.mutation(api.tasks.update, { ...base, assigneeId: w.bob })
    await asA.mutation(api.tasks.update, { ...base, assigneeId: w.bob })
    await asA.mutation(api.tasks.update, { ...base, assigneeId: null })
    await drain(t)

    const task = await taskOf(t, w.taskId)
    expect(task?.assigneeId).toBeUndefined()
    expect(task?.assignmentNotice).toBeUndefined()
    // Only the one change that gave Bob the task.
    expect(sent.map((m) => m.to)).toEqual(['ExponentPushToken[Bob-en]'])
  })

  test('respects the assignment switch and the Group mute, but still leaves the notice', async () => {
    const t = testConvex()
    const w = await world(t)
    await phone(t, asBob, 'en')
    const sent = stubExpo()
    const asB = t.withIdentity(asBob)
    const asA = t.withIdentity(asAlice)
    const base = { taskId: w.taskId, groupSlug: HOUSE }

    await asB.mutation(api.notifications.setSwitch, {
      name: 'taskAssignments',
      enabled: false,
    })
    await asA.mutation(api.tasks.update, { ...base, assigneeId: w.bob })
    await asA.mutation(api.tasks.update, { ...base, assigneeId: null })
    await asB.mutation(api.notifications.setSwitch, {
      name: 'taskAssignments',
      enabled: true,
    })
    await asB.mutation(api.notifications.setGroupMuted, {
      groupSlug: HOUSE,
      muted: true,
    })
    await asA.mutation(api.tasks.update, { ...base, assigneeId: w.bob })
    await drain(t)

    expect(sent).toEqual([])
    expect((await taskOf(t, w.taskId))?.assignmentNotice?.by).toBe(w.alice)
  })

  test('without a registered phone succeeds quietly', async () => {
    const t = testConvex()
    const w = await world(t)
    const sent = stubExpo()
    await t.withIdentity(asAlice).mutation(api.tasks.update, {
      taskId: w.taskId,
      groupSlug: HOUSE,
      assigneeId: w.bob,
    })
    await drain(t)
    expect(sent).toEqual([])
    expect((await taskOf(t, w.taskId))?.assignmentNotice?.by).toBe(w.alice)
  })
})

describe('who may be assigned', () => {
  test('refuses someone who is not a current Member of the Group', async () => {
    const t = testConvex()
    const w = await world(t)
    const asA = t.withIdentity(asAlice)

    // Carol exists, and shares a Group with Bob, but not this one.
    await expect(
      asA.mutation(api.tasks.update, {
        taskId: w.taskId,
        groupSlug: HOUSE,
        assigneeId: w.carol,
      }),
    ).rejects.toMatchObject({ data: { kind: 'tasks:assignee-not-member' } })
    await expect(
      asA.mutation(api.tasks.add, {
        listId: w.chores,
        groupSlug: HOUSE,
        title: 'Sneaky',
        assigneeId: w.carol,
        idempotencyKey: '0b1c2d3e-4f50-4a61-8b72-9c8d7e6f5a40',
      }),
    ).rejects.toMatchObject({ data: { kind: 'tasks:assignee-not-member' } })
    expect((await taskOf(t, w.taskId))?.assigneeId).toBeUndefined()
  })

  test('a client that does not know the field leaves it alone', async () => {
    const t = testConvex()
    const w = await world(t)
    const asA = t.withIdentity(asAlice)
    await asA.mutation(api.tasks.update, {
      taskId: w.taskId,
      groupSlug: HOUSE,
      assigneeId: w.bob,
    })
    // What an installed app from before assignees sends.
    await asA.mutation(api.tasks.update, {
      taskId: w.taskId,
      groupSlug: HOUSE,
      title: 'Take out both bins',
      dueDate: null,
    })
    await asA.mutation(api.tasks.toggleDone, {
      taskId: w.taskId,
      groupSlug: HOUSE,
    })
    const task = await taskOf(t, w.taskId)
    expect(task?.title).toBe('Take out both bins')
    expect(task?.assigneeId).toBe(w.bob)
  })
})

describe('the in-app notice', () => {
  test('clears when the assignee opens the task, and only then', async () => {
    const t = testConvex()
    const w = await world(t)
    const base = { taskId: w.taskId, groupSlug: HOUSE }
    await t
      .withIdentity(asAlice)
      .mutation(api.tasks.update, { ...base, assigneeId: w.bob })

    await t.withIdentity(asAlice).mutation(api.tasks.markAssignmentSeen, base)
    expect((await taskOf(t, w.taskId))?.assignmentNotice).toBeDefined()

    await t.withIdentity(asBob).mutation(api.tasks.markAssignmentSeen, base)
    const task = await taskOf(t, w.taskId)
    expect(task?.assignmentNotice).toBeUndefined()
    expect(task?.assigneeId).toBe(w.bob)
  })

  test('is refused to a non-Member like any other task write', async () => {
    const t = testConvex()
    const w = await world(t)
    await expect(
      t.withIdentity(asCarol).mutation(api.tasks.markAssignmentSeen, {
        taskId: w.taskId,
        groupSlug: HOUSE,
      }),
    ).rejects.toThrow()
  })
})

describe('leaving a Group', () => {
  test("clears the leaver's tasks there and nowhere else", async () => {
    const t = testConvex()
    const w = await world(t)
    await t.withIdentity(asAlice).mutation(api.tasks.update, {
      taskId: w.taskId,
      groupSlug: HOUSE,
      assigneeId: w.bob,
    })
    await t.withIdentity(asCarol).mutation(api.tasks.update, {
      taskId: w.clubTask,
      groupSlug: CLUB,
      assigneeId: w.bob,
    })

    await t
      .withIdentity(asBob)
      .mutation(api.groups.leaveGroup, { groupId: w.house })

    const left = await taskOf(t, w.taskId)
    expect(left?.assigneeId).toBeUndefined()
    expect(left?.assignmentNotice).toBeUndefined()
    const stays = await taskOf(t, w.clubTask)
    expect(stays?.assigneeId).toBe(w.bob)
    expect(stays?.assignmentNotice?.by).toBe(w.carol)
  })

  test("deleting an account clears the person's tasks in shared Groups", async () => {
    const t = testConvex()
    const w = await world(t)
    await t.withIdentity(asAlice).mutation(api.tasks.update, {
      taskId: w.taskId,
      groupSlug: HOUSE,
      assigneeId: w.bob,
    })
    await t.withIdentity(asBob).mutation(api.accounts.deleteAccount, {})
    await drain(t)
    expect((await taskOf(t, w.taskId))?.assigneeId).toBeUndefined()
  })
})

/**
 * Calendar events keep a list of Members too (APP-407). Bob is on two Household
 * events (one shared with Alice) and one Club event; a fourth Household event
 * is Alice's alone, so it must come through untouched, revision and all.
 */
async function eventWorld(t: Harness) {
  const w = await world(t)
  return await t.run(async (ctx) => {
    const calendar = async (groupId: Id<'groups'>, createdBy: Id<'users'>) =>
      ctx.db.insert('calendars', {
        groupId,
        name: 'Agenda',
        source: 'local',
        createdBy,
      })
    const home = await calendar(w.house, w.alice)
    const school = await calendar(w.house, w.alice)
    const field = await calendar(w.club, w.carol)
    const event = (
      calendarId: Id<'calendars'>,
      assigneeIds: Id<'users'>[],
      revision?: number,
    ) =>
      ctx.db.insert('calendarEvents', {
        calendarId,
        title: 'Event',
        date: '2026-11-21',
        createdBy: w.alice,
        assigneeIds,
        revision,
      })
    return {
      ...w,
      shared: await event(home, [w.alice, w.bob], 3),
      bobsOwn: await event(school, [w.bob]),
      alices: await event(home, [w.alice], 5),
      clubEvent: await event(field, [w.carol, w.bob], 2),
    }
  })
}

async function eventOf(t: Harness, id: Id<'calendarEvents'>) {
  return await t.run(async (ctx) => ctx.db.get(id))
}

describe('leaving a Group, calendar events (APP-407)', () => {
  test('drops the leaver from that Group’s events only, bumping the revision of those it touched', async () => {
    const t = testConvex()
    const w = await eventWorld(t)

    await t
      .withIdentity(asBob)
      .mutation(api.groups.leaveGroup, { groupId: w.house })

    const shared = await eventOf(t, w.shared)
    expect(shared?.assigneeIds).toEqual([w.alice])
    expect(shared?.revision).toBe(4)
    const bobsOwn = await eventOf(t, w.bobsOwn)
    expect(bobsOwn).not.toBeNull()
    expect(bobsOwn?.assigneeIds).toEqual([])
    expect(bobsOwn?.revision).toBe(1)
    const alices = await eventOf(t, w.alices)
    expect(alices?.assigneeIds).toEqual([w.alice])
    expect(alices?.revision).toBe(5)
    const club = await eventOf(t, w.clubEvent)
    expect(club?.assigneeIds).toEqual([w.carol, w.bob])
    expect(club?.revision).toBe(2)
  })

  test('an editor still holding the old list gets a conflict', async () => {
    const t = testConvex()
    const w = await eventWorld(t)
    const before = await eventOf(t, w.shared)
    if (!before) throw new Error('no event')
    await t
      .withIdentity(asBob)
      .mutation(api.groups.leaveGroup, { groupId: w.house })

    await expect(
      t.withIdentity(asAlice).mutation(api.calendar.updateEvent, {
        groupSlug: HOUSE,
        id: w.shared,
        expectedRevision: 3,
        title: 'Event',
        calendarId: before.calendarId,
        date: '2026-11-21',
        allDay: true,
        startMinutes: null,
        endMinutes: null,
        assigneeIds: [w.alice, w.bob],
        location: null,
        notes: null,
      }),
    ).rejects.toThrow('calendar:conflict')
    expect((await eventOf(t, w.shared))?.assigneeIds).toEqual([w.alice])
  })

  test('deleting an account drops the person from events in shared Groups', async () => {
    const t = testConvex()
    const w = await eventWorld(t)
    await t.withIdentity(asBob).mutation(api.accounts.deleteAccount, {})
    await drain(t)
    const shared = await eventOf(t, w.shared)
    expect(shared?.assigneeIds).toEqual([w.alice])
    expect(shared?.revision).toBe(4)
    expect((await eventOf(t, w.alices))?.revision).toBe(5)
    const club = await eventOf(t, w.clubEvent)
    expect(club?.assigneeIds).toEqual([w.carol])
    expect(club?.revision).toBe(3)
  })
})

describe('a repeating task (APP-303)', () => {
  test('completing keeps the assignee and pushes nothing', async () => {
    const t = testConvex()
    const w = await world(t)
    await phone(t, asBob, 'en')
    const sent = stubExpo()
    await t.withIdentity(asAlice).mutation(api.tasks.update, {
      taskId: w.taskId,
      groupSlug: HOUSE,
      assigneeId: w.bob,
      dueDate: '2026-12-01',
      repeat: { mode: 'fixed', unit: 'week', every: 1 },
    })
    await drain(t)
    expect(sent).toHaveLength(1)
    const before = await taskOf(t, w.taskId)

    // Bob ticks it on his phone, then Alice completes the next one through
    // update, as the MCP does.
    await t
      .withIdentity(asBob)
      .mutation(api.tasks.toggleDone, { taskId: w.taskId, groupSlug: HOUSE })
    await t.withIdentity(asAlice).mutation(api.tasks.update, {
      taskId: w.taskId,
      groupSlug: HOUSE,
      done: true,
    })
    await drain(t)

    const after = await taskOf(t, w.taskId)
    expect(after?.done).toBe(false)
    expect(after?.dueDate).not.toBe(before?.dueDate)
    expect(after?.assigneeId).toBe(w.bob)
    expect(after?.assignmentNotice).toEqual(before?.assignmentNotice)
    expect(sent).toHaveLength(1)
  })

  test('leaving the Group unassigns them and keeps their completions named', async () => {
    const t = testConvex()
    const w = await world(t)
    stubExpo()
    await t.withIdentity(asAlice).mutation(api.tasks.update, {
      taskId: w.taskId,
      groupSlug: HOUSE,
      assigneeId: w.bob,
      repeat: { mode: 'afterDone', unit: 'day', every: 3 },
    })
    await t
      .withIdentity(asBob)
      .mutation(api.tasks.toggleDone, { taskId: w.taskId, groupSlug: HOUSE })
    await t
      .withIdentity(asBob)
      .mutation(api.groups.leaveGroup, { groupId: w.house })

    expect((await taskOf(t, w.taskId))?.assigneeId).toBeUndefined()
    const history = await t
      .withIdentity(asAlice)
      .query(api.tasks.completions, { taskId: w.taskId, groupSlug: HOUSE })
    expect(history.map((row) => row.byName)).toEqual(['Bob'])
  })
})
