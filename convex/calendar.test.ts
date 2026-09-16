import { describe, expect, test } from 'vitest'

import { api } from './_generated/api'
import { testConvex } from '../test/convexHarness'

const alice = { subject: 'calendar_alice', name: 'Alice', email: 'alice@example.com' }
const bob = { subject: 'calendar_bob', name: 'Bob', email: 'bob@example.com' }

async function seed() {
  const t = testConvex()
  const ids = await t.run(async (ctx) => {
    const aliceId = await ctx.db.insert('users', { clerkId: alice.subject, name: alice.name, email: alice.email })
    const bobId = await ctx.db.insert('users', { clerkId: bob.subject, name: bob.name, email: bob.email })
    const group = await ctx.db.insert('groups', { name: 'Home', slug: 'calendar-home', inviteCode: 'calendar-home' })
    const other = await ctx.db.insert('groups', { name: 'Other', slug: 'calendar-other', inviteCode: 'calendar-other' })
    await ctx.db.insert('memberships', { groupId: group, userId: aliceId, role: 'admin' })
    await ctx.db.insert('memberships', { groupId: group, userId: bobId, role: 'member' })
    await ctx.db.insert('memberships', { groupId: other, userId: aliceId, role: 'member' })
    const calendar = await ctx.db.insert('calendars', { groupId: group, name: 'Home', source: 'local', createdBy: aliceId })
    const otherCalendar = await ctx.db.insert('calendars', { groupId: other, name: 'Other', source: 'local', createdBy: aliceId })
    return { aliceId, bobId, group, other, calendar, otherCalendar }
  })
  return { t, ...ids }
}

describe('calendar backend', () => {
  test('keeps legacy event creation readable with normalized fields', async () => {
    const { t, calendar } = await seed()
    const id = await t.withIdentity(alice).mutation(api.kitchen.addCalendarEvent, {
      groupSlug: 'calendar-home', calendarId: calendar, title: 'Legacy', date: '2026-09-12',
    })
    const event = await t.withIdentity(alice).query(api.kitchen.getCalendarEvent, { groupSlug: 'calendar-home', id })
    expect(event).toMatchObject({ title: 'Legacy', allDay: true, assigneeIds: [], location: '', notes: '', revision: 0, color: 'home' })
  })

  test('creates and atomically updates all event fields, clearing optional values', async () => {
    const { t, calendar, bobId } = await seed()
    const id = await t.withIdentity(alice).mutation(api.kitchen.addCalendarEvent, {
      groupSlug: 'calendar-home', calendarId: calendar, title: 'Appointment', date: '2026-09-12', allDay: false,
      startMinutes: 60, endMinutes: 120, assigneeIds: [bobId], location: 'Town hall', notes: 'Bring papers',
    })
    const result = await t.withIdentity(alice).mutation(api.calendar.updateEvent, {
      groupSlug: 'calendar-home', id, expectedRevision: 0, title: 'Moved', calendarId: calendar, date: '2026-09-13', allDay: true,
      startMinutes: null, endMinutes: null, assigneeIds: [], location: null, notes: null,
    })
    expect(result.revision).toBe(1)
    const event = await t.withIdentity(alice).query(api.kitchen.getCalendarEvent, { groupSlug: 'calendar-home', id })
    expect(event).toMatchObject({ title: 'Moved', date: '2026-09-13', allDay: true, location: '', notes: '', assigneeIds: [], revision: 1 })
    expect(event?.startMinutes).toBeUndefined()
  })

  test('rejects foreign groups, non-members and revision conflicts', async () => {
    const { t, calendar, otherCalendar } = await seed()
    const id = await t.withIdentity(alice).mutation(api.kitchen.addCalendarEvent, { groupSlug: 'calendar-home', calendarId: calendar, title: 'Private', date: '2026-09-12' })
    await expect(t.withIdentity(alice).query(api.kitchen.getCalendarEvent, { groupSlug: 'calendar-other', id })).rejects.toThrow()
    await expect(t.withIdentity(bob).mutation(api.kitchen.addCalendarEvent, { groupSlug: 'calendar-other', calendarId: otherCalendar, title: 'Nope', date: '2026-09-12' })).rejects.toThrow('Not a member')
    await expect(t.withIdentity(alice).mutation(api.calendar.updateEvent, { groupSlug: 'calendar-home', id, expectedRevision: 4, title: 'Nope', calendarId: calendar, date: '2026-09-12', allDay: true, startMinutes: null, endMinutes: null, assigneeIds: [], location: null, notes: null })).rejects.toThrow('calendar:conflict')
  })

  test('keeps calendar preferences private per membership', async () => {
    const { t, calendar } = await seed()
    await t.withIdentity(alice).mutation(api.calendar.setPreferences, { groupSlug: 'calendar-home', view: 'month', peopleFilter: { userIds: [], includeUnassigned: true } })
    expect(await t.withIdentity(alice).query(api.calendar.preferences, { groupSlug: 'calendar-home' })).toMatchObject({ view: 'month', peopleFilter: { includeUnassigned: true } })
    expect(await t.withIdentity(bob).query(api.calendar.preferences, { groupSlug: 'calendar-home' })).toMatchObject({ view: 'week', peopleFilter: null })
    await t.withIdentity(bob).mutation(api.kitchen.setCalendarVisibility, { groupSlug: 'calendar-home', calendarId: calendar, visible: false })
    expect((await t.withIdentity(alice).query(api.calendar.preferences, { groupSlug: 'calendar-home' })).hiddenCalendarIds).toEqual([])
  })

  test('paginates events through the calendar date index', async () => {
    const { t, calendar } = await seed()
    await t.run(async (ctx) => {
      const user = (await ctx.db.query('users').withIndex('by_clerkId', (q) => q.eq('clerkId', alice.subject)).first())!
      for (let index = 0; index < 105; index++) await ctx.db.insert('calendarEvents', { calendarId: calendar, title: `Event ${index}`, date: '2026-09-12', createdBy: user._id })
    })
    const first = await t.withIdentity(alice).query(api.calendar.listEvents, { groupSlug: 'calendar-home', calendarId: calendar, from: '2026-09-01', toExclusive: '2026-10-01', paginationOpts: { numItems: 100, cursor: null } })
    expect(first.page).toHaveLength(100)
    expect(first.isDone).toBe(false)
    const second = await t.withIdentity(alice).query(api.calendar.listEvents, { groupSlug: 'calendar-home', calendarId: calendar, from: '2026-09-01', toExclusive: '2026-10-01', paginationOpts: { numItems: 100, cursor: first.continueCursor } })
    expect(second.page).toHaveLength(5)
  })
})
