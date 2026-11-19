import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  alice as asAlice,
  bob as asBob,
  carol as asCarol,
  seedGroup,
  seedMember,
  testConvex,
} from '../test/convexHarness'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { SEND_RETRY_DELAYS_MS } from './notifications'

/**
 * Task reminders (APP-305), asserted at Expo's door like the push tests: what
 * counts is what `sendPush` posts and when. The clock is fixed at Thursday 19
 * November 2026, 10:00 UTC, and the reminders below are in UTC unless a test
 * says otherwise, so a reminder's moment reads straight off its wall clock.
 */

type Harness = ReturnType<typeof testConvex>

const NOW = Date.parse('2026-11-19T10:00:00Z')
const UTC = 'UTC'

interface Sent {
  to: string
  title: string
  body: string
  data: { url: string }
  categoryId?: string
}

/** Expo's push API, answering `ok`; `failFirst` posts answer with that status. */
function stubExpo(failFirst: { times: number; status: number } | null = null) {
  const sent: Sent[] = []
  const posts: number[] = []
  let failures = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body))
      if (url.endsWith('/push/send')) {
        posts.push(Date.now())
        if (failFirst && failures < failFirst.times) {
          failures++
          return new Response('no', { status: failFirst.status })
        }
        const data = (body as Sent[]).map((message, index) => {
          sent.push(message)
          return { status: 'ok', id: `t-${sent.length}-${index}` }
        })
        return Response.json({ data })
      }
      return Response.json({ data: {} })
    }),
  )
  return { sent, posts }
}

const token = (name: string) => `ExponentPushToken[${name}]`

interface World {
  alice: Id<'users'>
  bob: Id<'users'>
  groupId: Id<'groups'>
  listId: Id<'taskLists'>
  taskId: Id<'tasks'>
}

/** Alice and Bob in one household, each with a phone, and a task due Saturday. */
async function world(t: Harness): Promise<World> {
  for (const who of [asAlice, asBob]) {
    await t.withIdentity(who).mutation(api.users.ensureUser, {})
  }
  const w = await t.run(async (ctx) => {
    const ids = await Promise.all(
      [asAlice, asBob].map(async (who) => {
        const row = await ctx.db
          .query('users')
          .withIndex('by_clerkId', (q) => q.eq('clerkId', who.subject))
          .unique()
        if (!row) throw new Error('no user')
        return row._id
      }),
    )
    const [alice, bob] = ids as [Id<'users'>, Id<'users'>]
    const groupId = await seedGroup(ctx, { name: 'Household', slug: 'house' })
    await seedMember(ctx, groupId, alice, 'admin')
    await seedMember(ctx, groupId, bob)
    const listId = await ctx.db.insert('taskLists', {
      groupId,
      name: 'Chores',
      provider: 'local',
      order: 0,
    })
    const taskId = await ctx.db.insert('tasks', {
      listId,
      title: 'Clean the bathroom',
      done: false,
      dueDate: '2026-11-21',
      createdBy: alice,
      order: 0,
    })
    return { alice, bob, groupId, listId, taskId }
  })
  for (const [who, name] of [
    [asAlice, 'a'],
    [asBob, 'b'],
  ] as const) {
    await t.withIdentity(who).mutation(api.notifications.registerDevice, {
      token: token(name),
      platform: 'ios',
      locale: 'en',
    })
  }
  return w
}

function setReminder(
  t: Harness,
  w: World,
  reminder: { date: string; time: string; timeZone?: string } | null,
  who = asAlice,
) {
  return t.withIdentity(who).mutation(api.tasks.setReminder, {
    taskId: w.taskId,
    groupSlug: 'house',
    reminder: reminder && { timeZone: UTC, ...reminder },
  })
}

async function queued(t: Harness) {
  return await t.run(async (ctx) =>
    ctx.db.query('scheduledNotifications').collect(),
  )
}

async function taskOf(t: Harness, w: World) {
  return await t.run(async (ctx) => ctx.db.get(w.taskId))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function drain(t: Harness) {
  await t.finishAllScheduledFunctions(vi.runAllTimers)
}

describe('setting a reminder', () => {
  test('goes to the person who set it, at the moment chosen, with the Done category', async () => {
    const t = testConvex()
    const w = await world(t)
    const { sent, posts } = stubExpo()

    await setReminder(t, w, { date: '2026-11-21', time: '09:00' })

    const task = await taskOf(t, w)
    expect(task?.reminder).toEqual({
      date: '2026-11-21',
      time: '09:00',
      timeZone: UTC,
      userId: w.alice,
    })
    const [row] = await queued(t)
    expect(row?.userId).toBe(w.alice)
    expect(row?.at).toBe(Date.parse('2026-11-21T09:00:00Z'))
    expect(row?.dedupeKey).toBe(`task:${w.taskId}:reminder`)

    await drain(t)
    expect(sent).toEqual([
      {
        to: token('a'),
        title: 'Clean the bathroom',
        body: 'Task reminder · Household',
        data: { url: `/g/house/tasks/task/${w.taskId}` },
        sound: 'default',
        categoryId: 'taskReminder',
      },
    ])
    expect(posts).toEqual([Date.parse('2026-11-21T09:00:00Z')])
  })

  test('reads the wall clock in the setter’s own time zone', async () => {
    const t = testConvex()
    const w = await world(t)
    stubExpo()
    await setReminder(t, w, {
      date: '2026-11-21',
      time: '09:00',
      timeZone: 'Europe/Amsterdam',
    })
    expect((await queued(t))[0]?.at).toBe(Date.parse('2026-11-21T08:00:00Z'))
  })

  test('a reminder one minute ahead arrives a minute later', async () => {
    const t = testConvex()
    const w = await world(t)
    const { sent, posts } = stubExpo()
    await setReminder(t, w, { date: '2026-11-19', time: '10:01' })
    await drain(t)
    expect(sent).toHaveLength(1)
    expect(posts).toEqual([NOW + 60_000])
  })

  test('the minute being looked at sends now; earlier is refused', async () => {
    const t = testConvex()
    const w = await world(t)
    const { sent } = stubExpo()
    vi.setSystemTime(NOW + 40_000)
    await setReminder(t, w, { date: '2026-11-19', time: '10:00' })
    await drain(t)
    expect(sent).toHaveLength(1)

    await expect(
      setReminder(t, w, { date: '2026-11-19', time: '09:58' }),
    ).rejects.toThrow('That time has passed')
  })

  test('refuses a clock that is not one, and a caller outside the Group', async () => {
    const t = testConvex()
    const w = await world(t)
    stubExpo()
    for (const bad of [
      { date: '2026-02-30', time: '09:00' },
      { date: '2026-11-21', time: '25:00' },
      { date: '2026-11-21', time: '09:00', timeZone: 'Mars/Olympus' },
    ])
      await expect(setReminder(t, w, bad)).rejects.toThrow(
        'That is not a reminder time',
      )
    await t.withIdentity(asCarol).mutation(api.users.ensureUser, {})
    await expect(
      setReminder(t, w, { date: '2026-11-21', time: '09:00' }, asCarol),
    ).rejects.toThrow()
    expect(await queued(t)).toHaveLength(0)
  })

  test('setting it again replaces it; clearing it withdraws it', async () => {
    const t = testConvex()
    const w = await world(t)
    const { sent } = stubExpo()
    await setReminder(t, w, { date: '2026-11-21', time: '09:00' })
    await setReminder(t, w, { date: '2026-11-20', time: '19:00' })
    expect((await queued(t)).map((row) => row.at)).toEqual([
      Date.parse('2026-11-20T19:00:00Z'),
    ])

    await setReminder(t, w, null)
    expect((await taskOf(t, w))?.reminder).toBeUndefined()
    expect(await queued(t)).toHaveLength(0)
    await drain(t)
    expect(sent).toHaveLength(0)
  })

  test('set by somebody else, it becomes theirs and stops going to the first', async () => {
    const t = testConvex()
    const w = await world(t)
    const { sent } = stubExpo()
    await setReminder(t, w, { date: '2026-11-21', time: '09:00' })
    await setReminder(t, w, { date: '2026-11-21', time: '08:00' }, asBob)
    await drain(t)
    expect(sent.map((m) => m.to)).toEqual([token('b')])
  })
})

describe('changing the task', () => {
  test('moving the due date moves the reminder by the same days', async () => {
    const t = testConvex()
    const w = await world(t)
    const { posts } = stubExpo()
    // The evening before Saturday's due date.
    await setReminder(t, w, { date: '2026-11-20', time: '19:00' })
    await t.withIdentity(asBob).mutation(api.tasks.update, {
      taskId: w.taskId,
      groupSlug: 'house',
      dueDate: '2026-11-28',
    })
    expect((await taskOf(t, w))?.reminder?.date).toBe('2026-11-27')
    expect((await queued(t)).map((row) => row.at)).toEqual([
      Date.parse('2026-11-27T19:00:00Z'),
    ])
    await drain(t)
    expect(posts).toHaveLength(1)
  })

  test('clearing the due date keeps the reminder where it was', async () => {
    const t = testConvex()
    const w = await world(t)
    stubExpo()
    await setReminder(t, w, { date: '2026-11-20', time: '19:00' })
    await t.withIdentity(asAlice).mutation(api.tasks.update, {
      taskId: w.taskId,
      groupSlug: 'house',
      dueDate: null,
    })
    expect((await taskOf(t, w))?.reminder?.date).toBe('2026-11-20')
    expect(await queued(t)).toHaveLength(1)
  })

  test('a due date moved into the past sends nothing stale', async () => {
    const t = testConvex()
    const w = await world(t)
    const { sent } = stubExpo()
    await setReminder(t, w, { date: '2026-11-21', time: '09:00' })
    await t.withIdentity(asAlice).mutation(api.tasks.update, {
      taskId: w.taskId,
      groupSlug: 'house',
      dueDate: '2026-11-15',
    })
    expect(await queued(t)).toHaveLength(0)
    await drain(t)
    expect(sent).toHaveLength(0)
  })

  test('completing withdraws it, from every place a task is completed', async () => {
    const t = testConvex()
    const w = await world(t)
    const { sent } = stubExpo()
    const complete = [
      () =>
        t.withIdentity(asAlice).mutation(api.tasks.toggleDone, {
          taskId: w.taskId,
          groupSlug: 'house',
        }),
      () =>
        t.withIdentity(asAlice).mutation(api.tasks.update, {
          taskId: w.taskId,
          groupSlug: 'house',
          done: true,
        }),
      () =>
        t.withIdentity(asAlice).mutation(api.tasks.setDoneInList, {
          listId: w.listId,
          groupSlug: 'house',
          done: true,
        }),
    ]
    for (const done of complete) {
      await t.run(async (ctx) => ctx.db.patch(w.taskId, { done: false }))
      await setReminder(t, w, { date: '2026-11-21', time: '09:00' })
      expect(await queued(t)).toHaveLength(1)
      await done()
      expect(await queued(t)).toHaveLength(0)
    }
    await drain(t)
    expect(sent).toHaveLength(0)
  })

  test('reopening a task before its moment queues the reminder again', async () => {
    const t = testConvex()
    const w = await world(t)
    const { sent } = stubExpo()
    await setReminder(t, w, { date: '2026-11-21', time: '09:00' })
    for (let i = 0; i < 2; i++)
      await t.withIdentity(asAlice).mutation(api.tasks.toggleDone, {
        taskId: w.taskId,
        groupSlug: 'house',
      })
    await drain(t)
    expect(sent).toHaveLength(1)
  })

  test('a task done by the time it sends sends nothing', async () => {
    const t = testConvex()
    const w = await world(t)
    const { sent } = stubExpo()
    await setReminder(t, w, { date: '2026-11-21', time: '09:00' })
    // Done behind the reminder's back, as an older path might.
    await t.run(async (ctx) => ctx.db.patch(w.taskId, { done: true }))
    await drain(t)
    expect(sent).toHaveLength(0)
  })
})

describe('deleting', () => {
  test('deleting the task withdraws its reminder', async () => {
    const t = testConvex()
    const w = await world(t)
    const { sent } = stubExpo()
    await setReminder(t, w, { date: '2026-11-21', time: '09:00' })
    await t.withIdentity(asAlice).mutation(api.tasks.remove, {
      taskId: w.taskId,
      groupSlug: 'house',
    })
    expect(await queued(t)).toHaveLength(0)
    await drain(t)
    expect(sent).toHaveLength(0)
  })

  test('so does deleting its list', async () => {
    const t = testConvex()
    const w = await world(t)
    stubExpo()
    await setReminder(t, w, { date: '2026-11-21', time: '09:00' })
    await t.withIdentity(asAlice).mutation(api.taskLists.remove, {
      listId: w.listId,
      groupSlug: 'house',
    })
    expect(await queued(t)).toHaveLength(0)
  })

  test('deleting the Group withdraws everything queued about it', async () => {
    const t = testConvex()
    const w = await world(t)
    stubExpo()
    await setReminder(t, w, { date: '2026-11-21', time: '09:00' })
    // A send the task cascade does not reach: an event's, say.
    await t.mutation(internal.notifications.schedule, {
      userId: w.alice,
      at: NOW + 3_600_000,
      payload: {
        kind: 'taskReminder',
        groupId: w.groupId,
        target: { type: 'task', id: w.taskId },
      },
      dedupeKey: 'other',
    })
    await t.withIdentity(asBob).mutation(api.groups.leaveGroup, {
      groupId: w.groupId,
    })
    await t.withIdentity(asAlice).mutation(api.groups.deleteGroup, {
      groupId: w.groupId,
    })
    expect(await queued(t)).toHaveLength(0)
    const pending = await t.run(async (ctx) =>
      (await ctx.db.system.query('_scheduled_functions').collect()).filter(
        (job) => job.state.kind === 'pending',
      ),
    )
    expect(pending.map((job) => job.name)).not.toContain(
      'notifications:fireScheduled',
    )
  })

  test('a Member who leaves takes their reminders with them', async () => {
    const t = testConvex()
    const w = await world(t)
    const { sent } = stubExpo()
    await setReminder(t, w, { date: '2026-11-21', time: '09:00' }, asBob)
    await t.withIdentity(asBob).mutation(api.groups.leaveGroup, {
      groupId: w.groupId,
    })
    expect((await taskOf(t, w))?.reminder).toBeUndefined()
    expect(await queued(t)).toHaveLength(0)
    await drain(t)
    expect(sent).toHaveLength(0)
  })
})

describe('settings', () => {
  test('the Task reminders switch and the Group mute, checked when it sends', async () => {
    const t = testConvex()
    const w = await world(t)
    const { sent } = stubExpo()
    await setReminder(t, w, { date: '2026-11-21', time: '09:00' })
    await setReminder(t, w, { date: '2026-11-21', time: '09:00' }, asBob)
    // Bob's replaced Alice's; give Alice one on a second task.
    const second = await t.run(async (ctx) =>
      ctx.db.insert('tasks', {
        listId: w.listId,
        title: 'Water the plants',
        done: false,
        createdBy: w.alice,
        order: 1,
      }),
    )
    await t.withIdentity(asAlice).mutation(api.tasks.setReminder, {
      taskId: second,
      groupSlug: 'house',
      reminder: { date: '2026-11-21', time: '09:00', timeZone: UTC },
    })
    await t.withIdentity(asAlice).mutation(api.notifications.setSwitch, {
      name: 'taskReminders',
      enabled: false,
    })
    await t.withIdentity(asBob).mutation(api.notifications.setGroupMuted, {
      groupSlug: 'house',
      muted: true,
    })
    await drain(t)
    expect(sent).toHaveLength(0)
  })
})

describe('delivery retries', () => {
  test('a post Expo did not take is tried again, a bounded number of times', async () => {
    const t = testConvex()
    const w = await world(t)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { sent, posts } = stubExpo({ times: 2, status: 503 })
    await setReminder(t, w, { date: '2026-11-19', time: '10:01' })
    await drain(t)
    expect(sent).toHaveLength(1)
    const first = NOW + 60_000
    expect(posts).toEqual([
      first,
      first + SEND_RETRY_DELAYS_MS[0],
      first + SEND_RETRY_DELAYS_MS[0] + SEND_RETRY_DELAYS_MS[1],
    ])
    error.mockRestore()
  })

  test('gives up after the last try, and never retries a refusal', async () => {
    const t = testConvex()
    const w = await world(t)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const down = stubExpo({ times: 99, status: 500 })
    await setReminder(t, w, { date: '2026-11-19', time: '10:01' })
    await drain(t)
    expect(down.posts).toHaveLength(1 + SEND_RETRY_DELAYS_MS.length)
    expect(down.sent).toHaveLength(0)

    vi.unstubAllGlobals()
    const refused = stubExpo({ times: 99, status: 400 })
    await setReminder(t, w, { date: '2026-11-19', time: '10:30' })
    await drain(t)
    expect(refused.posts).toHaveLength(1)
    error.mockRestore()
  })
})
