import { describe, expect, test } from 'vitest'

import type { Id } from '../convex/api'
import { groupLinkTarget, nativeDestinationForGroupLink } from './groupLink'

describe('nativeDestinationForGroupLink', () => {
  test('a task or an event opens its detail screen (a notification’s tap)', () => {
    expect(nativeDestinationForGroupLink(['tasks', 'task', 'k57abc'])).toEqual({
      pathname: '/all/tasks/task/[taskId]',
      params: { taskId: 'k57abc' },
    })
    expect(nativeDestinationForGroupLink(['calendar', 'j9xyz'])).toEqual({
      pathname: '/all/calendar/[eventId]',
      params: { eventId: 'j9xyz' },
    })
  })

  // An old `/g/<slug>/…` link's Module and All addresses are retired (APP-81).
  test.each([
    [[]],
    [['all']],
    [['tasks']],
    [['all', 'tasks']],
    [['cheeses']],
    [['baby']],
    [['tasks', 'task', '../settings']],
    [['tasks', 'k57abc']],
    [['calendar', 'j9', 'edit']],
    [['recipes', 'r1']],
  ])('refuses %j, so the Group is left alone', (segments) => {
    expect(nativeDestinationForGroupLink(segments)).toBeNull()
  })
})

describe('groupLinkTarget', () => {
  const groups = [{ _id: 'g_willow' as Id<'groups'>, slug: 'willow' }]

  test('resolves the slug to one of the Member’s Groups', () => {
    expect(
      groupLinkTarget(
        { groupSlug: 'willow', segments: ['calendar', 'j9xyz'] },
        groups,
      ),
    ).toEqual({
      groupId: 'g_willow',
      href: { pathname: '/all/calendar/[eventId]', params: { eventId: 'j9xyz' } },
    })
  })

  test('refuses a Group the Member is not in, and no link at all', () => {
    expect(
      groupLinkTarget(
        { groupSlug: 'elsewhere', segments: ['calendar', 'j9xyz'] },
        groups,
      ),
    ).toBeNull()
    expect(groupLinkTarget(null, groups)).toBeNull()
  })
})
