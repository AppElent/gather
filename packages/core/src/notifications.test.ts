import { describe, expect, test } from 'vitest'

import {
  isExpoPushToken,
  mayNotify,
  notificationLink,
  notificationPath,
  recordOfSegments,
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
