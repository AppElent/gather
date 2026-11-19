import { describe, expect, test } from 'vitest'

import { en, nl } from './messages'
import {
  assignmentBody,
  isExpoPushToken,
  mayNotify,
  notificationLink,
  notificationPath,
  recordOfSegments,
  shortDay,
} from './notifications'

describe('mayNotify', () => {
  test('every switch is on until the person turns it off', () => {
    expect(mayNotify('taskReminder', undefined, undefined)).toBe(true)
    expect(mayNotify('eventAssignment', {}, false)).toBe(true)
  })

  test('a switched-off kind sends nothing, the other kinds still do', () => {
    const switches = { taskReminders: false }
    expect(mayNotify('taskReminder', switches, false)).toBe(false)
    expect(mayNotify('taskAssignment', switches, false)).toBe(true)
    expect(mayNotify('eventReminder', switches, false)).toBe(true)
  })

  test('a muted Group sends nothing whatever the switches say', () => {
    expect(mayNotify('taskAssignment', { taskAssignments: true }, true)).toBe(
      false,
    )
  })
})

describe('notification links', () => {
  test('a task and an event round-trip through their path', () => {
    for (const target of [
      { type: 'task', id: 'k57abc123' },
      { type: 'event', id: 'j9xyz' },
    ] as const) {
      const link = notificationLink({ url: notificationPath('home', target) })
      expect(link?.groupSlug).toBe('home')
      expect(recordOfSegments(link?.segments ?? [])).toEqual(target)
    }
  })

  test('a slug is encoded on the way out and decoded on the way in', () => {
    const path = notificationPath('a b', { type: 'task', id: 'k1' })
    expect(path).toBe('/g/a%20b/tasks/task/k1')
    expect(notificationLink({ url: path })?.groupSlug).toBe('a b')
  })

  test.each([
    null,
    'not an object',
    {},
    { url: 42 },
    { url: 'https://evil.example/g/home/tasks/task/k1' },
    { url: 'g/home/tasks/task/k1' },
    { url: '/g//tasks/task/k1' },
    { url: '/g/home/settings' },
    { url: '/g/home/tasks/task/../settings' },
    { url: '/g/home/tasks/task/k1/edit' },
    { url: '/g/home/calendar/j9/edit' },
    { url: '/g/%E0%A4%A/tasks/task/k1' },
    { url: `/g/home/tasks/task/${'k'.repeat(300)}` },
  ])('refuses %j', (data) => {
    expect(notificationLink(data)).toBeNull()
  })
})

describe('isExpoPushToken', () => {
  test('takes Expo tokens, refuses anything else', () => {
    expect(isExpoPushToken('ExponentPushToken[abc-DEF_123]')).toBe(true)
    expect(isExpoPushToken('ExpoPushToken[abc]')).toBe(true)
    expect(isExpoPushToken('ExponentPushToken[]')).toBe(false)
    expect(isExpoPushToken('ExponentPushToken[a b]')).toBe(false)
    expect(isExpoPushToken('a1b2c3d4e5')).toBe(false)
  })
})

describe('assignmentBody (APP-302)', () => {
  test('says who, what and when, in each language', () => {
    const task = { title: 'Badkamer schoonmaken', dueDate: '2026-11-21' }
    expect(assignmentBody(en.notifications, task, 'Daan')).toBe(
      'Daan gave you a task: Badkamer schoonmaken, Sat 21 Nov',
    )
    expect(assignmentBody(nl.notifications, task, 'Daan')).toBe(
      'Daan gaf je een taak: Badkamer schoonmaken, za 21 nov',
    )
  })

  test('leaves the date out when there is none, and names a gone giver Someone', () => {
    expect(assignmentBody(en.notifications, { title: 'Bins' }, null)).toBe(
      'Someone gave you a task: Bins',
    )
    expect(assignmentBody(nl.notifications, { title: 'Bins' }, '  ')).toBe(
      'Iemand gaf je een taak: Bins',
    )
  })

  test('reads the weekday as a civil date, not in any time zone', () => {
    expect(shortDay('2026-01-01', en.notifications.short)).toBe('Thu 1 Jan')
    expect(shortDay('2026-12-31', nl.notifications.short)).toBe('do 31 dec')
    expect(shortDay('not a date', en.notifications.short)).toBeNull()
  })
})
