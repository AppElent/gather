import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  alice as asAlice,
  bob as asBob,
  seedGroup,
  seedMember,
  testConvex,
} from '../test/convexHarness'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import {
  INVALID_PUSH_TOKEN,
  INVALID_SESSION_ID,
  MAX_DEVICES,
  SESSION_GRACE_MS,
} from './notifications'

/**
 * Push notifications (APP-298), asserted at Expo's door: every test counts
 * the messages `sendPush` posts, because that is the only thing a person
 * ever notices. Three promises matter most — one record never sends twice,
 * a muted Group or a switched-off kind sends nothing even when it was queued
 * before, and a deleted account leaves no phone or queued send behind.
 */

type Harness = ReturnType<typeof testConvex>

interface Sent {
  to: string
  title: string
  body: string
  data: { url: string }
}

/** Expo's push API, answering every message `ok` unless told otherwise. */
function stubExpo(gone: readonly string[] = [], goneByReceipt: string[] = []) {
  const sent: Sent[] = []
  const tokenOfTicket = new Map<string, string>()
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body))
    if (url.endsWith('/push/send')) {
      const data = (body as Sent[]).map((message, index) => {
        sent.push(message)
        if (gone.includes(message.to))
          return {
            status: 'error',
            message: 'gone',
            details: { error: 'DeviceNotRegistered' },
          }
        const id = `ticket-${sent.length}-${index}`
        tokenOfTicket.set(id, message.to)
        return { status: 'ok', id }
      })
      return Response.json({ data })
    }
    const data: Record<string, unknown> = {}
    for (const id of (body as { ids: string[] }).ids) {
      const token = tokenOfTicket.get(id)
      data[id] =
        token && goneByReceipt.includes(token)
          ? { status: 'error', details: { error: 'DeviceNotRegistered' } }
          : { status: 'ok' }
    }
    return Response.json({ data })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { sent, fetchMock }
}

const token = (name: string) => `ExponentPushToken[${name}]`

interface World {
  alice: Id<'users'>
  bob: Id<'users'>
  groupId: Id<'groups'>
  taskId: Id<'tasks'>
  eventId: Id<'calendarEvents'>
}

/** Alice and Bob in one household, with a task and an event in it. */
async function world(t: Harness): Promise<World> {
  await t.withIdentity(asAlice).mutation(api.users.ensureUser, {})
  await t.withIdentity(asBob).mutation(api.users.ensureUser, {})
  return await t.run(async (ctx) => {
    const [alice, bob] = await Promise.all(
      [asAlice, asBob].map(async (who) => {
        const row = await ctx.db
          .query('users')
          .withIndex('by_clerkId', (q) => q.eq('clerkId', who.subject))
          .unique()
        if (!row) throw new Error('no user')
        return row._id
      }),
    )
    if (!alice || !bob) throw new Error('no users')
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
      title: 'Take out the bins',
      done: false,
      createdBy: alice,
      order: 0,
    })
    const calendarId = await ctx.db.insert('calendars', {
      groupId,
      name: 'Family',
      source: 'local',
      createdBy: alice,
    })
    const eventId = await ctx.db.insert('calendarEvents', {
      calendarId,
      title: 'Dentist',
      date: '2026-12-01',
      createdBy: alice,
    })
    return { alice, bob, groupId, taskId, eventId }
  })
}

async function register(
  t: Harness,
  who: typeof asAlice,
  name: string,
  locale: 'en' | 'nl' = 'en',
  sessionId?: string,
) {
  await t.withIdentity(who).mutation(api.notifications.registerDevice, {
    token: token(name),
    platform: 'ios',
    locale,
    sessionId,
  })
}

function taskReminder(w: World) {
  return {
    kind: 'taskReminder' as const,
    groupId: w.groupId,
    target: { type: 'task' as const, id: w.taskId },
  }
}

async function devicesOf(t: Harness, userId: Id<'users'>) {
  return await t.run(async (ctx) =>
    ctx.db
      .query('pushDevices')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect(),
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function drain(t: Harness) {
  await t.finishAllScheduledFunctions(vi.runAllTimers)
}

describe('devices', () => {
  test('refuses a signed-out caller and a token Expo did not issue', async () => {
    const t = testConvex()
    await world(t)
    await expect(
      t.mutation(api.notifications.registerDevice, {
        token: token('x'),
        platform: 'ios',
        locale: 'en',
      }),
    ).rejects.toThrow()
    await expect(
      t.withIdentity(asAlice).mutation(api.notifications.registerDevice, {
        token: 'https://evil.example/hook',
        platform: 'ios',
        locale: 'en',
      }),
    ).rejects.toThrow(INVALID_PUSH_TOKEN)
    await expect(
      t.withIdentity(asAlice).mutation(api.notifications.registerDevice, {
        token: token('x'),
        platform: 'ios',
        locale: 'en',
        sessionId: 'not a session',
      }),
    ).rejects.toThrow(INVALID_SESSION_ID)
    await expect(
      t.mutation(api.notifications.forgetEndedSessions, {
        activeSessionIds: [],
      }),
    ).rejects.toThrow()
  })

  test('a token is one install: registering it elsewhere moves it', async () => {
    const t = testConvex()
    const w = await world(t)
    await register(t, asAlice, 'phone')
    await register(t, asAlice, 'phone')
    expect(await devicesOf(t, w.alice)).toHaveLength(1)

    await register(t, asBob, 'phone')
    expect(await devicesOf(t, w.alice)).toHaveLength(0)
    expect(await devicesOf(t, w.bob)).toHaveLength(1)
  })

  test('keeps at most MAX_DEVICES per person, dropping the oldest', async () => {
    const t = testConvex()
    const w = await world(t)
    for (let i = 0; i <= MAX_DEVICES; i++) {
      vi.setSystemTime(1_000 * (i + 1))
      await register(t, asAlice, `p${i}`)
    }
    const tokens = (await devicesOf(t, w.alice)).map((d) => d.token)
    expect(tokens).toHaveLength(MAX_DEVICES)
    expect(tokens).not.toContain(token('p0'))
  })

  test('sign-out releases the row with the token and its session, no sign-in needed', async () => {
    const t = testConvex()
    const w = await world(t)
    await register(t, asAlice, 'a', 'en', 'sess_alice')
    await register(t, asBob, 'b', 'en', 'sess_bob')

    // Signed out by now: no identity. The wrong session releases nothing.
    await t.mutation(api.notifications.releaseDevice, {
      token: token('a'),
      sessionId: 'sess_bob',
    })
    expect(await devicesOf(t, w.alice)).toHaveLength(1)

    await t.mutation(api.notifications.releaseDevice, {
      token: token('a'),
      sessionId: 'sess_alice',
    })
    expect(await devicesOf(t, w.alice)).toHaveLength(0)
    expect(await devicesOf(t, w.bob)).toHaveLength(1)
  })

  test('a late release from the previous account leaves the next one’s row', async () => {
    const t = testConvex()
    const w = await world(t)
    await register(t, asAlice, 'phone', 'en', 'sess_alice')
    // Alice signed out offline; Bob signs in on the phone before her release lands.
    await register(t, asBob, 'phone', 'en', 'sess_bob')
    await t.mutation(api.notifications.releaseDevice, {
      token: token('phone'),
      sessionId: 'sess_alice',
    })
    expect(await devicesOf(t, w.bob)).toHaveLength(1)
  })

  test('a phone whose session ended elsewhere is forgotten; the caller’s own are kept', async () => {
    const t = testConvex()
    const w = await world(t)
    await register(t, asAlice, 'lost', 'en', 'sess_lost')
    await register(t, asAlice, 'mine', 'en', 'sess_mine')
    await register(t, asBob, 'bob', 'en', 'sess_bob')
    // Registered a while ago; the lost phone's session was revoked since.
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query('pushDevices').collect())
        await ctx.db.patch(row._id, {
          updatedAt: row.updatedAt - SESSION_GRACE_MS - 1,
        })
    })
    await register(t, asAlice, 'fresh', 'en', 'sess_fresh')
    await t
      .withIdentity(asAlice)
      .mutation(api.notifications.forgetEndedSessions, {
        activeSessionIds: ['sess_mine'],
      })
    const left = (await devicesOf(t, w.alice)).map((d) => d.token).sort()
    // `fresh` is newer than the list could know about, so it stays.
    expect(left).toEqual([token('fresh'), token('mine')])
    expect(await devicesOf(t, w.bob)).toHaveLength(1)

    // Revoked just now from Settings → Account → Devices: gone at once.
    await t
      .withIdentity(asAlice)
      .mutation(api.notifications.forgetEndedSessions, {
        activeSessionIds: ['sess_mine'],
        endedSessionIds: ['sess_fresh', 'sess_bob'],
      })
    expect((await devicesOf(t, w.alice)).map((d) => d.token)).toEqual([
      token('mine'),
    ])
    // Bob's session is not Alice's to end.
    expect(await devicesOf(t, w.bob)).toHaveLength(1)
  })
})

describe('notify', () => {
  test('sends each phone the record’s title in its own language, with a link into its Group', async () => {
    const t = testConvex()
    const w = await world(t)
    const { sent } = stubExpo()
    await register(t, asAlice, 'en-phone', 'en')
    await register(t, asAlice, 'nl-phone', 'nl')

    await t.mutation(internal.notifications.notify, {
      userIds: [w.alice, w.alice],
      payload: taskReminder(w),
    })
    await drain(t)

    expect(sent).toHaveLength(2)
    const byToken = new Map(sent.map((m) => [m.to, m]))
    expect(byToken.get(token('en-phone'))).toMatchObject({
      title: 'Take out the bins',
      body: 'Task reminder · Household',
      data: { url: `/g/house/tasks/task/${w.taskId}` },
    })
    expect(byToken.get(token('nl-phone'))?.body).toBe(
      'Herinnering voor een taak · Household',
    )
  })

  test('an event opens the event', async () => {
    const t = testConvex()
    const w = await world(t)
    const { sent } = stubExpo()
    await register(t, asBob, 'b')
    await t.mutation(internal.notifications.notify, {
      userIds: [w.bob],
      payload: {
        kind: 'eventAssignment',
        groupId: w.groupId,
        target: { type: 'event', id: w.eventId },
      },
    })
    await drain(t)
    expect(sent.map((m) => m.data.url)).toEqual([
      `/g/house/calendar/${w.eventId}`,
    ])
  })

  test('sends nothing to somebody outside the record’s Group, or for a record in another Group', async () => {
    const t = testConvex()
    const w = await world(t)
    const { sent } = stubExpo()
    await register(t, asBob, 'b')
    const otherGroup = await t.run(async (ctx) => {
      await ctx.db.delete(
        (await ctx.db
          .query('memberships')
          .withIndex('by_user', (q) => q.eq('userId', w.bob))
          .unique())!._id,
      )
      return await seedGroup(ctx, { name: 'Club', slug: 'club' })
    })
    await t.mutation(internal.notifications.notify, {
      userIds: [w.bob],
      payload: taskReminder(w),
    })
    await t.run(async (ctx) => seedMember(ctx, otherGroup, w.bob))
    await t.mutation(internal.notifications.notify, {
      userIds: [w.bob],
      payload: { ...taskReminder(w), groupId: otherGroup },
    })
    await drain(t)
    expect(sent).toHaveLength(0)
  })

  test('a deleted record sends nothing', async () => {
    const t = testConvex()
    const w = await world(t)
    const { sent } = stubExpo()
    await register(t, asAlice, 'a')
    await t.run(async (ctx) => ctx.db.delete(w.taskId))
    await t.mutation(internal.notifications.notify, {
      userIds: [w.alice],
      payload: taskReminder(w),
    })
    await drain(t)
    expect(sent).toHaveLength(0)
  })
})

describe('schedule and dedupe', () => {
  test('rescheduling a key replaces the earlier send', async () => {
    const t = testConvex()
    const w = await world(t)
    const { sent } = stubExpo()
    await register(t, asAlice, 'a')
    const key = `task:${w.taskId}:reminder`

    await t.mutation(internal.notifications.schedule, {
      userId: w.alice,
      at: Date.now() + 60_000,
      payload: taskReminder(w),
      dedupeKey: key,
    })
    await t.mutation(internal.notifications.schedule, {
      userId: w.alice,
      at: Date.now() + 120_000,
      payload: taskReminder(w),
      dedupeKey: key,
    })
    await drain(t)

    expect(sent).toHaveLength(1)
    const rows = await t.run(async (ctx) =>
      ctx.db.query('scheduledNotifications').collect(),
    )
    expect(rows).toHaveLength(0)
  })

  test('the same key for two people is two sends', async () => {
    const t = testConvex()
    const w = await world(t)
    const { sent } = stubExpo()
    await register(t, asAlice, 'a')
    await register(t, asBob, 'b')
    for (const userId of [w.alice, w.bob])
      await t.mutation(internal.notifications.schedule, {
        userId,
        at: Date.now() + 60_000,
        payload: taskReminder(w),
        dedupeKey: 'k',
      })
    await drain(t)
    expect(sent.map((m) => m.to).sort()).toEqual([token('a'), token('b')])
  })

  test('a cancelled key sends nothing', async () => {
    const t = testConvex()
    const w = await world(t)
    const { sent } = stubExpo()
    await register(t, asAlice, 'a')
    await t.mutation(internal.notifications.schedule, {
      userId: w.alice,
      at: Date.now() + 60_000,
      payload: taskReminder(w),
      dedupeKey: 'k',
    })
    await t.mutation(internal.notifications.cancel, {
      userId: w.alice,
      dedupeKey: 'k',
    })
    await drain(t)
    expect(sent).toHaveLength(0)
  })

  test('a job that was already replaced sends nothing when it runs', async () => {
    const t = testConvex()
    const w = await world(t)
    const { sent } = stubExpo()
    await register(t, asAlice, 'a')
    await t.mutation(internal.notifications.schedule, {
      userId: w.alice,
      at: Date.now() + 60_000,
      payload: taskReminder(w),
      dedupeKey: 'k',
    })
    const row = await t.run(async (ctx) =>
      ctx.db.query('scheduledNotifications').unique(),
    )
    if (!row) throw new Error('no row')
    await t.mutation(internal.notifications.schedule, {
      userId: w.alice,
      at: Date.now() + 120_000,
      payload: { ...taskReminder(w), kind: 'taskAssignment' },
      dedupeKey: 'k',
    })

    // The first job, as if it had started before it could be cancelled.
    await t.mutation(internal.notifications.fireScheduled, {
      rowId: row._id,
      generation: row.generation,
    })
    const after = await t.run(async (ctx) => ctx.db.get(row._id))
    expect(after?.generation).toBe(row.generation + 1)

    await drain(t)
    expect(sent.map((m) => m.body)).toEqual(['Someone gave you a task: Take out the bins'])
  })

  test('two rows for one key, as a merge of accounts leaves them, send once', async () => {
    const t = testConvex()
    const w = await world(t)
    const { sent } = stubExpo()
    await register(t, asAlice, 'a')
    await t.mutation(internal.notifications.schedule, {
      userId: w.alice,
      at: Date.now() + 60_000,
      payload: taskReminder(w),
      dedupeKey: 'k',
    })
    await t.mutation(internal.notifications.schedule, {
      userId: w.bob,
      at: Date.now() + 60_000,
      payload: taskReminder(w),
      dedupeKey: 'k',
    })
    // What `maintenance.mergeUserInto` does to Bob's row.
    await t.run(async (ctx) => {
      const rows = await ctx.db.query('scheduledNotifications').collect()
      for (const row of rows) await ctx.db.patch(row._id, { userId: w.alice })
    })
    await drain(t)
    expect(sent).toHaveLength(1)
  })

  test('refuses an empty or oversized key', async () => {
    const t = testConvex()
    const w = await world(t)
    for (const dedupeKey of ['', 'x'.repeat(201)])
      await expect(
        t.mutation(internal.notifications.schedule, {
          userId: w.alice,
          at: Date.now(),
          payload: taskReminder(w),
          dedupeKey,
        }),
      ).rejects.toThrow()
  })
})

describe('switches and mutes', () => {
  test('default to on, and are the caller’s own', async () => {
    const t = testConvex()
    await world(t)
    expect(await t.query(api.notifications.settings, {})).toBeNull()
    await expect(
      t.mutation(api.notifications.setSwitch, {
        name: 'taskReminders',
        enabled: false,
      }),
    ).rejects.toThrow()

    await t.withIdentity(asAlice).mutation(api.notifications.setSwitch, {
      name: 'taskReminders',
      enabled: false,
    })
    expect(
      await t.withIdentity(asAlice).query(api.notifications.settings, {}),
    ).toEqual({
      switches: {
        taskReminders: false,
        taskAssignments: true,
        eventReminders: true,
        eventAssignments: true,
      },
      mutedGroupIds: [],
    })
    expect(
      (await t.withIdentity(asBob).query(api.notifications.settings, {}))
        ?.switches.taskReminders,
    ).toBe(true)
  })

  test('a kind switched off after it was queued sends nothing; other kinds still send', async () => {
    const t = testConvex()
    const w = await world(t)
    const { sent } = stubExpo()
    await register(t, asAlice, 'a')
    await t.mutation(internal.notifications.schedule, {
      userId: w.alice,
      at: Date.now() + 60_000,
      payload: taskReminder(w),
      dedupeKey: 'reminder',
    })
    await t.mutation(internal.notifications.schedule, {
      userId: w.alice,
      at: Date.now() + 60_000,
      payload: { ...taskReminder(w), kind: 'taskAssignment' },
      dedupeKey: 'assignment',
    })
    await t.withIdentity(asAlice).mutation(api.notifications.setSwitch, {
      name: 'taskReminders',
      enabled: false,
    })
    await drain(t)
    expect(sent.map((m) => m.body)).toEqual(['Someone gave you a task: Take out the bins'])
  })

  test('a Group muted after a send was queued sends nothing, for that person only', async () => {
    const t = testConvex()
    const w = await world(t)
    const { sent } = stubExpo()
    await register(t, asAlice, 'a')
    await register(t, asBob, 'b')
    for (const userId of [w.alice, w.bob])
      await t.mutation(internal.notifications.schedule, {
        userId,
        at: Date.now() + 60_000,
        payload: taskReminder(w),
        dedupeKey: 'k',
      })
    await t
      .withIdentity(asAlice)
      .mutation(api.notifications.setGroupMuted, {
        groupSlug: 'house',
        muted: true,
      })
    await drain(t)
    expect(sent.map((m) => m.to)).toEqual([token('b')])
    expect(
      (await t.withIdentity(asAlice).query(api.notifications.settings, {}))
        ?.mutedGroupIds,
    ).toEqual([w.groupId])
  })

  test('muting refuses a Group the caller is not in', async () => {
    const t = testConvex()
    await world(t)
    await t.run(async (ctx) => seedGroup(ctx, { name: 'Club', slug: 'club' }))
    await expect(
      t.withIdentity(asAlice).mutation(api.notifications.setGroupMuted, {
        groupSlug: 'club',
        muted: true,
      }),
    ).rejects.toThrow()
  })
})

describe('invalid tokens', () => {
  test('a ticket saying the install is gone forgets its token', async () => {
    const t = testConvex()
    const w = await world(t)
    stubExpo([token('gone')])
    await register(t, asAlice, 'gone')
    await register(t, asAlice, 'kept')
    await t.mutation(internal.notifications.notify, {
      userIds: [w.alice],
      payload: taskReminder(w),
    })
    await drain(t)
    expect((await devicesOf(t, w.alice)).map((d) => d.token)).toEqual([
      token('kept'),
    ])
  })

  test('so does a receipt read later', async () => {
    const t = testConvex()
    const w = await world(t)
    stubExpo([], [token('late')])
    await register(t, asAlice, 'late')
    await t.mutation(internal.notifications.notify, {
      userIds: [w.alice],
      payload: taskReminder(w),
    })
    await drain(t)
    expect(await devicesOf(t, w.alice)).toHaveLength(0)
  })

  test('Expo being down loses the send but breaks nothing', async () => {
    const t = testConvex()
    const w = await world(t)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('down', { status: 503 })),
    )
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await register(t, asAlice, 'a')
    await t.mutation(internal.notifications.notify, {
      userIds: [w.alice],
      payload: taskReminder(w),
    })
    await drain(t)
    expect(await devicesOf(t, w.alice)).toHaveLength(1)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})

describe('account deletion', () => {
  test('takes the person’s phones and queued sends with it, and sends nothing after', async () => {
    const t = testConvex()
    const w = await world(t)
    const { sent } = stubExpo()
    await register(t, asAlice, 'a')
    await register(t, asBob, 'b')
    for (const userId of [w.alice, w.bob])
      await t.mutation(internal.notifications.schedule, {
        userId,
        at: Date.now() + 60_000,
        payload: taskReminder(w),
        dedupeKey: 'k',
      })

    await t.withIdentity(asAlice).mutation(api.accounts.deleteAccount, {})
    await drain(t)

    const left = await t.run(async (ctx) => ({
      devices: await ctx.db.query('pushDevices').collect(),
      queued: await ctx.db.query('scheduledNotifications').collect(),
    }))
    expect(left.devices.map((d) => d.userId)).toEqual([w.bob])
    expect(left.queued).toHaveLength(0)
    // Bob's send went out; Alice's was withdrawn with her account.
    expect(sent.map((m) => m.to)).toEqual([token('b')])
  })
})
